import { z } from 'zod';

export const uuid = z.string().uuid();
export const idParams = z.object({ id: uuid });
export const attachmentParams = z.object({ id: uuid, attachmentId: uuid });
export const anonAttachmentParams = z.object({ attachmentId: uuid });
export const notificationParams = z.object({ id: uuid });
