import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordCatalogAudit(
  supabase: SupabaseClient,
  action: string,
  entityType: string,
  entityId: string | null,
  before: unknown,
  after: unknown,
) {
  const { error } = await supabase.rpc("admin_record_catalog_audit", {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_before: before,
    p_after: after,
  });
  if (error) throw error;
}
