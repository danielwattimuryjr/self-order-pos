import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/server-env";

export function createServiceClient() {
  const publicEnv = getPublicEnv();
  const serviceKey = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("Server-side Supabase service configuration is missing.");
  return createSupabaseClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
