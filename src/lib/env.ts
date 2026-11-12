import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export function getPublicEnv() {
  const result = publicEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid public environment configuration: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}
