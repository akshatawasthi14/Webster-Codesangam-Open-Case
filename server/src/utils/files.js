import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/index.js';

export const uploadDir = path.resolve(config.uploads.dir);

export async function ensureUploadDir() {
  await fs.mkdir(uploadDir, { recursive: true });
}

export const storedPath = (storedName) => path.join(uploadDir, path.basename(storedName));

/**
 * Removes files multer wrote. Never throws: returns the paths that could not be removed
 * (a file that is already gone is not a failure) so callers can log them.
 */
export async function removeFiles(files = []) {
  const results = await Promise.all(
    (files ?? []).map((f) =>
      fs.unlink(f.path).then(
        () => null,
        (err) => (err?.code === 'ENOENT' ? null : { path: f.path, error: err.message }),
      ),
    ),
  );
  return results.filter(Boolean);
}

export function sanitizeFileName(name) {
  const base = path.basename(String(name || 'file')).replace(/[^\w.\- ()]/g, '_');
  return base.slice(0, 120) || 'file';
}
