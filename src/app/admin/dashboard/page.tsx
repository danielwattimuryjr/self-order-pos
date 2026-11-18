import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { getOperationalDate } from "@/lib/analytics/operational-date";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("restaurant_settings")
    .select("opening_time, closing_time")
    .eq("singleton", true)
    .maybeSingle();
  const operationalDate = getOperationalDate(
    new Date(),
    data ?? { opening_time: null, closing_time: null },
  );
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ringkasan penjualan berdasarkan tanggal operasional Asia/Jakarta.
        </p>
      </div>
      <AnalyticsDashboard operationalDate={operationalDate} />
    </main>
  );
}
