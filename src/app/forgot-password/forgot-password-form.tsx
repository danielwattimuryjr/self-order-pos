"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthActionState } from "@/app/actions/auth";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, {} satisfies AuthActionState);
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block text-sm font-medium">Email
        <input name="email" type="email" autoComplete="email" required className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2.5" />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state.success && <p role="status" className="text-sm text-green-800">{state.success}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-white disabled:opacity-60">
        {pending ? "Mengirim…" : "Kirim instruksi reset"}
      </button>
    </form>
  );
}
