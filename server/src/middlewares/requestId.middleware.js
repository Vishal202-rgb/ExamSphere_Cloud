// ==============================================================================
// ExamSphere – Request ID Middleware
// Assigns a unique X-Request-Id for distributed tracing and audit correlation
// ==============================================================================

import crypto from 'crypto';

export const requestId = (req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const reqId = (incomingId && typeof incomingId === 'string' && incomingId.length <= 64)
    ? incomingId
    : crypto.randomUUID();

  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
};
