/** Express 4 does not catch rejected promises; this forwards them to the error handler. */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
