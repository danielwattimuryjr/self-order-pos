"use client";

import { useActionState } from "react";
import { signIn, type AuthActionState } from "@/app/actions/auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2"><Label htmlFor="login-email">Email</Label><Input id="login-email" name="email" type="email" autoComplete="username" required /></div>
      <div className="space-y-2"><Label htmlFor="login-password">Kata sandi</Label><Input id="login-password" name="password" type="password" autoComplete="current-password" required /></div>
      {state.error && <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert>}
      <Button type="submit" loading={pending} className="w-full">
        {pending ? "Memproses…" : "Masuk"}
      </Button>
      <a href="/forgot-password" className="block text-center text-sm text-muted-foreground underline">Lupa kata sandi?</a>
    </form>
  );
}
