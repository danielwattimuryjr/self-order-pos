import { TablesManager } from "./tables-manager";
import { createClient } from "@/lib/supabase/server";

export default async function AdminTablesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("dining_tables").select("id, table_code, table_number, is_active").order("table_number");
  return <main><h1 className="text-2xl font-semibold">Meja</h1><p className="mt-2 text-neutral-600">Kode QR permanen menggunakan UUIDv4. Mengubah nomor meja tidak mengubah QR.</p><TablesManager initialTables={data ?? []} /></main>;
}
