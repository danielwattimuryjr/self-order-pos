import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/current-staff";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./auth-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const staff = await getCurrentStaff();
  if (staff) redirect(staff.role === "ADMIN" ? "/admin/dashboard" : "/staff/queue");

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md">
        <CardHeader><p className="text-sm font-medium text-muted-foreground">QR Restaurant Ordering System</p><CardTitle>Masuk ke akun staf</CardTitle><CardDescription>Gunakan email dan kata sandi yang diberikan Admin.</CardDescription></CardHeader>
        <CardContent><LoginForm /></CardContent>
      </Card>
    </main>
  );
}
