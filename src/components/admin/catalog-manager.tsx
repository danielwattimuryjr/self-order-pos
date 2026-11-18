"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfigurationEditor } from "@/components/admin/configuration-editor";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { MenuConfiguration } from "@/lib/catalog/built-in-templates";
import Image from "next/image";

type Category = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  menuCount?: number;
};
type Menu = {
  id: string;
  category_id: string;
  categoryName: string;
  name: string;
  description: string;
  price: number;
  image_path: string | null;
  is_active: boolean;
  sort_order: number;
  configuration: MenuConfiguration;
};
type TemplateOption = {
  id: string;
  name: string;
  configuration: MenuConfiguration;
  source?: string;
};
type MenuDraft = Omit<Menu, "id" | "categoryName"> & {
  id?: string;
  categoryName?: string;
};
const emptyConfiguration: MenuConfiguration = { variants: [], addons: [] };
const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function CatalogManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [applyMode, setApplyMode] = useState<"REPLACE_ALL" | "REPLACE_BY_TYPE">(
    "REPLACE_ALL",
  );
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategoryFilter, setMenuCategoryFilter] = useState("ALL");
  const [menuStatusFilter, setMenuStatusFilter] = useState("ALL");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(
    null,
  );
  const [menuToDelete, setMenuToDelete] = useState<Menu | null>(null);
  const [applyTemplateConfirmation, setApplyTemplateConfirmation] =
    useState(false);
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [draft, setDraft] = useState<MenuDraft | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [draggedMenu, setDraggedMenu] = useState<string | null>(null);
  const [confirmDraftDiscard, setConfirmDraftDiscard] = useState(false);
  const [originalDraft, setOriginalDraft] = useState("");

  const load = useCallback(async () => {
    const [categoryResponse, menuResponse, templateResponse] =
      await Promise.all([
        fetch("/api/v1/admin/categories", { cache: "no-store" }),
        fetch("/api/v1/admin/menus", { cache: "no-store" }),
        fetch("/api/v1/admin/templates", { cache: "no-store" }),
      ]);
    const categoryResult = await categoryResponse.json();
    const menuResult = await menuResponse.json();
    const templateResult = await templateResponse.json();
    if (!categoryResponse.ok || !menuResponse.ok || !templateResponse.ok)
      throw new Error("Data kategori, menu, dan template belum dapat dimuat.");
    setCategories(categoryResult.data);
    setMenus(menuResult.data);
    setTemplates([
      ...templateResult.data.builtIns,
      ...templateResult.data.custom,
    ]);
  }, []);
  const filteredMenus = menus.filter((menu) => {
    const matchesSearch =
      `${menu.name} ${menu.description} ${menu.categoryName}`
        .toLocaleLowerCase("id-ID")
        .includes(menuSearch.trim().toLocaleLowerCase("id-ID"));
    const matchesCategory =
      menuCategoryFilter === "ALL" || menu.category_id === menuCategoryFilter;
    const matchesStatus =
      menuStatusFilter === "ALL" ||
      (menuStatusFilter === "ACTIVE" ? menu.is_active : !menu.is_active);
    return matchesSearch && matchesCategory && matchesStatus;
  });
  const hasUnsavedDraftChanges = Boolean(
    draft && JSON.stringify(draft) !== originalDraft,
  );

  // Initial state is loaded from the API, an external system.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
      .catch((error: unknown) => {
        setMessageIsError(true);
        setMessage(
          error instanceof Error ? error.message : "Gagal memuat data.",
        );
      })
      .finally(() => setInitialLoading(false));
  }, [load]);

  async function retryLoad() {
    setInitialLoading(true);
    try {
      await load();
      setMessage("");
      setMessageIsError(false);
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "Gagal memuat data.");
    } finally {
      setInitialLoading(false);
    }
  }

  if (initialLoading)
    return (
      <section
        aria-busy="true"
        aria-label="Memuat kategori dan menu"
        className="mt-6 space-y-6"
      >
        <span className="sr-only" role="status">
          Memuat kategori dan menu…
        </span>
        {["categories", "menus"].map((section) => (
          <div
            key={section}
            aria-hidden="true"
            className="space-y-3 rounded-xl border bg-card p-5"
          >
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-2/3" />
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-12 w-full" />
            ))}
          </div>
        ))}
      </section>
    );

  async function mutate(url: string, method: string, body?: unknown) {
    if (busy) return false;
    setBusy(true);
    try {
      const response = await fetch(url, {
        method,
        headers:
          body === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const result = await response.json();
      setMessageIsError(!response.ok);
      setMessage(result.message ?? "Terjadi kesalahan.");
      if (response.ok) await load();
      return response.ok;
    } catch {
      setMessageIsError(true);
      setMessage("Terjadi kesalahan saat menyimpan perubahan.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function newMenu() {
    const first = categories.find((category) => category.is_active);
    if (!first) {
      setMessage("Buat kategori aktif terlebih dahulu.");
      return;
    }
    setImagePreview("");
    setMessage("");
    setMessageIsError(false);
    setSelectedTemplateId("");
    setShowTemplatePreview(false);
    const nextDraft: MenuDraft = {
      category_id: first.id,
      name: "",
      description: "",
      price: 0,
      image_path: null,
      is_active: true,
      sort_order: menus.filter((menu) => menu.category_id === first.id).length,
      configuration: emptyConfiguration,
    };
    setOriginalDraft(JSON.stringify(nextDraft));
    setDraft(nextDraft);
  }

  function editMenu(menu: Menu) {
    setSelectedTemplateId("");
    setShowTemplatePreview(false);
    setImagePreview(menu.image_path ? imageUrl(menu.image_path) : "");
    setMessage("");
    setMessageIsError(false);
    const nextDraft: MenuDraft = {
      id: menu.id,
      category_id: menu.category_id,
      name: menu.name,
      description: menu.description,
      price: menu.price,
      image_path: menu.image_path,
      is_active: menu.is_active,
      sort_order: menu.sort_order,
      configuration: menu.configuration,
    };
    setOriginalDraft(JSON.stringify(nextDraft));
    setDraft(nextDraft);
  }

  function requestCloseDraft() {
    if (hasUnsavedDraftChanges) {
      setConfirmDraftDiscard(true);
      return;
    }
    setDraft(null);
  }

  function moveMenu(menuId: string, direction: -1 | 1) {
    const menu = menus.find((item) => item.id === menuId);
    if (!menu) return;
    const sameCategory = menus.filter(
      (item) => item.category_id === menu.category_id,
    );
    const position = sameCategory.findIndex((item) => item.id === menuId);
    const neighbor = sameCategory[position + direction];
    if (neighbor) void reorderMenu(menu.id, neighbor.id);
  }

  function canMoveMenu(menuId: string, direction: -1 | 1) {
    const menu = menus.find((item) => item.id === menuId);
    if (!menu) return false;
    const sameCategory = menus.filter(
      (item) => item.category_id === menu.category_id,
    );
    const position = sameCategory.findIndex((item) => item.id === menuId);
    return Boolean(sameCategory[position + direction]);
  }

  async function uploadImage(file: File) {
    if (uploadingImage) return;
    setUploadingImage(true);
    const form = new FormData();
    form.set("file", file);
    try {
      const response = await fetch("/api/v1/admin/menus/image", {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      setMessageIsError(!response.ok);
      setMessage(result.message ?? "Foto belum dapat diunggah.");
      if (response.ok) {
        setDraft((current) =>
          current ? { ...current, image_path: result.data.path } : current,
        );
        setImagePreview(result.data.publicUrl);
      }
    } catch {
      setMessageIsError(true);
      setMessage("Terjadi kesalahan saat mengunggah foto.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function applyTemplateToDraft() {
    if (!draft?.id || !selectedTemplateId) {
      setMessage("Simpan menu terlebih dahulu, lalu pilih template.");
      return;
    }
    const existing =
      draft.configuration.variants.length + draft.configuration.addons.length >
      0;
    if (existing) {
      setApplyTemplateConfirmation(true);
      return;
    }
    if (
      await mutate(`/api/v1/admin/menus/${draft.id}/apply-template`, "POST", {
        templateId: selectedTemplateId,
        mode: applyMode,
        confirmed: true,
      })
    )
      setDraft(null);
  }

  async function confirmApplyTemplate() {
    if (!draft?.id || !selectedTemplateId) return;
    const applied = await mutate(
      `/api/v1/admin/menus/${draft.id}/apply-template`,
      "POST",
      { templateId: selectedTemplateId, mode: applyMode, confirmed: true },
    );
    setApplyTemplateConfirmation(false);
    if (applied) setDraft(null);
  }

  async function saveDraftAsTemplate() {
    if (!draft?.id) {
      setMessage("Simpan menu terlebih dahulu sebelum membuat template.");
      return;
    }
    setTemplateName(`${draft.name} — konfigurasi`);
    setSaveTemplateDialogOpen(true);
  }

  async function submitSaveDraftAsTemplate(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (!draft?.id || !templateName.trim()) return;
    if (
      await mutate("/api/v1/admin/templates/from-menu", "POST", {
        menuId: draft.id,
        name: templateName.trim(),
      })
    )
      setSaveTemplateDialogOpen(false);
  }

  function imageUrl(path: string) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu-images/${path}`;
  }

  async function reorderCategory(sourceId: string, targetId: string) {
    const next = [...categories];
    const source = next.findIndex((item) => item.id === sourceId);
    const target = next.findIndex((item) => item.id === targetId);
    if (source < 0 || target < 0) return;
    const [item] = next.splice(source, 1);
    next.splice(target, 0, item);
    await mutate("/api/v1/admin/categories/reorder", "PATCH", {
      ids: next.map((category) => category.id),
    });
  }

  async function reorderMenu(sourceId: string, targetId: string) {
    const sourceMenu = menus.find((item) => item.id === sourceId);
    const targetMenu = menus.find((item) => item.id === targetId);
    if (
      !sourceMenu ||
      !targetMenu ||
      sourceMenu.category_id !== targetMenu.category_id
    )
      return;
    const next = menus.filter(
      (item) => item.category_id === sourceMenu.category_id,
    );
    const source = next.findIndex((item) => item.id === sourceId);
    const target = next.findIndex((item) => item.id === targetId);
    const [item] = next.splice(source, 1);
    next.splice(target, 0, item);
    await mutate("/api/v1/admin/menus/reorder", "PATCH", {
      categoryId: sourceMenu.category_id,
      ids: next.map((menu) => menu.id),
    });
  }

  function openCategoryDialog(category?: Category) {
    setEditingCategory(category ?? null);
    setCategoryName(category?.name ?? "");
    setCategoryDialogOpen(true);
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await mutate(
      editingCategory
        ? `/api/v1/admin/categories/${editingCategory.id}`
        : "/api/v1/admin/categories",
      editingCategory ? "PATCH" : "POST",
      { name: categoryName },
    );
    if (saved) {
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryName("");
    }
  }

  return (
    <div
      aria-busy={busy || uploadingImage || undefined}
      className="mt-6 space-y-8"
    >
      <div hidden={Boolean(draft)} className="space-y-8">
        <Card>
          <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center">
            <CardTitle>Kategori</CardTitle>

            <CardAction>
              <Button onClick={() => openCategoryDialog()}>
                Tambah kategori
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Kategori nonaktif menyembunyikan semua menu di dalamnya dari
              katalog pelanggan.
            </p>
            <ul className="divide-y">
              {categories.map((category, index) => (
                <li
                  key={category.id}
                  draggable
                  onDragStart={() => setDraggedCategory(category.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedCategory && draggedCategory !== category.id)
                      void reorderCategory(draggedCategory, category.id);
                    setDraggedCategory(null);
                  }}
                  className="flex flex-wrap items-center gap-2 py-3 text-sm"
                >
                  <div className="min-w-40 flex-1 space-y-1">
                    <p className="font-medium">{category.name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{category.menuCount ?? 0} menu</span>
                      <Badge
                        variant={category.is_active ? "default" : "outline"}
                      >
                        {category.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openCategoryDialog(category)}
                  >
                    Ubah
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        `/api/v1/admin/categories/${category.id}`,
                        "PATCH",
                        { isActive: !category.is_active },
                      )
                    }
                  >
                    {category.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const next = categories[index - 1];
                      if (next) void reorderCategory(category.id, next.id);
                    }}
                    disabled={busy || index === 0}
                    aria-label="Naikkan urutan kategori"
                  >
                    ↑ Naikkan
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const next = categories[index + 1];
                      if (next) void reorderCategory(category.id, next.id);
                    }}
                    disabled={busy || index === categories.length - 1}
                    aria-label="Turunkan urutan kategori"
                  >
                    ↓ Turunkan
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setCategoryToDelete(category)}
                  >
                    Hapus
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Dialog
          open={categoryDialogOpen}
          onOpenChange={(open) => {
            setCategoryDialogOpen(open);
            if (!open) setEditingCategory(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? "Ubah kategori" : "Tambah kategori"}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? "Ubah nama kategori menu."
                  : "Buat kategori untuk mengelompokkan menu."}
              </DialogDescription>
            </DialogHeader>
            <form
              id="category-form"
              className="space-y-2"
              onSubmit={saveCategory}
            >
              <Label htmlFor="category-name">Nama kategori</Label>
              <Input
                id="category-name"
                required
                maxLength={100}
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                autoFocus
              />
            </form>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCategoryDialogOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" form="category-form" loading={busy}>
                {editingCategory ? "Simpan perubahan" : "Tambah kategori"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={categoryToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setCategoryToDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus kategori?</AlertDialogTitle>
              <AlertDialogDescription>
                Kategori “{categoryToDelete?.name}” hanya dapat dihapus jika
                tidak memiliki menu.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  const category = categoryToDelete;
                  setCategoryToDelete(null);
                  if (category)
                    void mutate(
                      `/api/v1/admin/categories/${category.id}`,
                      "DELETE",
                    );
                }}
              >
                Hapus kategori
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Card>
          <CardHeader className="flex-col items-start gap-3 sm:flex-row sm:items-center">
            <CardTitle>Menu</CardTitle>
            <CardDescription>
              Menu dalam kategori nonaktif tidak tampil di katalog pelanggan.
            </CardDescription>
            <CardAction>
              <Button onClick={newMenu} disabled={!categories.length}>
                Tambah menu
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {message && (
              <div
                role={messageIsError ? "alert" : "status"}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${messageIsError ? "bg-destructive/5 text-destructive" : "bg-muted text-foreground"}`}
              >
                <span>{message}</span>
                {messageIsError && !categories.length && !menus.length && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void retryLoad()}
                  >
                    Coba lagi
                  </Button>
                )}
              </div>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_12rem_12rem_auto] xl:items-end">
              <div className="space-y-2">
                <Label htmlFor="menu-search">Cari menu</Label>
                <Input
                  id="menu-search"
                  value={menuSearch}
                  onChange={(event) => setMenuSearch(event.target.value)}
                  placeholder="Nama, deskripsi, atau kategori"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="menu-category-filter">Kategori</Label>
                <Select
                  value={menuCategoryFilter}
                  onValueChange={setMenuCategoryFilter}
                >
                  <SelectTrigger id="menu-category-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua kategori</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="menu-status-filter">Status</Label>
                <Select
                  value={menuStatusFilter}
                  onValueChange={setMenuStatusFilter}
                >
                  <SelectTrigger id="menu-status-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua status</SelectItem>
                    <SelectItem value="ACTIVE">Aktif</SelectItem>
                    <SelectItem value="INACTIVE">Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p
                className="pb-2 text-sm text-muted-foreground"
                aria-live="polite"
              >
                {filteredMenus.length} dari {menus.length} menu
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Urutkan dengan tarik dan lepas atau gunakan Naikkan/Turunkan.
                Perubahan urutan berlaku pada katalog pelanggan.
                {(menuSearch.trim() ||
                  menuCategoryFilter !== "ALL" ||
                  menuStatusFilter !== "ALL") &&
                  " Hapus filter untuk mengubah urutan."}
              </p>
              {(menuSearch ||
                menuCategoryFilter !== "ALL" ||
                menuStatusFilter !== "ALL") && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setMenuSearch("");
                    setMenuCategoryFilter("ALL");
                    setMenuStatusFilter("ALL");
                  }}
                >
                  Hapus filter
                </Button>
              )}
            </div>
            <div className="mt-4 space-y-3">
              {filteredMenus.map((menu) => (
                <Card
                  key={menu.id}
                  draggable
                  onDragStart={() => setDraggedMenu(menu.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedMenu && draggedMenu !== menu.id)
                      void reorderMenu(draggedMenu, menu.id);
                    setDraggedMenu(null);
                  }}
                  className="flex flex-row flex-wrap items-center gap-3 p-3"
                >
                  <Image
                    src={
                      menu.image_path
                        ? imageUrl(menu.image_path)
                        : "https://placehold.co/400"
                    }
                    alt={menu.name}
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 rounded object-cover"
                  />

                  <div className="min-w-40 flex-1">
                    <h3 className="font-medium">{menu.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      <span>{menu.categoryName}</span>
                      <span aria-hidden="true">·</span>
                      <span>Harga dasar {rupiah.format(menu.price)}</span>
                      <Badge variant={menu.is_active ? "default" : "outline"}>
                        {menu.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Harga dan ketersediaan ini berlaku untuk pesanan baru.
                      Riwayat pesanan tetap memakai snapshot transaksi.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => editMenu(menu)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void mutate(`/api/v1/admin/menus/${menu.id}`, "PATCH", {
                        categoryId: menu.category_id,
                        name: menu.name,
                        description: menu.description,
                        price: menu.price,
                        imagePath: menu.image_path,
                        isActive: !menu.is_active,
                        sortOrder: menu.sort_order,
                        configuration: menu.configuration,
                      })
                    }
                  >
                    {menu.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveMenu(menu.id, -1)}
                    disabled={
                      busy ||
                      Boolean(
                        menuSearch ||
                        menuCategoryFilter !== "ALL" ||
                        menuStatusFilter !== "ALL",
                      ) ||
                      !canMoveMenu(menu.id, -1)
                    }
                    aria-label={`Naikkan urutan ${menu.name}`}
                  >
                    ↑ Naikkan
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => moveMenu(menu.id, 1)}
                    disabled={
                      busy ||
                      Boolean(
                        menuSearch ||
                        menuCategoryFilter !== "ALL" ||
                        menuStatusFilter !== "ALL",
                      ) ||
                      !canMoveMenu(menu.id, 1)
                    }
                    aria-label={`Turunkan urutan ${menu.name}`}
                  >
                    ↓ Turunkan
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setMenuToDelete(menu)}
                  >
                    Hapus
                  </Button>
                </Card>
              ))}
              {!filteredMenus.length && (
                <p className="rounded-lg bg-secondary p-6 text-center text-sm text-muted-foreground">
                  {menus.length
                    ? "Tidak ada menu yang cocok dengan pencarian atau filter."
                    : "Belum ada menu."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {draft && (
        <section className="space-y-6" aria-labelledby="menu-editor-title">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
            <div className="space-y-1">
              <h2 id="menu-editor-title" className="text-2xl font-semibold">
                {draft.id ? "Edit menu" : "Menu baru"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Informasi dan pilihan menu yang dilihat pelanggan.
              </p>
              {hasUnsavedDraftChanges && (
                <p role="status" className="text-sm text-warning">
                  Perubahan belum disimpan.
                </p>
              )}
              {message && (
                <p
                  role={messageIsError ? "alert" : "status"}
                  className={
                    messageIsError
                      ? "text-sm text-destructive"
                      : "text-sm text-success"
                  }
                >
                  {message}
                </p>
              )}
            </div>
            <Button type="button" variant="outline" onClick={requestCloseDraft}>
              Kembali ke katalog
            </Button>
          </header>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const body = {
                categoryId: draft.category_id,
                name: draft.name,
                description: draft.description,
                price: draft.price,
                imagePath: draft.image_path,
                isActive: draft.is_active,
                sortOrder: draft.sort_order,
                configuration: draft.configuration,
              };
              if (
                await mutate(
                  draft.id
                    ? `/api/v1/admin/menus/${draft.id}`
                    : "/api/v1/admin/menus",
                  draft.id ? "PATCH" : "POST",
                  body,
                )
              )
                setDraft(null);
            }}
            className="space-y-5"
          >
            <section aria-labelledby="basic-menu-heading" className="space-y-4">
              <h3 id="basic-menu-heading" className="text-lg font-semibold">
                Informasi dasar
              </h3>
              <div className="grid max-w-4xl gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="menu-name">Nama menu</Label>
                  <Input
                    id="menu-name"
                    required
                    maxLength={160}
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menu-category">Kategori</Label>
                  <Select
                    value={draft.category_id}
                    onValueChange={(target) =>
                      setDraft({
                        ...draft,
                        category_id: target,
                        sort_order: menus.filter(
                          (menu) => menu.category_id === target,
                        ).length,
                      })
                    }
                  >
                    <SelectTrigger id="menu-category">
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                          {!category.is_active ? " (Nonaktif)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 border-t pt-3 md:col-span-2">
                  <h4 className="font-medium">Harga dan ketersediaan</h4>
                  <p className="text-sm text-muted-foreground">
                    Perubahan berlaku untuk pesanan baru. Riwayat pesanan
                    mempertahankan snapshot transaksi.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menu-price">Harga dasar (Rp)</Label>
                  <Input
                    id="menu-price"
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={draft.price}
                    onChange={(event) =>
                      setDraft({ ...draft, price: Number(event.target.value) })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Harga untuk pesanan baru. Order historis tetap menggunakan
                    snapshot harga saat transaksi.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox
                    id="menu-active"
                    checked={draft.is_active}
                    onCheckedChange={(checked) =>
                      setDraft({ ...draft, is_active: checked === true })
                    }
                  />
                  <Label htmlFor="menu-active">
                    Tersedia di katalog pelanggan
                  </Label>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="menu-description">Deskripsi</Label>
                  <Textarea
                    id="menu-description"
                    rows={3}
                    maxLength={2000}
                    value={draft.description}
                    onChange={(event) =>
                      setDraft({ ...draft, description: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 text-sm md:col-span-2">
                  <h4 className="font-medium">Foto menu</h4>
                  <Label htmlFor="menu-image">
                    Foto menu (JPG, PNG, WebP; maks 2 MB)
                  </Label>
                  <Input
                    id="menu-image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploadingImage || busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadImage(file);
                    }}
                  />
                  {uploadingImage && (
                    <p role="status" className="text-xs text-muted-foreground">
                      Mengunggah foto…
                    </p>
                  )}
                  {imagePreview && (
                    <div className="mt-2 flex items-center gap-3">
                      <Image
                        src={imagePreview}
                        alt="Pratinjau foto menu"
                        width={96}
                        height={96}
                        unoptimized
                        className="h-24 w-24 rounded object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setDraft({ ...draft, image_path: null });
                          setImagePreview("");
                        }}
                      >
                        Hapus foto
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Menu nonaktif atau yang berada dalam kategori nonaktif tidak
                dapat dipesan pelanggan.
              </p>
            </section>
            <ConfigurationEditor
              value={draft.configuration}
              onChange={(configuration) =>
                setDraft({ ...draft, configuration })
              }
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Template konfigurasi
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Menerapkan template akan menyalin konfigurasi ke menu ini.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="menu-template">Pilih template</Label>
                    <Select
                      value={selectedTemplateId}
                      onValueChange={(value) => {
                        setSelectedTemplateId(value);
                        setShowTemplatePreview(false);
                      }}
                    >
                      <SelectTrigger id="menu-template">
                        <SelectValue placeholder="Pilih template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                            {template.source ? " · bawaan" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-mode">Mode</Label>
                    <Select
                      value={applyMode}
                      onValueChange={(value) =>
                        setApplyMode(value as typeof applyMode)
                      }
                    >
                      <SelectTrigger id="template-mode">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="REPLACE_ALL">
                          Ganti seluruh konfigurasi
                        </SelectItem>
                        <SelectItem value="REPLACE_BY_TYPE">
                          Ganti berdasarkan jenis
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!selectedTemplateId}
                    onClick={() => setShowTemplatePreview(!showTemplatePreview)}
                  >
                    {showTemplatePreview
                      ? "Tutup pratinjau"
                      : "Lihat pratinjau"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!draft.id || busy || hasUnsavedDraftChanges}
                    onClick={() => void saveDraftAsTemplate()}
                  >
                    Simpan sebagai template
                  </Button>
                  {draft.id && (
                    <Button
                      type="button"
                      disabled={
                        !selectedTemplateId || busy || hasUnsavedDraftChanges
                      }
                      onClick={() => void applyTemplateToDraft()}
                    >
                      Terapkan template
                    </Button>
                  )}
                </div>
                {hasUnsavedDraftChanges && (
                  <p className="text-sm text-muted-foreground">
                    Simpan menu terlebih dahulu agar template memakai
                    konfigurasi terkini.
                  </p>
                )}
                {showTemplatePreview && selectedTemplateId && (
                  <div className="rounded-md bg-secondary p-3 text-sm">
                    <p className="font-medium">
                      {
                        templates.find(
                          (template) => template.id === selectedTemplateId,
                        )?.name
                      }
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {templates.find(
                        (template) => template.id === selectedTemplateId,
                      )?.configuration.variants.length ?? 0}{" "}
                      grup varian dan{" "}
                      {templates.find(
                        (template) => template.id === selectedTemplateId,
                      )?.configuration.addons.length ?? 0}{" "}
                      grup add-on.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            {draft.configuration.variants.filter((group) =>
              group.options.some((option) => option.pricingMode === "OVERRIDE"),
            ).length > 1 && (
              <p role="alert" className="text-sm text-destructive">
                Hanya satu grup varian boleh menggunakan harga override.
              </p>
            )}
            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-background p-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={requestCloseDraft}
              >
                Kembali ke katalog
              </Button>
              <Button type="submit" loading={busy}>
                Simpan menu
              </Button>
            </div>
          </form>
        </section>
      )}

      <Dialog
        open={saveTemplateDialogOpen}
        onOpenChange={setSaveTemplateDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simpan menu sebagai template</DialogTitle>
            <DialogDescription>
              Template menyimpan salinan konfigurasi menu saat ini.
            </DialogDescription>
          </DialogHeader>
          <form
            id="save-template-form"
            className="space-y-2"
            onSubmit={submitSaveDraftAsTemplate}
          >
            <Label htmlFor="save-template-name">Nama template</Label>
            <Input
              id="save-template-name"
              required
              maxLength={120}
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
            />
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaveTemplateDialogOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" form="save-template-form" loading={busy}>
              Simpan template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmDraftDiscard}
        onOpenChange={setConfirmDraftDiscard}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Buang perubahan menu?</AlertDialogTitle>
            <AlertDialogDescription>
              Perubahan yang belum disimpan akan hilang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Kembali mengedit</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmDraftDiscard(false);
                setDraft(null);
              }}
            >
              Buang perubahan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={applyTemplateConfirmation}
        onOpenChange={setApplyTemplateConfirmation}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ganti konfigurasi menu?</AlertDialogTitle>
            <AlertDialogDescription>
              Template{" "}
              {
                templates.find((template) => template.id === selectedTemplateId)
                  ?.name
              }{" "}
              akan disalin ke menu {draft?.name}.{" "}
              {applyMode === "REPLACE_ALL"
                ? "Mode ini mengganti semua grup varian dan add-on yang ada."
                : "Mode ini mengganti jenis konfigurasi yang tersedia pada template dan mempertahankan jenis lainnya."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmApplyTemplate()}>
              Terapkan template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={menuToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setMenuToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus menu?</AlertDialogTitle>
            <AlertDialogDescription>
              Menu {menuToDelete?.name} dengan transaksi historis hanya dapat
              dinonaktifkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const menu = menuToDelete;
                setMenuToDelete(null);
                if (menu)
                  void mutate(`/api/v1/admin/menus/${menu.id}`, "DELETE");
              }}
            >
              Hapus menu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
