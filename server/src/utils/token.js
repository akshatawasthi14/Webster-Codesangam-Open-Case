import crypto from 'node:crypto';
import { sha256Hex } from './hash.js';

const RECEIPT_FORMAT = /^[A-Za-z0-9_-]{43}$/;
const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 256 bits from the OS CSPRNG, URL-safe. Shown to the petitioner exactly once. */
export const generateReceiptToken = () => crypto.randomBytes(32).toString('base64url');

/** Only this hash is ever stored. */
export const hashReceiptToken = (token) => sha256Hex(token);

export const isValidReceiptFormat = (token) =>
  typeof token === 'string' && (RECEIPT_FORMAT.test(token.trim()) || UUID_FORMAT.test(token.trim()));
