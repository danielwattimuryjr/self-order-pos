"use client";

import { useActionState } from "react";
import { signIn, type AuthActionState } from "@/app/actions/auth";

const initialState: AuthActionState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form action={action} className="mt-8 space-y-5">
      <label className="block text-sm font-medium">
        Email
        <input name="email" type="email" autoComplete="username" required className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5" />
      </label>
      <label className="block text-sm font-medium">
        Kata sandi
        <input name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5" />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 font-medium text-white disabled:opacity-60">
        {pending ? "Memproses…" : "Masuk"}
      </button>
      <a href="/forgot-password" className="block text-center text-sm text-neutral-600 underline">Lupa kata sandi?</a>
    </form>
  );
}
