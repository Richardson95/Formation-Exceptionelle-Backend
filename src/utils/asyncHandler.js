/**
 * Wrap an async Express handler so rejected promises reach next()/the error handler.
 */
export default function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
