import { PasswordForm } from "./password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Buat kata sandi baru</CardTitle><CardDescription>Gunakan minimal 8 karakter, dengan huruf dan angka.</CardDescription></CardHeader>
        <CardContent><PasswordForm /></CardContent>
      </Card>
    </main>
  );
}
