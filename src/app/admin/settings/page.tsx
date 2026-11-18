import { OperatingHoursForm } from "./operating-hours-form";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantOperatingStatus } from "@/lib/time/restaurant-hours";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("restaurant_settings")
    .select("*")
    .eq("singleton", true)
    .single();
  const initialSettings = data
    ? { ...data, operatingStatus: getRestaurantOperatingStatus(data) }
    : null;
  return (
    <main>
      <header className="space-y-1">
        <h1 className="text-page-title font-semibold">Pengaturan Restoran</h1>
        <p className="text-sm text-muted-foreground">
          Atur jadwal harian dan status buka sementara restoran.
        </p>
      </header>
      <OperatingHoursForm initialSettings={initialSettings} />
    </main>
  );
}
