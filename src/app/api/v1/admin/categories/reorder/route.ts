import { z } from "zod";
import { failure, success } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/auth/admin-api";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ ids: z.array(z.uuid()) });

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("VALIDATION_ERROR", "Urutan kategori tidak valid.", 422);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_reorder_categories", { p_ids: parsed.data.ids });
  if (error) return failure("CATEGORY_REORDER_FAILED", "Urutan kategori belum dapat disimpan.", 409);
  return success({ ids: parsed.data.ids }, "Urutan kategori diperbarui.");
}
