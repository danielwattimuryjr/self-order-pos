import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>Reset kata sandi</CardTitle><CardDescription>Masukkan email akun staf untuk menerima instruksi reset.</CardDescription></CardHeader>
        <CardContent><ForgotPasswordForm /><Link href="/login" className="mt-5 block text-center text-sm text-muted-foreground underline">Kembali ke login</Link></CardContent>
      </Card>
    </main>
  );
}
