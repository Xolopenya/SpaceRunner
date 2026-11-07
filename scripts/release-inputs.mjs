import {normalizedBytes} from './warp-verify.mjs';
export const releaseBytes=(path,data)=>/\.ya?ml$/.test(path)?Buffer.from(data.toString('utf8').replaceAll('\r\n','\n')):normalizedBytes(path,data);
