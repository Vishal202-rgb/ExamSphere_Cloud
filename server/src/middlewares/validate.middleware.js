// ==============================================================================
// ExamSphere – Zod Request Validation Middleware
// Validates req.body, req.query, or req.params against a Zod schema
// ==============================================================================

export const validateRequest = (schema, source = null) => {
  return async (req, res, next) => {
    try {
      if (source) {
        const validated = await schema.parseAsync(req[source]);
        req[source] = validated;
      } else if (schema.shape && (schema.shape.query || schema.shape.params || schema.shape.body)) {
        const validated = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
        if (validated.body !== undefined) req.body = validated.body;
        if (validated.query !== undefined) req.query = validated.query;
        if (validated.params !== undefined) req.params = validated.params;
      } else {
        const validated = await schema.parseAsync(req.body);
        req.body = validated;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
