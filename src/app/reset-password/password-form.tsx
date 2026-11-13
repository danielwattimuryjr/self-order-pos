"use client";

import { useActionState } from "react";
import { updatePassword, type AuthActionState } from "@/app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {} satisfies AuthActionState);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="new-password">Kata sandi baru</Label><Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      <Button type="submit" loading={pending} className="w-full">
        {pending ? "Menyimpan…" : "Simpan kata sandi"}
      </Button>
    </form>
  );
}
