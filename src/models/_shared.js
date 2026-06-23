/**
 * Shared Mongoose schema options: expose `id` (string), keep timestamps,
 * and strip Mongo internals (`_id`, `__v`) from JSON output.
 * Models may extend the transform via `extraTransform(doc, ret)`.
 */
export function baseSchemaOptions(extraTransform) {
  const transform = (doc, ret) => {
    ret.id = ret.id || (ret._id != null ? String(ret._id) : undefined);
    delete ret._id;
    delete ret.__v;
    if (extraTransform) extraTransform(doc, ret);
    return ret;
  };
  return {
    timestamps: true,
    toJSON: { virtuals: true, transform },
    toObject: { virtuals: true, transform },
  };
}
