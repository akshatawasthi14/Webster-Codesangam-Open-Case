/**
 * Client-side file validation matching server/src/middleware/upload.js.
 * Inspects header magic bytes before uploading to provide instant user feedback.
 */

export async function validateFileMagicBytes(file) {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  if (file.size === 0) {
    return { valid: false, error: `File "${file.name}" is empty (0 bytes).` };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: `File "${file.name}" exceeds the 5MB maximum file limit.` };
  }

  // Slice first 512 bytes for magic bytes analysis
  const slice = file.slice(0, 512);
  const buffer = await slice.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // PDF check: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    if (
      bytes.length >= 5 &&
      bytes[0] === 0x25 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x44 &&
      bytes[3] === 0x46 &&
      bytes[4] === 0x2d
    ) {
      return { valid: true };
    }
    return {
      valid: false,
      error: `File "${file.name}" is not a valid PDF document (missing %PDF- signature).`,
    };
  }

  // PNG check: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
  if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
    const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length >= 8 && pngMagic.every((b, i) => bytes[i] === b)) {
      return { valid: true };
    }
    return {
      valid: false,
      error: `File "${file.name}" is not a valid PNG image (mismatched file signature).`,
    };
  }

  // JPEG check: 0xFF, 0xD8, 0xFF
  if (
    file.type === 'image/jpeg' ||
    file.name.toLowerCase().endsWith('.jpg') ||
    file.name.toLowerCase().endsWith('.jpeg')
  ) {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { valid: true };
    }
    return {
      valid: false,
      error: `File "${file.name}" is not a valid JPEG image (mismatched file signature).`,
    };
  }

  // Plain text check: no NUL bytes and valid UTF-8
  if (file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt')) {
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) {
        return {
          valid: false,
          error: `File "${file.name}" contains binary characters and cannot be read as plain text.`,
        };
      }
    }
    try {
      // Use { stream: true } to tolerate incomplete multi-byte tail at the slice boundary
      new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: true });
      return { valid: true };
    } catch {
      return {
        valid: false,
        error: `File "${file.name}" is not valid UTF-8 plain text.`,
      };
    }
  }

  return {
    valid: false,
    error: `File "${file.name}" has an unsupported format. Only PDF, PNG, JPEG, and TXT are allowed.`,
  };
}
