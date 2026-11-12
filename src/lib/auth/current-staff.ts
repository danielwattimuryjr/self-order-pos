import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type StaffRole = "ADMIN" | "STAFF";

export type CurrentStaff = {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  role: StaffRole;
};

export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: profile, error } = await supabase
    .from("staff_profiles")
    .select("id, auth_user_id, name, email, role, is_active")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (error || !profile || !profile.is_active) return null;
  if (profile.role !== "ADMIN" && profile.role !== "STAFF") return null;

  return {
    id: profile.id,
    authUserId: profile.auth_user_id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
  };
}

export async function requireStaff(): Promise<CurrentStaff> {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/login");
  return staff;
}

export async function requireRole(role: StaffRole): Promise<CurrentStaff> {
  const staff = await requireStaff();
  if (staff.role !== role) redirect(staff.role === "ADMIN" ? "/admin/dashboard" : "/staff/queue");
  return staff;
}
