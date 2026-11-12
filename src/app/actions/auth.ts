"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStaff } from "@/lib/auth/current-staff";

export type AuthActionState = { error?: string; success?: string };

const emailSchema = z.email();

export async function signIn(_state: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = z.string().min(1).safeParse(formData.get("password"));
  if (!email.success || !password.success) return { error: "Email atau kata sandi tidak valid." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: password.data });
  if (error) return { error: "Email atau kata sandi tidak cocok." };

  const staff = await getCurrentStaff();
  if (!staff) {
    await supabase.auth.signOut();
    return { error: "Akun tidak aktif atau belum memiliki akses staf." };
  }

  redirect(staff.role === "ADMIN" ? "/admin/dashboard" : "/staff/queue");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

export async function requestPasswordReset(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: "Masukkan alamat email yang valid." };

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) return { error: "Email reset belum dapat dikirim. Coba lagi nanti." };
  return { success: "Jika email terdaftar, instruksi reset akan dikirim." };
}

export async function updatePassword(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/).safeParse(formData.get("password"));
  if (!password.success) return { error: "Kata sandi minimal 8 karakter dan harus mengandung huruf serta angka." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Sesi reset tidak valid atau sudah berakhir." };

  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: "Kata sandi belum dapat diperbarui. Coba lagi." };
  redirect("/login?password-updated=1");
}
