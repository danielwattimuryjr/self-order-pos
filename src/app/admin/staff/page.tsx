import { requireRole } from "@/lib/auth/current-staff";
import { StaffManager } from "@/components/admin/staff-manager";

export default async function AdminStaffPage() {
  const staff = await requireRole("ADMIN");
  return <main className="space-y-6"><div><h1 className="text-2xl font-semibold">Staf</h1><p className="mt-1 text-sm text-muted-foreground">Undang dan kelola akses akun Admin dan Staff.</p></div><StaffManager currentStaffId={staff.id} /></main>;
}
