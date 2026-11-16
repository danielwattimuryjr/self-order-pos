import { requireRole } from "@/lib/auth/current-staff";
import { KitchenHistory } from "@/components/staff/kitchen-history";

export default async function StaffHistoryPage() {
  await requireRole("STAFF");
  return <KitchenHistory />;
}
