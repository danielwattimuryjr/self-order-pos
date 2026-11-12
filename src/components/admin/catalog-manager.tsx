"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfigurationEditor } from "@/components/admin/configuration-editor";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MenuConfiguration } from "@/lib/catalog/built-in-templates";

type Category = { id: string; name: string; sort_order: number; is_active: boolean; menuCount?: number };
type Menu = { id: string; category_id: string; categoryName: string; name: string; description: string; price: number; image_path: string | null; is_active: boolean; sort_order: number; configuration: MenuConfiguration };
type TemplateOption = { id: string; name: string; configuration: MenuConfiguration; source?: string };
type MenuDraft = Omit<Menu, "id" | "categoryName"> & { id?: string; categoryName?: string };
const emptyConfiguration: MenuConfiguration = { variants: [], addons: [] };
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function CatalogManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [applyMode, setApplyMode] = useState<"REPLACE_ALL" | "REPLACE_BY_TYPE">("REPLACE_ALL");
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [draft, setDraft] = useState<MenuDraft | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [draggedMenu, setDraggedMenu] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [categoryResponse, menuResponse, templateResponse] = await Promise.all([fetch("/api/v1/admin/categories", { cache: "no-store" }), fetch("/api/v1/admin/menus", { cache: "no-store" }), fetch("/api/v1/admin/templates", { cache: "no-store" })]);
    const categoryResult = await categoryResponse.json(); const menuResult = await menuResponse.json(); const templateResult = await templateResponse.json();
    if (!categoryResponse.ok || !menuResponse.ok || !templateResponse.ok) throw new Error("Data kategori, menu, dan template belum dapat dimuat.");
    setCategories(categoryResult.data);
    setMenus(menuResult.data);
    setTemplates([...templateResult.data.builtIns, ...templateResult.data.custom]);
  }, []);

  // Initial state is loaded from the API, an external system.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Gagal memuat data.")); }, [load]);

  async function mutate(url: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      const response = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const result = await response.json();
      setMessage(result.message ?? "Terjadi kesalahan.");
      if (response.ok) await load();
      return response.ok;
    } finally { setBusy(false); }
  }

  function newMenu() {
    const first = categories.find((category) => category.is_active);
    if (!first) { setMessage("Buat kategori aktif terlebih dahulu."); return; }
    setImagePreview("");
    setSelectedTemplateId(""); setShowTemplatePreview(false);
    setDraft({ category_id: first.id, name: "", description: "", price: 0, image_path: null, is_active: true, sort_order: menus.filter((menu) => menu.category_id === first.id).length, configuration: emptyConfiguration });
  }

  function editMenu(menu: Menu) {
    setSelectedTemplateId(""); setShowTemplatePreview(false);
    setImagePreview(menu.image_path ? imageUrl(menu.image_path) : "");
    setDraft({ id: menu.id, category_id: menu.category_id, name: menu.name, description: menu.description, price: menu.price, image_path: menu.image_path, is_active: menu.is_active, sort_order: menu.sort_order, configuration: menu.configuration });
  }

  async function uploadImage(file: File) {
    const form = new FormData(); form.set("file", file);
    const response = await fetch("/api/v1/admin/menus/image", { method: "POST", body: form });
    const result = await response.json();
    setMessage(result.message ?? "Foto belum dapat diunggah.");
    if (response.ok) { setDraft((current) => current ? { ...current, image_path: result.data.path } : current); setImagePreview(result.data.publicUrl); }
  }

  async function applyTemplateToDraft() {
    if (!draft?.id || !selectedTemplateId) { setMessage("Simpan menu terlebih dahulu, lalu pilih template."); return; }
    const existing = draft.configuration.variants.length + draft.configuration.addons.length > 0;
    const confirmed = !existing || window.confirm(`Konfigurasi menu ${draft.name} akan diganti sesuai mode yang dipilih. Lanjutkan?`);
    if (!confirmed) return;
    if (await mutate(`/api/v1/admin/menus/${draft.id}/apply-template`, "POST", { templateId: selectedTemplateId, mode: applyMode, confirmed })) setDraft(null);
  }

  async function saveDraftAsTemplate() {
    if (!draft?.id) { setMessage("Simpan menu terlebih dahulu sebelum membuat template."); return; }
    const name = window.prompt("Nama template", `${draft.name} — konfigurasi`);
    if (name?.trim()) await mutate("/api/v1/admin/templates/from-menu", "POST", { menuId: draft.id, name });
  }

  function imageUrl(path: string) { return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu-images/${path}`; }

  async function reorderCategory(sourceId: string, targetId: string) {
    const next = [...categories]; const source = next.findIndex((item) => item.id === sourceId); const target = next.findIndex((item) => item.id === targetId);
    if (source < 0 || target < 0) return;
    const [item] = next.splice(source, 1); next.splice(target, 0, item);
    await mutate("/api/v1/admin/categories/reorder", "PATCH", { ids: next.map((category) => category.id) });
  }

  async function reorderMenu(sourceId: string, targetId: string) {
    const sourceMenu = menus.find((item) => item.id === sourceId); const targetMenu = menus.find((item) => item.id === targetId);
    if (!sourceMenu || !targetMenu || sourceMenu.category_id !== targetMenu.category_id) return;
    const next = menus.filter((item) => item.category_id === sourceMenu.category_id);
    const source = next.findIndex((item) => item.id === sourceId); const target = next.findIndex((item) => item.id === targetId);
    const [item] = next.splice(source, 1); next.splice(target, 0, item);
    await mutate("/api/v1/admin/menus/reorder", "PATCH", { categoryId: sourceMenu.category_id, ids: next.map((menu) => menu.id) });
  }

  function openCategoryDialog(category?: Category) {
    setEditingCategory(category ?? null);
    setCategoryName(category?.name ?? "");
    setCategoryDialogOpen(true);
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await mutate(
      editingCategory ? `/api/v1/admin/categories/${editingCategory.id}` : "/api/v1/admin/categories",
      editingCategory ? "PATCH" : "POST",
      { name: categoryName },
    );
    if (saved) {
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryName("");
    }
  }

  return <div className="mt-6 space-y-8">
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Kategori</CardTitle>
        <Button onClick={() => openCategoryDialog()}>Tambah kategori</Button>
      </CardHeader>
      <CardContent>
      <ul className="divide-y">
        {categories.map((category, index) => <li key={category.id} draggable onDragStart={() => setDraggedCategory(category.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedCategory && draggedCategory !== category.id) void reorderCategory(draggedCategory, category.id); setDraggedCategory(null); }} className="flex flex-wrap items-center gap-2 py-3 text-sm">
          <span className="min-w-20 flex-1 font-medium">{category.name} <span className="font-normal text-neutral-500">({category.menuCount ?? 0} menu · {category.is_active ? "Aktif" : "Nonaktif"})</span></span>
          <Button size="sm" variant="ghost" onClick={() => openCategoryDialog(category)}>Ubah</Button>
          <Button size="sm" variant="ghost" onClick={() => void mutate(`/api/v1/admin/categories/${category.id}`, "PATCH", { isActive: !category.is_active })}>{category.is_active ? "Nonaktifkan" : "Aktifkan"}</Button>
          <Button size="sm" variant="ghost" onClick={() => { const next = categories[index - 1]; if (next) void reorderCategory(category.id, next.id); }} disabled={index === 0} aria-label="Naikkan urutan kategori">↑</Button>
          <Button size="sm" variant="ghost" onClick={() => { const next = categories[index + 1]; if (next) void reorderCategory(category.id, next.id); }} disabled={index === categories.length - 1} aria-label="Turunkan urutan kategori">↓</Button>
          <Button size="sm" variant="destructive" onClick={() => setCategoryToDelete(category)}>Hapus</Button>
        </li>)}
      </ul>
      </CardContent>
    </Card>

    <Dialog open={categoryDialogOpen} onOpenChange={(open) => { setCategoryDialogOpen(open); if (!open) setEditingCategory(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingCategory ? "Ubah kategori" : "Tambah kategori"}</DialogTitle>
          <DialogDescription>{editingCategory ? "Ubah nama kategori menu." : "Buat kategori untuk mengelompokkan menu."}</DialogDescription>
        </DialogHeader>
        <form id="category-form" className="space-y-2" onSubmit={saveCategory}>
          <Label htmlFor="category-name">Nama kategori</Label>
          <Input id="category-name" required maxLength={100} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} autoFocus />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>Batal</Button>
          <Button type="submit" form="category-form" disabled={busy}>{editingCategory ? "Simpan perubahan" : "Tambah kategori"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={categoryToDelete !== null} onOpenChange={(open) => { if (!open) setCategoryToDelete(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus kategori?</AlertDialogTitle>
          <AlertDialogDescription>Kategori “{categoryToDelete?.name}” hanya dapat dihapus jika tidak memiliki menu.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => { const category = categoryToDelete; setCategoryToDelete(null); if (category) void mutate(`/api/v1/admin/categories/${category.id}`, "DELETE"); }}>Hapus kategori</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <section className="rounded-xl border bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Menu</h2><p className="text-sm text-neutral-500">Menu dalam kategori nonaktif tidak tampil di katalog pelanggan.</p></div><button onClick={newMenu} disabled={!categories.length} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">Tambah menu</button></div>
      {message && <p role="status" className="mt-3 text-sm text-neutral-700">{message}</p>}
      <div className="mt-4 space-y-2">
        {menus.map((menu, index) => <article key={menu.id} draggable onDragStart={() => setDraggedMenu(menu.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedMenu && draggedMenu !== menu.id) void reorderMenu(draggedMenu, menu.id); setDraggedMenu(null); }} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
          {menu.image_path && <img src={imageUrl(menu.image_path)} alt="" className="h-14 w-14 rounded object-cover" />}
          <div className="min-w-40 flex-1"><h3 className="font-medium">{menu.name}</h3><p className="text-sm text-neutral-500">{menu.categoryName} · {rupiah.format(menu.price)} · {menu.is_active ? "Aktif" : "Nonaktif"}</p></div>
          <button onClick={() => editMenu(menu)} className="text-sm underline">Edit</button>
          <button onClick={() => void mutate(`/api/v1/admin/menus/${menu.id}`, "PATCH", { categoryId: menu.category_id, name: menu.name, description: menu.description, price: menu.price, imagePath: menu.image_path, isActive: !menu.is_active, sortOrder: menu.sort_order, configuration: menu.configuration })} className="text-sm underline">{menu.is_active ? "Nonaktifkan" : "Aktifkan"}</button>
          <button onClick={() => { const inCategory = menus.filter((item) => item.category_id === menu.category_id); const position = inCategory.findIndex((item) => item.id === menu.id); const other = inCategory[position - 1]; if (other) void reorderMenu(menu.id, other.id); }} disabled={!menus.slice(0, index).some((item) => item.category_id === menu.category_id)} aria-label="Naikkan urutan menu" className="underline disabled:text-neutral-300">↑</button>
          <button onClick={() => { const inCategory = menus.filter((item) => item.category_id === menu.category_id); const position = inCategory.findIndex((item) => item.id === menu.id); const other = inCategory[position + 1]; if (other) void reorderMenu(menu.id, other.id); }} disabled={!menus.slice(index + 1).some((item) => item.category_id === menu.category_id)} aria-label="Turunkan urutan menu" className="underline disabled:text-neutral-300">↓</button>
          <button onClick={() => { if (window.confirm(`Hapus menu ${menu.name}? Menu dengan transaksi historis hanya dapat dinonaktifkan.`)) void mutate(`/api/v1/admin/menus/${menu.id}`, "DELETE"); }} className="text-sm text-red-700 underline">Hapus</button>
        </article>)}
        {!menus.length && <p className="rounded-lg bg-neutral-50 p-6 text-center text-sm text-neutral-500">Belum ada menu.</p>}
      </div>
    </section>

    {draft && <div role="dialog" aria-modal="true" aria-labelledby="menu-editor-title" className="fixed inset-0 z-40 overflow-y-auto bg-black/40 p-3 md:p-8">
      <form onSubmit={async (event) => { event.preventDefault(); const body = { categoryId: draft.category_id, name: draft.name, description: draft.description, price: draft.price, imagePath: draft.image_path, isActive: draft.is_active, sortOrder: draft.sort_order, configuration: draft.configuration }; if (await mutate(draft.id ? `/api/v1/admin/menus/${draft.id}` : "/api/v1/admin/menus", draft.id ? "PATCH" : "POST", body)) setDraft(null); }} className="mx-auto max-w-3xl rounded-xl bg-white p-5 shadow-xl md:p-7">
        <div className="flex justify-between"><h2 id="menu-editor-title" className="text-xl font-semibold">{draft.id ? "Edit menu" : "Menu baru"}</h2><button type="button" onClick={() => setDraft(null)} aria-label="Tutup editor">✕</button></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm">Nama menu<input required maxLength={160} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 block w-full rounded border px-3 py-2" /></label>
          <label className="text-sm">Kategori<select value={draft.category_id} onChange={(event) => { const target = event.target.value; setDraft({ ...draft, category_id: target, sort_order: menus.filter((menu) => menu.category_id === target).length }); }} className="mt-1 block w-full rounded border px-3 py-2">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{!category.is_active ? " (Nonaktif)" : ""}</option>)}</select></label>
          <label className="text-sm">Harga dasar (Rp)<input required type="number" min="0" step="1" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} className="mt-1 block w-full rounded border px-3 py-2" /></label>
          <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={draft.is_active} onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })} /> Menu aktif</label>
          <label className="text-sm md:col-span-2">Deskripsi<textarea rows={3} maxLength={2000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="mt-1 block w-full rounded border px-3 py-2" /></label>
          <div className="text-sm md:col-span-2"><label>Foto menu (JPG, PNG, WebP; maks 2 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(file); }} className="mt-1 block w-full" /></label>{imagePreview && <div className="mt-2 flex items-center gap-3"><img src={imagePreview} alt="Pratinjau foto menu" className="h-24 w-24 rounded object-cover" /><button type="button" onClick={() => { setDraft({ ...draft, image_path: null }); setImagePreview(""); }} className="text-red-700 underline">Hapus foto</button></div>}</div>
        </div>
        <section className="mt-5 rounded-lg border border-neutral-200 p-4"><h3 className="font-medium">Template konfigurasi</h3><p className="mt-1 text-xs text-neutral-500">Menerapkan template akan menyalin konfigurasi ke menu ini.</p><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <label className="text-sm">Pilih template<select value={selectedTemplateId} onChange={(event) => { setSelectedTemplateId(event.target.value); setShowTemplatePreview(false); }} className="mt-1 block w-full rounded border px-2 py-2"><option value="">Pilih template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}{template.source ? " · bawaan" : ""}</option>)}</select></label>
          <label className="text-sm">Mode<select value={applyMode} onChange={(event) => setApplyMode(event.target.value as typeof applyMode)} className="mt-1 block w-full rounded border px-2 py-2"><option value="REPLACE_ALL">Ganti seluruh konfigurasi</option><option value="REPLACE_BY_TYPE">Ganti berdasarkan jenis</option></select></label>
          <button type="button" disabled={!selectedTemplateId} onClick={() => setShowTemplatePreview(!showTemplatePreview)} className="self-end rounded border px-3 py-2 text-sm disabled:opacity-50">{showTemplatePreview ? "Tutup pratinjau" : "Lihat pratinjau"}</button>
          <button type="button" disabled={!draft.id || busy} onClick={() => void saveDraftAsTemplate()} className="self-end rounded border px-3 py-2 text-sm disabled:opacity-50">Simpan sebagai template</button>
        </div>{showTemplatePreview && selectedTemplateId && <div className="mt-3 rounded bg-neutral-50 p-3 text-sm"><p className="font-medium">{templates.find((template) => template.id === selectedTemplateId)?.name}</p><p className="mt-1 text-xs text-neutral-600">{templates.find((template) => template.id === selectedTemplateId)?.configuration.variants.length ?? 0} grup varian dan {templates.find((template) => template.id === selectedTemplateId)?.configuration.addons.length ?? 0} grup add-on.</p>{draft.id && <button type="button" onClick={() => void applyTemplateToDraft()} disabled={busy} className="mt-3 rounded bg-neutral-900 px-3 py-2 text-sm text-white">Terapkan template</button>}</div>}</section>
        <div className="mt-6"><ConfigurationEditor value={draft.configuration} onChange={(configuration) => setDraft({ ...draft, configuration })} /></div>
        {draft.configuration.variants.filter((group) => group.options.some((option) => option.pricingMode === "OVERRIDE")).length > 1 && <p role="alert" className="mt-3 text-sm text-red-700">Hanya satu grup varian boleh menggunakan harga override.</p>}
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDraft(null)} className="rounded border px-4 py-2 text-sm">Batal</button><button disabled={busy} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">Simpan menu</button></div>
      </form>
    </div>}
  </div>;
}

