"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";

type Voucher = {
  id: string;
  code: string;
  name: string;
  discount_type: "PERCENT" | "FIXED";
  discount_value: number;
  min_transaction: number;
  max_discount: number | null;
  quota: number | null;
  used_count: number;
  reservedCount: number;
  starts_on: string;
  ends_on: string;
  starts_time: string;
  ends_time: string;
  is_active: boolean;
  categoryIds: string[];
};
type Category = { id: string; name: string; is_active: boolean };
type Draft = {
  code: string;
  name: string;
  discountType: "PERCENT" | "FIXED";
  discountValue: string;
  minTransaction: string;
  maxDiscount: string;
  quota: string;
  startsOn: string;
  endsOn: string;
  startsTime: string;
  endsTime: string;
  isActive: boolean;
  categoryIds: string[];
};
const emptyDraft: Draft = {
  code: "",
  name: "",
  discountType: "PERCENT",
  discountValue: "10",
  minTransaction: "0",
  maxDiscount: "",
  quota: "",
  startsOn: "",
  endsOn: "",
  startsTime: "00:00",
  endsTime: "23:59",
  isActive: true,
  categoryIds: [],
};
const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

function toDraft(voucher: Voucher): Draft {
  return {
    code: voucher.code,
    name: voucher.name,
    discountType: voucher.discount_type,
    discountValue: String(voucher.discount_value),
    minTransaction: String(voucher.min_transaction),
    maxDiscount:
      voucher.max_discount === null ? "" : String(voucher.max_discount),
    quota: voucher.quota === null ? "" : String(voucher.quota),
    startsOn: voucher.starts_on,
    endsOn: voucher.ends_on,
    startsTime: voucher.starts_time.slice(0, 5),
    endsTime: voucher.ends_time.slice(0, 5),
    isActive: voucher.is_active,
    categoryIds: voucher.categoryIds,
  };
}

export function VouchersManager() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [toDelete, setToDelete] = useState<Voucher | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/v1/admin/vouchers", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Daftar voucher belum dapat dimuat.");
      setVouchers(result.data.vouchers);
      setCategories(result.data.categories);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Daftar voucher belum dapat dimuat.",
      );
    } finally {
      setLoading(false);
    }
  }

  // Initial state is loaded from the Admin API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    void load();
  }, []);

  if (loading)
    return (
      <section
        aria-busy="true"
        aria-label="Memuat voucher"
        className="mt-6 space-y-5"
      >
        <span className="sr-only" role="status">
          Memuat voucher…
        </span>
        <div aria-hidden="true" className="rounded-xl border bg-card p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
          <Skeleton className="mb-4 h-9 w-full" />
          <div className="space-y-3">
            {[0, 1].map((item) => (
              <Skeleton key={item} className="h-28 w-full" />
            ))}
          </div>
        </div>
      </section>
    );

  function openEditor(voucher?: Voucher) {
    setEditing(voucher ?? null);
    setDraft(voucher ? toDraft(voucher) : { ...emptyDraft });
    setDialogOpen(true);
  }

  function payload() {
    return {
      code: draft.code,
      name: draft.name,
      discountType: draft.discountType,
      discountValue: Number(draft.discountValue),
      minTransaction: Number(draft.minTransaction || 0),
      maxDiscount: draft.maxDiscount === "" ? null : Number(draft.maxDiscount),
      quota: draft.quota === "" ? null : Number(draft.quota),
      startsOn: draft.startsOn,
      endsOn: draft.endsOn,
      startsTime: draft.startsTime,
      endsTime: draft.endsTime,
      isActive: draft.isActive,
      categoryIds: draft.categoryIds,
    };
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(
        editing
          ? `/api/v1/admin/vouchers/${editing.id}`
          : "/api/v1/admin/vouchers",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload()),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Voucher belum dapat disimpan.");
      toast.success(result.message);
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (saveError) {
      toast.error(
        saveError instanceof Error
          ? saveError.message
          : "Voucher belum dapat disimpan.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeVoucher() {
    if (!toDelete) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/admin/vouchers/${toDelete.id}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Voucher belum dapat dihapus.");
      toast.success(result.message);
      setToDelete(null);
      await load();
    } catch (removeError) {
      toast.error(
        removeError instanceof Error
          ? removeError.message
          : "Voucher belum dapat dihapus.",
      );
    } finally {
      setBusy(false);
    }
  }

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  const categoryName = (id: string) =>
    categories.find((item) => item.id === id)?.name ?? "Kategori dihapus";
  const filteredVouchers = vouchers.filter((voucher) =>
    `${voucher.code} ${voucher.name}`
      .toLocaleLowerCase("id-ID")
      .includes(search.trim().toLocaleLowerCase("id-ID")),
  );

  return (
    <section className="mt-6 space-y-5">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Daftar voucher</CardTitle>
          <CardDescription>
            Voucher dengan order aktif atau riwayat pemakaian akan dinonaktifkan
            saat dihapus.
          </CardDescription>
          <CardAction>
            <Button onClick={() => openEditor()}>Tambah voucher</Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="voucher-search">Cari kode atau nama voucher</Label>
            <Input
              id="voucher-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Contoh: HEMAT10"
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          {loading && (
            <p role="status" className="text-sm text-muted-foreground">
              Memuat voucher…
            </p>
          )}
          {!loading &&
            filteredVouchers.map((voucher) => (
              <Card key={voucher.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-52 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{voucher.code}</h3>
                      <Badge
                        variant={voucher.is_active ? "default" : "secondary"}
                      >
                        {voucher.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm">
                      {voucher.name} ·{" "}
                      {voucher.discount_type === "PERCENT"
                        ? `${voucher.discount_value}%`
                        : money(voucher.discount_value)}
                      {voucher.max_discount !== null &&
                      voucher.discount_type === "PERCENT"
                        ? ` maks. ${money(voucher.max_discount)}`
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Min. {money(voucher.min_transaction)} ·{" "}
                      {voucher.quota === null
                        ? "Tanpa batas kuota"
                        : `${voucher.used_count} terpakai + ${voucher.reservedCount} dipesan / ${voucher.quota}`}{" "}
                      · {voucher.starts_on}–{voucher.ends_on} ·{" "}
                      {voucher.starts_time.slice(0, 5)}–
                      {voucher.ends_time.slice(0, 5)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {voucher.categoryIds.length
                        ? voucher.categoryIds.map(categoryName).join(", ")
                        : "Semua kategori"}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => openEditor(voucher)}>
                    Ubah
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setToDelete(voucher)}
                  >
                    {voucher.used_count || voucher.reservedCount
                      ? "Nonaktifkan"
                      : "Hapus"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          {!loading && !filteredVouchers.length && !error && (
            <p className="rounded-lg bg-secondary p-8 text-center text-sm text-muted-foreground">
              {search
                ? "Tidak ada voucher yang cocok dengan pencarian."
                : "Belum ada voucher."}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Ubah voucher" : "Tambah voucher"}
            </DialogTitle>
            <DialogDescription>
              Kode dan kelayakan voucher akan divalidasi kembali saat order
              dibuat.
            </DialogDescription>
          </DialogHeader>
          <form id="voucher-form" onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="voucher-code">Kode voucher</Label>
                <Input
                  id="voucher-code"
                  required
                  maxLength={40}
                  value={draft.code}
                  onChange={(event) =>
                    setField("code", event.target.value.toUpperCase())
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voucher-name">Nama</Label>
                <Input
                  id="voucher-name"
                  required
                  maxLength={120}
                  value={draft.name}
                  onChange={(event) => setField("name", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voucher-type">Jenis diskon</Label>
                <Select
                  value={draft.discountType}
                  onValueChange={(value) =>
                    setField("discountType", value as Draft["discountType"])
                  }
                >
                  <SelectTrigger id="voucher-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Persentase</SelectItem>
                    <SelectItem value="FIXED">Nominal tetap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="voucher-value">
                  {draft.discountType === "PERCENT"
                    ? "Persentase (%)"
                    : "Nominal diskon (Rp)"}
                </Label>
                <Input
                  id="voucher-value"
                  required
                  type="number"
                  min="1"
                  max={draft.discountType === "PERCENT" ? "100" : undefined}
                  value={draft.discountValue}
                  onChange={(event) =>
                    setField("discountValue", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voucher-minimum">Minimum transaksi (Rp)</Label>
                <Input
                  id="voucher-minimum"
                  required
                  type="number"
                  min="0"
                  value={draft.minTransaction}
                  onChange={(event) =>
                    setField("minTransaction", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voucher-cap">
                  Batas diskon maksimum (Rp, opsional)
                </Label>
                <Input
                  id="voucher-cap"
                  type="number"
                  min="1"
                  value={draft.maxDiscount}
                  onChange={(event) =>
                    setField("maxDiscount", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voucher-quota">
                  Kuota (kosong = tanpa batas)
                </Label>
                <Input
                  id="voucher-quota"
                  type="number"
                  min="1"
                  value={draft.quota}
                  onChange={(event) => setField("quota", event.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Checkbox
                  id="voucher-active"
                  checked={draft.isActive}
                  onCheckedChange={(checked) =>
                    setField("isActive", checked === true)
                  }
                />
                <Label htmlFor="voucher-active">Voucher aktif</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="voucher-start-date">Tanggal mulai (WIB)</Label>
                <Input
                  id="voucher-start-date"
                  type="date"
                  required
                  value={draft.startsOn}
                  onChange={(event) => setField("startsOn", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voucher-end-date">Tanggal akhir (WIB)</Label>
                <Input
                  id="voucher-end-date"
                  type="date"
                  required
                  value={draft.endsOn}
                  onChange={(event) => setField("endsOn", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voucher-start-time">
                  Jam mulai harian (WIB)
                </Label>
                <Input
                  id="voucher-start-time"
                  type="time"
                  required
                  value={draft.startsTime}
                  onChange={(event) =>
                    setField("startsTime", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voucher-end-time">Jam akhir harian (WIB)</Label>
                <Input
                  id="voucher-end-time"
                  type="time"
                  required
                  value={draft.endsTime}
                  onChange={(event) => setField("endsTime", event.target.value)}
                />
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Kategori yang memenuhi syarat
              </legend>
              <p className="text-xs text-muted-foreground">
                Tanpa pilihan, voucher berlaku untuk semua kategori.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {categories.map((category) => (
                  <label
                    key={category.id}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm"
                  >
                    <Checkbox
                      checked={draft.categoryIds.includes(category.id)}
                      onCheckedChange={(checked) =>
                        setField(
                          "categoryIds",
                          checked
                            ? [...draft.categoryIds, category.id]
                            : draft.categoryIds.filter(
                                (id) => id !== category.id,
                              ),
                        )
                      }
                    />
                    <span>
                      {category.name}
                      {!category.is_active ? " (Nonaktif)" : ""}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" form="voucher-form" disabled={busy}>
              {editing ? "Simpan perubahan" : "Buat voucher"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus atau nonaktifkan voucher?</AlertDialogTitle>
            <AlertDialogDescription>
              Voucher {toDelete?.code} akan dihapus jika belum pernah dipakai
              dan tidak memiliki order aktif. Jika memiliki pemakaian atau order
              aktif, voucher hanya dinonaktifkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void removeVoucher();
              }}
            >
              Lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
