import { AppError } from '../utils/errors.js';

export function zodToAppError(error) {
  const details = error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  return new AppError(400, 'VALIDATION_ERROR', 'The request is invalid', details);
}

/** validate({ params, query, body }) - parsed (and coerced/trimmed) values replace the raw ones. */
export const validate = (schemas) => (req, res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) return next(zodToAppError(result.error));
    req[part] = result.data;
  }
  next();
};
