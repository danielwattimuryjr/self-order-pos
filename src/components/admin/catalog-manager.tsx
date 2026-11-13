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
  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [draggedMenu, setDraggedMenu] = useState<string | null>(null);

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

  // Initial state is loaded from the API, an external system.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((error: unknown) =>
      setMessage(error instanceof Error ? error.message : "Gagal memuat data."),
    ).finally(() => setInitialLoading(false));
  }, [load]);

  if (initialLoading) return (
    <section aria-busy="true" aria-label="Memuat kategori dan menu" className="mt-6 space-y-6">
      <span className="sr-only" role="status">Memuat kategori dan menu…</span>
      {["categories", "menus"].map((section) => (
        <div key={section} aria-hidden="true" className="space-y-3 rounded-xl border bg-card p-5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-2/3" />
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-12 w-full" />)}
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
      setMessage(result.message ?? "Terjadi kesalahan.");
      if (response.ok) await load();
      return response.ok;
    } catch {
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
    setSelectedTemplateId("");
    setShowTemplatePreview(false);
    setDraft({
      category_id: first.id,
      name: "",
      description: "",
      price: 0,
      image_path: null,
      is_active: true,
      sort_order: menus.filter((menu) => menu.category_id === first.id).length,
      configuration: emptyConfiguration,
    });
  }

  function editMenu(menu: Menu) {
    setSelectedTemplateId("");
    setShowTemplatePreview(false);
    setImagePreview(menu.image_path ? imageUrl(menu.image_path) : "");
    setDraft({
      id: menu.id,
      category_id: menu.category_id,
      name: menu.name,
      description: menu.description,
      price: menu.price,
      image_path: menu.image_path,
      is_active: menu.is_active,
      sort_order: menu.sort_order,
      configuration: menu.configuration,
    });
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
      setMessage(result.message ?? "Foto belum dapat diunggah.");
      if (response.ok) {
        setDraft((current) =>
          current ? { ...current, image_path: result.data.path } : current,
        );
        setImagePreview(result.data.publicUrl);
      }
    } catch {
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
    <div aria-busy={busy || uploadingImage || undefined} className="mt-6 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Kategori</CardTitle>

          <CardAction>
            <Button onClick={() => openCategoryDialog()}>
              Tambah kategori
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
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
                <span className="min-w-20 flex-1 font-medium">
                  {category.name}{" "}
                  <span className="font-normal text-neutral-500">
                    ({category.menuCount ?? 0} menu{" "}
                    {category.is_active ? "Aktif" : "Nonaktif"})
                  </span>
                </span>
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
                  ↑
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
                  ↓
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
              Kategori “{categoryToDelete?.name}” hanya dapat dihapus jika tidak
              memiliki menu.
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
        <CardHeader className="flex-row items-center justify-between">
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
            <p role="status" className="mt-3 text-sm text-neutral-700">
              {message}
            </p>
          )}
          <div className="mt-4 space-y-3">
            {menus.map((menu, index) => (
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
                className="flex flex-wrap items-center gap-3 p-3"
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
                  <p className="text-sm text-muted-foreground">
                    {menu.categoryName} · {rupiah.format(menu.price)} ·{" "}
                    {menu.is_active ? "Aktif" : "Nonaktif"}
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
                  onClick={() => {
                    const inCategory = menus.filter(
                      (item) => item.category_id === menu.category_id,
                    );
                    const position = inCategory.findIndex(
                      (item) => item.id === menu.id,
                    );
                    const other = inCategory[position - 1];
                    if (other) void reorderMenu(menu.id, other.id);
                  }}
                  disabled={
                    busy || !menus
                      .slice(0, index)
                      .some((item) => item.category_id === menu.category_id)
                  }
                  aria-label="Naikkan urutan menu"
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const inCategory = menus.filter(
                      (item) => item.category_id === menu.category_id,
                    );
                    const position = inCategory.findIndex(
                      (item) => item.id === menu.id,
                    );
                    const other = inCategory[position + 1];
                    if (other) void reorderMenu(menu.id, other.id);
                  }}
                  disabled={
                    busy || !menus
                      .slice(index + 1)
                      .some((item) => item.category_id === menu.category_id)
                  }
                  aria-label="Turunkan urutan menu"
                >
                  ↓
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
            {!menus.length && (
              <p className="rounded-lg bg-secondary p-6 text-center text-sm text-muted-foreground">
                Belum ada menu.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
      >
        {draft && (
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
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
              <DialogHeader>
                <DialogTitle>
                  {draft.id ? "Edit menu" : "Menu baru"}
                </DialogTitle>
                <DialogDescription>
                  Atur informasi menu dan opsi yang dapat dipilih pelanggan.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
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
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox
                    id="menu-active"
                    checked={draft.is_active}
                    onCheckedChange={(checked) =>
                      setDraft({ ...draft, is_active: checked === true })
                    }
                  />
                  <Label htmlFor="menu-active">Menu aktif</Label>
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
                  {uploadingImage && <p role="status" className="text-xs text-muted-foreground">Mengunggah foto…</p>}
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
                      onClick={() =>
                        setShowTemplatePreview(!showTemplatePreview)
                      }
                    >
                      {showTemplatePreview
                        ? "Tutup pratinjau"
                        : "Lihat pratinjau"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!draft.id || busy}
                      onClick={() => void saveDraftAsTemplate()}
                    >
                      Simpan sebagai template
                    </Button>
                    {draft.id && (
                      <Button
                        type="button"
                        disabled={!selectedTemplateId || busy}
                        onClick={() => void applyTemplateToDraft()}
                      >
                        Terapkan template
                      </Button>
                    )}
                  </div>
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
              <ConfigurationEditor
                value={draft.configuration}
                onChange={(configuration) =>
                  setDraft({ ...draft, configuration })
                }
              />
              {draft.configuration.variants.filter((group) =>
                group.options.some(
                  (option) => option.pricingMode === "OVERRIDE",
                ),
              ).length > 1 && (
                <p role="alert" className="text-sm text-destructive">
                  Hanya satu grup varian boleh menggunakan harga override.
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDraft(null)}
                >
                  Batal
                </Button>
                <Button type="submit" loading={busy}>
                  Simpan menu
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

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
        open={applyTemplateConfirmation}
        onOpenChange={setApplyTemplateConfirmation}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ganti konfigurasi menu?</AlertDialogTitle>
            <AlertDialogDescription>
              Konfigurasi menu {draft?.name} akan diganti sesuai mode yang
              dipilih.
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
