import { OperatingHoursForm } from "./operating-hours-form";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantOperatingStatus } from "@/lib/time/restaurant-hours";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("restaurant_settings").select("*").eq("singleton", true).single();
  const initialSettings = data ? { ...data, operatingStatus: getRestaurantOperatingStatus(data) } : null;
  return <main><h1 className="text-2xl font-semibold">Pengaturan Restoran</h1><OperatingHoursForm initialSettings={initialSettings} /></main>;
}
