"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthActionState } from "@/app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {} satisfies AuthActionState);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="reset-email">Email</Label><Input id="reset-email" name="email" type="email" autoComplete="email" required /></div>
      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      {state.success && <Alert><AlertDescription>{state.success}</AlertDescription></Alert>}
      <Button type="submit" loading={pending} className="w-full">
        {pending ? "Mengirim…" : "Kirim instruksi reset"}
      </Button>
    </form>
  );
}
