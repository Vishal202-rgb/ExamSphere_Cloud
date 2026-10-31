// ==============================================================================
// ExamSphere – Zod Request Validation Middleware
// Validates req.body, req.query, or req.params against a Zod schema
// ==============================================================================

export const validateRequest = (schema, source = 'body') => {
  return async (req, res, next) => {
    try {
      const validated = await schema.parseAsync(req[source]);
      req[source] = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
};
