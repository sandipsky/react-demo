import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.url('API base URL must be a valid URL'),
  VITE_API_TIMEOUT: z.string().transform((val) => Number.parseInt(val, 10)),
  VITE_APP_ENV: z.enum(['dev', 'prod', 'qa']),
});

function validateEnv() {
  const result = envSchema.safeParse(import.meta.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    for (const error of result.error.issues) {
      console.error(`  ${error.path.join('.')}: ${error.message}`);
    }
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

const env = validateEnv();

export const config = {
  api: {
    baseUrl: env.VITE_API_BASE_URL,
    timeout: env.VITE_API_TIMEOUT,
  },
  app: {
    env: env.VITE_APP_ENV
  },
} as const;
