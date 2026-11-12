"use client";

import { useActionState } from "react";
import { updatePassword, type AuthActionState } from "@/app/actions/auth";

export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, {} satisfies AuthActionState);
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block text-sm font-medium">Kata sandi baru
        <input name="password" type="password" autoComplete="new-password" minLength={8} required className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2.5" />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-white disabled:opacity-60">
        {pending ? "Menyimpan…" : "Simpan kata sandi"}
      </button>
    </form>
  );
}
