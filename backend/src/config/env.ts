import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('uploads'),
  SECURITY_SERVICE_URL: z.string().optional(),
});
export const env = schema.parse(process.env);
