// ==============================================================================
// ExamSphere – Environment Configuration & Zod Schema Validation
// ==============================================================================

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Robustly load environment configuration: check server/.env, root/.env, and process.cwd()
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string({
    required_error: 'DATABASE_URL is required for Prisma connection',
  }),

  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.string().default('6379').transform((val) => parseInt(val, 10)),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().optional(),

  // JWT Configuration (Supports both JWT_SECRET and JWT_ACCESS_SECRET)
  JWT_SECRET: z.string().default('examsphere_default_dev_jwt_secret_key_2026'),
  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),

  REFRESH_TOKEN_SECRET: z.string().default('examsphere_default_dev_refresh_token_secret_key_2026'),
  JWT_REFRESH_SECRET: z.string().optional(),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),

  BCRYPT_SALT_ROUNDS: z.string().default('12').transform((val) => parseInt(val, 10)),
});

const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Environment validation error:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
  }

  const data = parsed.data;
  data.JWT_ACCESS_SECRET = data.JWT_ACCESS_SECRET || data.JWT_SECRET;
  data.JWT_REFRESH_SECRET = data.JWT_REFRESH_SECRET || data.REFRESH_TOKEN_SECRET;

  return data;
};

export const env = parseEnv();
