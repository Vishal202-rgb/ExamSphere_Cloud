// ==============================================================================
// ExamSphere – Proctoring Telemetry Validation Schemas (Zod)
// ==============================================================================

import { z } from 'zod';

export const recordEventSchema = z.object({
  body: z.object({
    attemptId: z.string().uuid('Invalid attempt ID format'),
    eventType: z.enum([
      'TAB_BLUR',
      'TAB_FOCUS',
      'FULLSCREEN_EXIT',
      'FULLSCREEN_ENTER',
      'DISCONNECT',
      'RECONNECT',
      'SUSPICIOUS_KEY',
    ]),
    details: z.record(z.any()).optional(),
    clientTime: z.string().datetime().optional(),
  }),
});

export const attemptIdParamSchema = z.object({
  params: z.object({
    attemptId: z.string().uuid('Invalid attempt ID format'),
  }),
});
