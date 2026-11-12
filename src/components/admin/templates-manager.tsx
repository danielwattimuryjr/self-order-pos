"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfigurationEditor } from "@/components/admin/configuration-editor";
import type { MenuConfiguration } from "@/lib/catalog/built-in-templates";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type TemplateCategory = { id: string; name: string };
type Template = { id: string; name: string; category_id?: string | null; configuration: MenuConfiguration; version: number; updated_at?: string; source?: "BUILT_IN" };
type Menu = { id: string; name: string; category_id: string; configuration: MenuConfiguration };
type TemplateDraft = { id?: string; version?: number; name: string; categoryId: string; configuration: MenuConfiguration; original: string };
type NameDialog = { kind: "duplicate"; template: Template } | { kind: "from-menu"; menu: Menu };
const blankConfig: MenuConfiguration = { variants: [], addons: [] };

export function TemplatesManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("name");
  const [selectedMenu, setSelectedMenu] = useState("");
  const [applyMode, setApplyMode] = useState<"REPLACE_ALL" | "REPLACE_BY_TYPE">("REPLACE_ALL");
  const [busy, setBusy] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<TemplateCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<TemplateCategory | null>(null);
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [templateToApply, setTemplateToApply] = useState<Template | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const load = useCallback(async () => {
    const [templateResponse, menuResponse] = await Promise.all([fetch("/api/v1/admin/templates", { cache: "no-store" }), fetch("/api/v1/admin/menus", { cache: "no-store" })]);
    const templateResult = await templateResponse.json();
    const menuResult = await menuResponse.json();
    if (!templateResponse.ok || !menuResponse.ok) throw new Error("Data template atau menu belum dapat dimuat.");
    setTemplates([...templateResult.data.builtIns, ...templateResult.data.custom]);
    setCategories(templateResult.data.categories);
    setMenus(menuResult.data);
  }, []);

  // Initial state is loaded from the API, an external system.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Gagal memuat data.")); }, [load]);

  const visibleTemplates = useMemo(() => templates
    .filter((template) => template.name.toLocaleLowerCase("id-ID").includes(search.toLocaleLowerCase("id-ID")))
    .filter((template) => categoryFilter === "ALL" || (template.category_id ?? "NONE") === categoryFilter)
    .sort((a, b) => sortBy === "name" ? a.name.localeCompare(b.name, "id-ID") : (b.updated_at ?? "").localeCompare(a.updated_at ?? "")), [templates, search, categoryFilter, sortBy]);

  async function mutate(url: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      const response = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.message ?? "Terjadi kesalahan.");
        return false;
      }
      toast.success(result.message ?? "Berhasil.");
      await load();
      return true;
    } catch {
      toast.error("Terjadi kesalahan saat menghubungi server.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(template?: Template) {
    const next: TemplateDraft = { id: template?.source ? undefined : template?.id, version: template?.version, name: template?.name ?? "", categoryId: template?.category_id ?? "", configuration: template?.configuration ?? blankConfig, original: "" };
    next.original = JSON.stringify({ id: next.id, version: next.version, name: next.name, categoryId: next.categoryId, configuration: next.configuration });
    setDraft(next);
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const payload = { name: draft.name, categoryId: draft.categoryId || null, configuration: draft.configuration, ...(draft.id ? { version: draft.version } : {}) };
    if (await mutate(draft.id ? `/api/v1/admin/templates/${draft.id}` : "/api/v1/admin/templates", draft.id ? "PATCH" : "POST", payload)) setDraft(null);
  }

  function openCategoryDialog(category?: TemplateCategory) {
    setEditingCategory(category ?? null);
    setCategoryName(category?.name ?? "");
    setCategoryDialogOpen(true);
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await mutate(
      editingCategory ? `/api/v1/admin/template-categories/${editingCategory.id}` : "/api/v1/admin/template-categories",
      editingCategory ? "PATCH" : "POST",
      { name: categoryName },
    );
    if (saved) {
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryName("");
    }
  }

  function duplicate(template: Template) {
    setNameInput(`${template.name} (salinan)`);
    setNameDialog({ kind: "duplicate", template });
  }

  function saveFromMenu() {
    const menu = menus.find((item) => item.id === selectedMenu);
    if (!menu) {
      toast.error("Pilih menu tujuan terlebih dahulu.");
      return;
    }
    setNameInput(`${menu.name} — konfigurasi`);
    setNameDialog({ kind: "from-menu", menu });
  }

  async function submitNameDialog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = nameInput.trim();
    if (!nameDialog || !name) return;
    const saved = nameDialog.kind === "duplicate"
      ? await mutate("/api/v1/admin/templates/duplicate", "POST", { templateId: nameDialog.template.id, name, categoryId: nameDialog.template.category_id ?? null })
      : await mutate("/api/v1/admin/templates/from-menu", "POST", { menuId: nameDialog.menu.id, name });
    if (saved) setNameDialog(null);
  }

  async function apply(template: Template, confirmed: boolean) {
    const menu = menus.find((item) => item.id === selectedMenu);
    if (!menu) return;
    const applied = await mutate(`/api/v1/admin/menus/${menu.id}/apply-template`, "POST", { templateId: template.id, mode: applyMode, confirmed });
    if (applied) setTemplateToApply(null);
  }

  function requestApply(template: Template) {
    const menu = menus.find((item) => item.id === selectedMenu);
    if (!menu) {
      toast.error("Pilih menu tujuan terlebih dahulu.");
      return;
    }
    const hasConfiguration = menu.configuration.variants.length + menu.configuration.addons.length > 0;
    if (hasConfiguration) {
      setTemplateToApply(template);
      return;
    }
    void apply(template, true);
  }

  function requestCloseDraft() {
    if (!draft) return;
    const current = JSON.stringify({ id: draft.id, version: draft.version, name: draft.name, categoryId: draft.categoryId, configuration: draft.configuration });
    if (current !== draft.original) {
      setConfirmDiscard(true);
      return;
    }
    setDraft(null);
  }

  return <div className="mt-6 space-y-6">
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div><CardTitle>Kategori template</CardTitle><CardDescription>Kategori ini terpisah dari kategori menu.</CardDescription></div>
        <Button variant="outline" onClick={() => openCategoryDialog()}>Tambah kategori</Button>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {categories.map((category) => <div key={category.id} className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm"><span>{category.name}</span><Button size="sm" variant="ghost" aria-label={`Ubah kategori ${category.name}`} onClick={() => openCategoryDialog(category)}>Ubah</Button><Button size="sm" variant="destructive" aria-label={`Hapus kategori ${category.name}`} onClick={() => setCategoryToDelete(category)}>Hapus</Button></div>)}
        {!categories.length && <p className="text-sm text-muted-foreground">Belum ada kategori template.</p>}
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div><CardTitle>Template tersedia</CardTitle><CardDescription>Template bawaan tidak dapat diubah. Semua perubahan custom disimpan manual.</CardDescription></div>
        <Button onClick={() => beginEdit()}>Buat template</Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2"><Label htmlFor="template-search">Cari</Label><Input id="template-search" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="template-category-filter">Kategori</Label><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger id="template-category-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Semua kategori</SelectItem><SelectItem value="NONE">Tanpa kategori</SelectItem>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="template-sort">Urutkan</Label><Select value={sortBy} onValueChange={setSortBy}><SelectTrigger id="template-sort"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Nama</SelectItem><SelectItem value="updated">Terbaru diubah</SelectItem></SelectContent></Select></div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {visibleTemplates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">{template.name}{template.source === "BUILT_IN" && <Badge variant="secondary">Bawaan · read-only</Badge>}</CardTitle>
                <CardDescription>{template.category_id ? categories.find((category) => category.id === template.category_id)?.name ?? "Tanpa kategori" : "Tanpa kategori"} · {template.configuration.variants.length} grup varian · {template.configuration.addons.length} grup add-on</CardDescription>
              </CardHeader>
              <CardContent>
                <details><summary className="cursor-pointer text-sm underline">Pratinjau konfigurasi</summary><ConfigurationSummary configuration={template.configuration} /></details>
                <div className="mt-3 flex flex-wrap gap-2">
                  {template.source !== "BUILT_IN" && <><Button size="sm" variant="outline" onClick={() => beginEdit(template)}>Edit</Button><Button size="sm" variant="outline" onClick={() => duplicate(template)}>Duplikasi</Button><Button size="sm" variant="destructive" onClick={() => setTemplateToDelete(template)}>Hapus</Button></>}
                  <Button size="sm" onClick={() => requestApply(template)}>Terapkan ke menu terpilih</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!visibleTemplates.length && <p className="rounded-lg bg-secondary p-5 text-sm text-muted-foreground">Tidak ada template yang cocok.</p>}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Terapkan atau simpan konfigurasi menu</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="target-menu">Menu tujuan</Label><Select value={selectedMenu} onValueChange={setSelectedMenu}><SelectTrigger id="target-menu"><SelectValue placeholder="Pilih menu" /></SelectTrigger><SelectContent>{menus.map((menu) => <SelectItem key={menu.id} value={menu.id}>{menu.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="apply-mode">Mode penerapan</Label><Select value={applyMode} onValueChange={(value) => setApplyMode(value as typeof applyMode)}><SelectTrigger id="apply-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="REPLACE_ALL">Ganti seluruh konfigurasi</SelectItem><SelectItem value="REPLACE_BY_TYPE">Ganti hanya jenis yang ada pada template</SelectItem></SelectContent></Select></div>
        </div>
        <Button variant="outline" disabled={!selectedMenu || busy} onClick={saveFromMenu}>Simpan menu sebagai template</Button>
        <p className="text-xs text-muted-foreground">Jika menu sudah berisi konfigurasi, dialog konfirmasi akan muncul sebelum konfigurasi diganti.</p>
      </CardContent>
    </Card>

    <Dialog open={categoryDialogOpen} onOpenChange={(open) => { setCategoryDialogOpen(open); if (!open) setEditingCategory(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editingCategory ? "Ubah kategori template" : "Tambah kategori template"}</DialogTitle><DialogDescription>Kategori template terpisah dari kategori menu.</DialogDescription></DialogHeader>
        <form id="template-category-form" className="space-y-2" onSubmit={saveCategory}><Label htmlFor="template-category-name">Nama kategori</Label><Input id="template-category-name" required maxLength={100} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /></form>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>Batal</Button><Button type="submit" form="template-category-form" disabled={busy}>{editingCategory ? "Simpan perubahan" : "Tambah kategori"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={nameDialog !== null} onOpenChange={(open) => { if (!open) setNameDialog(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{nameDialog?.kind === "duplicate" ? "Duplikasi template" : "Simpan menu sebagai template"}</DialogTitle><DialogDescription>Masukkan nama template.</DialogDescription></DialogHeader>
        <form id="template-name-form" className="space-y-2" onSubmit={submitNameDialog}><Label htmlFor="template-name">Nama template</Label><Input id="template-name" required maxLength={120} value={nameInput} onChange={(event) => setNameInput(event.target.value)} /></form>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setNameDialog(null)}>Batal</Button><Button type="submit" form="template-name-form" disabled={busy}>Simpan</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={draft !== null} onOpenChange={(open) => { if (!open) requestCloseDraft(); }}>
      {draft && <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" showCloseButton={false}>
        <form onSubmit={saveDraft} className="space-y-5">
          <DialogHeader><DialogTitle>{draft.id ? "Edit template" : "Template baru"}</DialogTitle><DialogDescription>Atur nama, kategori, dan konfigurasi pilihan menu.</DialogDescription></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="draft-template-name">Nama</Label><Input id="draft-template-name" required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="draft-template-category">Kategori</Label><Select value={draft.categoryId || "NONE"} onValueChange={(value) => setDraft({ ...draft, categoryId: value === "NONE" ? "" : value })}><SelectTrigger id="draft-template-category"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NONE">Tanpa kategori</SelectItem>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <ConfigurationEditor value={draft.configuration} onChange={(configuration) => setDraft({ ...draft, configuration })} />
          <DialogFooter><Button type="button" variant="outline" onClick={requestCloseDraft}>Batal</Button><Button type="submit" disabled={busy}>Simpan template</Button></DialogFooter>
        </form>
      </DialogContent>}
    </Dialog>

    <AlertDialog open={categoryToDelete !== null} onOpenChange={(open) => { if (!open) setCategoryToDelete(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus kategori template?</AlertDialogTitle><AlertDialogDescription>Template di kategori “{categoryToDelete?.name}” akan menjadi Tanpa Kategori.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { const category = categoryToDelete; setCategoryToDelete(null); if (category) void mutate(`/api/v1/admin/template-categories/${category.id}`, "DELETE"); }}>Hapus kategori</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={templateToApply !== null} onOpenChange={(open) => { if (!open) setTemplateToApply(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Ganti konfigurasi menu?</AlertDialogTitle><AlertDialogDescription>Konfigurasi menu {menus.find((menu) => menu.id === selectedMenu)?.name} akan diganti menurut mode yang dipilih.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => { if (templateToApply) void apply(templateToApply, true); }}>Terapkan template</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={templateToDelete !== null} onOpenChange={(open) => { if (!open) setTemplateToDelete(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus template?</AlertDialogTitle><AlertDialogDescription>Menu yang sudah memakai salinan konfigurasi template {templateToDelete?.name} tidak berubah.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { const template = templateToDelete; setTemplateToDelete(null); if (template) void mutate(`/api/v1/admin/templates/${template.id}`, "DELETE"); }}>Hapus template</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Buang perubahan?</AlertDialogTitle><AlertDialogDescription>Perubahan template yang belum disimpan akan dibuang.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Tetap edit</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => { setConfirmDiscard(false); setDraft(null); }}>Buang perubahan</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}

function ConfigurationSummary({ configuration }: { configuration: MenuConfiguration }) {
  return <div className="mt-2 space-y-2 text-sm">{[...configuration.variants.map((group) => ({ ...group, kind: "Varian", values: group.options.map((option) => `${option.name} (${option.pricingMode === "OVERRIDE" ? "harga" : "+"} Rp${option.priceValue.toLocaleString("id-ID")})`) })), ...configuration.addons.map((group) => ({ ...group, kind: "Add-on", values: group.options.map((option) => `${option.name} (+Rp${option.unitPrice.toLocaleString("id-ID")})`) }))].map((group, index) => <div key={`${group.kind}-${group.name}-${index}`}><strong>{group.kind}: {group.name}</strong><div className="text-muted-foreground">{group.values.join(", ")}</div></div>)}</div>;
}
