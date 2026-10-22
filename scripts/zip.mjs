import { deflateRawSync, inflateRawSync } from 'node:zlib';

const table = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ table[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

export function safeZipName(name) {
  return typeof name === 'string' && name.length > 0 && !/^[\/\\]|^[a-z]:/i.test(name)
    && !name.includes('\\') && !name.includes('\0') && !name.split('/').some(part => !part || part === '.' || part === '..');
}

/** Small dependency-free ZIP32 writer. Input is explicitly selected files only. */
export function createZip(entries, timestamp = new Date()) {
  if (entries.length > 65535) throw new Error('ZIP32 entry limit exceeded');
  const locals = [], central = [], names = new Set();
  let offset = 0;
  const time = (timestamp.getUTCHours() << 11) | (timestamp.getUTCMinutes() << 5) | (timestamp.getUTCSeconds() >> 1);
  const date = ((Math.max(1980, timestamp.getUTCFullYear()) - 1980) << 9) | ((timestamp.getUTCMonth() + 1) << 5) | timestamp.getUTCDate();
  for (const entry of entries) {
    if (!safeZipName(entry.name) || names.has(entry.name)) throw new Error(`Unsafe/duplicate ZIP path: ${entry.name}`);
    names.add(entry.name);
    const name = Buffer.from(entry.name), data = Buffer.from(entry.data), compressed = deflateRawSync(data, { level: 6 });
    if (data.length > 0xffffffff || name.length > 65535) throw new Error('ZIP32 file limit exceeded');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0x800, 8); record.writeUInt16LE(8, 10); record.writeUInt16LE(time, 12); record.writeUInt16LE(date, 14);
    record.writeUInt32LE(crc, 16); record.writeUInt32LE(compressed.length, 20); record.writeUInt32LE(data.length, 24);
    record.writeUInt16LE(name.length, 28); record.writeUInt32LE(offset, 42);
    locals.push(local, name, compressed); central.push(record, name);
    offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  if (offset + directory.length > 0xffffffff) throw new Error('ZIP32 archive limit exceeded');
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/** Reopen every entry, inflate it and check its central-directory size/CRC. */
export function readZip(bytes) {
  if (bytes.length < 22 || bytes.readUInt32LE(bytes.length - 22) !== 0x06054b50) throw new Error('Invalid ZIP end record');
  const count = bytes.readUInt16LE(bytes.length - 12);
  let cursor = bytes.readUInt32LE(bytes.length - 6);
  const entries = new Map();
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP directory');
    const method = bytes.readUInt16LE(cursor + 10), expectedCrc = bytes.readUInt32LE(cursor + 16);
    const compressedSize = bytes.readUInt32LE(cursor + 20), size = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28), extra = bytes.readUInt16LE(cursor + 30), comment = bytes.readUInt16LE(cursor + 32);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString();
    const localOffset = bytes.readUInt32LE(cursor + 42);
    if (!safeZipName(name) || entries.has(name) || method !== 8 || bytes.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Invalid ZIP entry');
    const start = localOffset + 30 + bytes.readUInt16LE(localOffset + 26) + bytes.readUInt16LE(localOffset + 28);
    const data = inflateRawSync(bytes.subarray(start, start + compressedSize));
    if (data.length !== size || crc32(data) !== expectedCrc) throw new Error(`ZIP integrity failure: ${name}`);
    entries.set(name, data);
    cursor += 46 + nameLength + extra + comment;
  }
  return entries;
}
