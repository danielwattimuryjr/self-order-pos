import { signOut } from "@/app/actions/auth";
import { requireRole } from "@/lib/auth/current-staff";
import { ManagementShell } from "@/components/layout/management-shell";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const staff = await requireRole("STAFF");
  return (
    <ManagementShell role="STAFF" staffName={staff.name} signOutAction={signOut}>{children}</ManagementShell>
  );
}
