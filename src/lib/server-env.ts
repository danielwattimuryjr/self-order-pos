import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.email().optional(),
  MIDTRANS_SERVER_KEY: z.string().min(1).optional(),
  MIDTRANS_IS_PRODUCTION: z.enum(["true", "false"]).optional().default("false"),
});

export function getServerEnv() {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid server environment configuration: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}
