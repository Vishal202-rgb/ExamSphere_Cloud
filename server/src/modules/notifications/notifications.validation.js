import { z } from 'zod';

export const getNotificationsQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
  unreadOnly: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export const notificationIdParamSchema = z.object({
  id: z.string().uuid({ message: 'Valid notification UUID is required' }),
});
