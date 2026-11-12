import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function resolveTableSession(tableCode: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_table_session", { p_table_code: tableCode });
  if (error) throw new Error(error.code === "P0002" ? "TABLE_UNAVAILABLE" : "SESSION_RESOLUTION_FAILED");
  return data?.[0] ?? null;
}
