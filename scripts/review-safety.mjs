import { safeZipName } from './zip.mjs';

export function excludedPath(name) {
  return !safeZipName(name)
    || /(^|\/)(?:\.git|node_modules|dist|\.cache|review-packages|test-results|playwright-report|\.aws|\.ssh)(?:\/|$)/i.test(name)
    || /(^|\/)\.env(?:\.|$)/i.test(name)
    || /(?:\.(?:pem|key|p12|pfx)|(?:^|\/)id_(?:rsa|ed25519))$/i.test(name);
}

/** Conservative known-credential checks; not a claim of exhaustive secret detection. */
export function containsSecret(bytes) {
  const text = bytes.toString('utf8');
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)
    || /\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(text)
    || /\bgithub_pat_[A-Za-z0-9_]{30,}\b/.test(text)
    || /\bAKIA[A-Z0-9]{16}\b/.test(text)
    || /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/.test(text)
    || /https?:\/\/[^\s/:@]+:[^\s/@]+@/.test(text);
}
