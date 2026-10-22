import crypto from 'node:crypto';
import fs from 'node:fs';

export const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex');

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) out[key] = sortDeep(value[key]);
    }
    return out;
  }
  return value;
}

/** Deterministic JSON: object keys sorted recursively, so serialization can never differ between write and verify. */
export const canonicalJson = (value) => JSON.stringify(sortDeep(value));

export function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
