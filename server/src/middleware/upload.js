import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import multer from 'multer';
import { ALLOWED_UPLOAD_MIME } from '../config/constants.js';
import { config } from '../config/index.js';
import { AppError } from '../utils/errors.js';
import { ensureUploadDir, removeFiles, uploadDir } from '../utils/files.js';

await ensureUploadDir();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.bin`), // never trust client file names on disk
  }),
  limits: { fileSize: config.uploads.maxFileBytes, files: config.uploads.maxFiles, fields: 20, fieldSize: 20 * 1024 },
  fileFilter: (req, file, cb) =>
    ALLOWED_UPLOAD_MIME.includes(file.mimetype)
      ? cb(null, true)
      : cb(new AppError(415, 'UNSUPPORTED_FILE_TYPE', `Allowed attachment types: ${ALLOWED_UPLOAD_MIME.join(', ')}`)),
});

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Real content must match the declared type: the client-supplied MIME type is only a claim. */
const SIGNATURES = {
  'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  'image/png': (b) => b.length >= 8 && b.subarray(0, 8).equals(PNG),
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'text/plain': (b) => {
    if (b.includes(0)) return false; // NUL bytes mean binary
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(b, { stream: true }); // tolerate a cut multi-byte tail
      return true;
    } catch {
      return false;
    }
  },
};

async function contentMatchesDeclaredType(file) {
  const handle = await fs.open(file.path, 'r');
  try {
    const buf = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
    return SIGNATURES[file.mimetype]?.(buf.subarray(0, bytesRead)) ?? false;
  } finally {
    await handle.close();
  }
}

/** Parses multipart/form-data with up to MAX_FILES_PER_TICKET files in the "attachments" field. */
export function uploadAttachments(req, res, next) {
  upload.array('attachments', config.uploads.maxFiles)(req, res, async (err) => {
    if (!err) {
      try {
        for (const file of req.files ?? []) {
          if (file.size === 0) {
            await removeFiles(req.files);
            return next(new AppError(400, 'EMPTY_FILE', `"${file.originalname}" is empty`));
          }
          if (!(await contentMatchesDeclaredType(file))) {
            await removeFiles(req.files);
            return next(new AppError(415, 'FILE_CONTENT_MISMATCH', `"${file.originalname}" does not look like a real ${file.mimetype} file`));
          }
        }
        return next();
      } catch (e) {
        await removeFiles(req.files);
        return next(e);
      }
    }
    await removeFiles(req.files); // partial uploads must not linger
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return next(new AppError(status, err.code, err.message));
    }
    next(err);
  });
}
