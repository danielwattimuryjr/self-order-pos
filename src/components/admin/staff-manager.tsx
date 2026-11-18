"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Staff = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  is_active: boolean;
  created_at: string;
};
type Props = { currentStaffId: string };

export function StaffManager({ currentStaffId }: Props) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/admin/staff", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Daftar Staff belum dapat dimuat.");
      setStaff(result.data.staff);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Daftar Staff belum dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openInvite = () => {
    setEditing(null);
    setName("");
    setEmail("");
    setRole("STAFF");
    setIsActive(true);
    setDialogOpen(true);
  };
  const openEdit = (entry: Staff) => {
    setEditing(entry);
    setName(entry.name);
    setEmail(entry.email);
    setRole(entry.role);
    setIsActive(entry.is_active);
    setDialogOpen(true);
  };
  const isSelf = editing?.id === currentStaffId;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(
        editing ? `/api/v1/admin/staff/${editing.id}` : "/api/v1/admin/staff",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editing ? { name, role, isActive } : { name, email, role },
          ),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Perubahan belum dapat disimpan.");
      toast.success(
        editing
          ? "Akun diperbarui."
          : "Undangan dikirim. Staff dapat mengatur kata sandi melalui email.",
      );
      setDialogOpen(false);
      await load();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Perubahan belum dapat disimpan.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={openInvite}>Undang Staff</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p
              className="p-8 text-center text-sm text-muted-foreground"
              aria-live="polite"
            >
              Memuat akun…
            </p>
          ) : error ? (
            <div className="space-y-3 p-8 text-center">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
              <Button variant="outline" onClick={() => void load()}>
                Coba lagi
              </Button>
            </div>
          ) : staff.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Belum ada akun Staff.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.name}
                      {entry.id === currentStaffId && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (Anda)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{entry.email}</TableCell>
                    <TableCell>{entry.role}</TableCell>
                    <TableCell>
                      <Badge variant={entry.is_active ? "default" : "outline"}>
                        {entry.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(entry)}
                      >
                        Ubah
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!saving) setDialogOpen(open);
        }}
      >
        <DialogContent>
          <form onSubmit={submit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Ubah akun" : "Undang akun Staff"}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? "Perubahan role dan status berlaku untuk seluruh request berikutnya."
                  : "Undangan Supabase Auth akan dikirim melalui email. Penerima mengatur kata sandinya sendiri."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="staff-name">Nama</Label>
              <Input
                id="staff-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
              />
            </div>
            {!editing && (
              <div className="space-y-2">
                <Label htmlFor="staff-email">Email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(value) => {
                  if (value) setRole(value as "ADMIN" | "STAFF");
                }}
                disabled={isSelf}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editing && (
              <div className="space-y-2">
                <Label>Status akun</Label>
                <Select
                  value={isActive ? "ACTIVE" : "INACTIVE"}
                  onValueChange={(value) => {
                    if (value) setIsActive(value === "ACTIVE");
                  }}
                  disabled={isSelf}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Aktif</SelectItem>
                    <SelectItem value="INACTIVE">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isSelf && (
              <p className="text-sm text-muted-foreground">
                Role dan status akun sendiri tidak dapat diubah.
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Batal
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? "Simpan perubahan" : "Kirim undangan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
