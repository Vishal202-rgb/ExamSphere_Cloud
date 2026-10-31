// ==============================================================================
// ExamSphere – Async Controller Handler Wrapper
// Eliminates boilerplate try-catch blocks and forwards rejections to next()
// ==============================================================================

export const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};
