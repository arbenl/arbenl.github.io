import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  NEXTAUTH_URL: z.url(),
  NEXTAUTH_SECRET: z.string().min(1),
  GITHUB_ID: z.string().min(1),
  GITHUB_SECRET: z.string().min(1),
  PROFESSOR_GITHUB_ID: z.string().regex(/^\d+$/),
  RATE_LIMIT_SECRET: z.string().min(1),
});

export type ServerEnv = z.infer<typeof envSchema>;

export function getEnv(): ServerEnv {
  return envSchema.parse(process.env);
}
