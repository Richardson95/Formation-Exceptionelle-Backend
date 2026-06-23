/**
 * Validate parts of the request against Zod schemas and replace them with the
 * parsed (and coerced) values. Usage: validate({ body: schema, query: schema }).
 */
export function validate(schemas = {}) {
  return (req, res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query ?? {});
        // req.query can be a getter-only in some setups; assign field-by-field safely.
        req.validatedQuery = parsed;
        try {
          req.query = parsed;
        } catch {
          /* keep req.validatedQuery */
        }
      }
      if (schemas.params) req.params = schemas.params.parse(req.params ?? {});
      next();
    } catch (err) {
      next(err);
    }
  };
}

export default validate;
