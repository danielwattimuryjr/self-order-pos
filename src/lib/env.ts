import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export function getPublicEnv() {
  // Next.js only inlines NEXT_PUBLIC_* variables into browser bundles when
  // they are referenced directly. Passing the whole process.env object works
  // on the server but leaves these values undefined in client components.
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!result.success) {
    throw new Error(`Invalid public environment configuration: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}
