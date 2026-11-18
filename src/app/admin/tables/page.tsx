import { TablesManager } from "./tables-manager";
import { createClient } from "@/lib/supabase/server";

export default async function AdminTablesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dining_tables")
    .select("id, table_code, table_number, is_active")
    .order("table_number");
  return (
    <main>
      <header className="space-y-1">
        <h1 className="text-page-title font-semibold">Meja</h1>
        <p className="text-sm text-muted-foreground">
          Kode QR permanen menggunakan UUIDv4. Mengubah nomor meja tidak
          mengubah QR.
        </p>
      </header>
      <TablesManager initialTables={data ?? []} />
    </main>
  );
}
