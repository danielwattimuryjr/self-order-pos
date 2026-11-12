import { getCurrentStaff } from "@/lib/auth/current-staff";

export default async function StaffProfilePage() {
  const staff = await getCurrentStaff();
  if (!staff) return null;
  return (
    <main>
      <h1 className="text-2xl font-semibold">Profil Akun</h1>
      <dl className="mt-6 max-w-lg space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
        <div><dt className="text-sm text-neutral-500">Nama</dt><dd>{staff.name}</dd></div>
        <div><dt className="text-sm text-neutral-500">Email</dt><dd>{staff.email}</dd></div>
      </dl>
    </main>
  );
}
