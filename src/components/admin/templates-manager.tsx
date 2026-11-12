"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfigurationEditor } from "@/components/admin/configuration-editor";
import type { MenuConfiguration } from "@/lib/catalog/built-in-templates";

type TemplateCategory = { id: string; name: string };
type Template = { id: string; name: string; category_id?: string | null; configuration: MenuConfiguration; version: number; updated_at?: string; source?: "BUILT_IN" };
type Menu = { id: string; name: string; category_id: string; configuration: MenuConfiguration };
type TemplateDraft = { id?: string; version?: number; name: string; categoryId: string; configuration: MenuConfiguration; original: string };
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
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [templateResponse, menuResponse] = await Promise.all([fetch("/api/v1/admin/templates", { cache: "no-store" }), fetch("/api/v1/admin/menus", { cache: "no-store" })]);
    const templateResult = await templateResponse.json(); const menuResult = await menuResponse.json();
    if (!templateResponse.ok || !menuResponse.ok) throw new Error("Data template atau menu belum dapat dimuat.");
    setTemplates([...templateResult.data.builtIns, ...templateResult.data.custom]);
    setCategories(templateResult.data.categories);
    setMenus(menuResult.data);
  }, []);
  // Initial state is loaded from the API, an external system.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Gagal memuat data.")); }, [load]);

  const visibleTemplates = useMemo(() => templates
    .filter((template) => template.name.toLocaleLowerCase("id-ID").includes(search.toLocaleLowerCase("id-ID")))
    .filter((template) => categoryFilter === "ALL" || (template.category_id ?? "NONE") === categoryFilter)
    .sort((a, b) => sortBy === "name" ? a.name.localeCompare(b.name, "id-ID") : (b.updated_at ?? "").localeCompare(a.updated_at ?? "")), [templates, search, categoryFilter, sortBy]);

  async function mutate(url: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      const response = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const result = await response.json(); setMessage(result.message ?? "Terjadi kesalahan.");
      if (response.ok) await load();
      return response.ok;
    } finally { setBusy(false); }
  }

  function beginEdit(template?: Template) {
    const next: TemplateDraft = { id: template?.source ? undefined : template?.id, version: template?.version, name: template?.name ?? "", categoryId: template?.category_id ?? "", configuration: template?.configuration ?? blankConfig, original: "" };
    next.original = JSON.stringify({ id: next.id, version: next.version, name: next.name, categoryId: next.categoryId, configuration: next.configuration });
    setDraft(next);
  }

  async function saveDraft(event: React.FormEvent) {
    event.preventDefault(); if (!draft) return;
    const payload = { name: draft.name, categoryId: draft.categoryId || null, configuration: draft.configuration, ...(draft.id ? { version: draft.version } : {}) };
    if (await mutate(draft.id ? `/api/v1/admin/templates/${draft.id}` : "/api/v1/admin/templates", draft.id ? "PATCH" : "POST", payload)) setDraft(null);
  }

  async function createCategory() {
    const name = window.prompt("Nama kategori template"); if (name?.trim()) await mutate("/api/v1/admin/template-categories", "POST", { name });
  }

  async function duplicate(template: Template) {
    const name = window.prompt("Nama template baru", `${template.name} (salinan)`); if (!name?.trim()) return;
    await mutate("/api/v1/admin/templates/duplicate", "POST", { templateId: template.id, name, categoryId: template.category_id ?? null });
  }

  async function saveFromMenu() {
    const menu = menus.find((item) => item.id === selectedMenu); if (!menu) return;
    const name = window.prompt("Nama template", `${menu.name} — konfigurasi`); if (!name?.trim()) return;
    await mutate("/api/v1/admin/templates/from-menu", "POST", { menuId: menu.id, name });
  }

  async function apply(template: Template) {
    const menu = menus.find((item) => item.id === selectedMenu); if (!menu) { setMessage("Pilih menu tujuan terlebih dahulu."); return; }
    const existing = menu.configuration.variants.length + menu.configuration.addons.length > 0;
    const confirmed = !existing || window.confirm(`Konfigurasi menu ${menu.name} akan diganti menurut mode yang dipilih. Lanjutkan?`);
    if (!confirmed) return;
    await mutate(`/api/v1/admin/menus/${menu.id}/apply-template`, "POST", { templateId: template.id, mode: applyMode, confirmed });
  }

  async function saveCategory(category: TemplateCategory) {
    const name = window.prompt("Nama kategori template", category.name); if (name?.trim() && name !== category.name) await mutate(`/api/v1/admin/template-categories/${category.id}`, "PATCH", { name });
  }

  return <div className="mt-6 space-y-6">
    {message && <p role="status" className="rounded-lg bg-neutral-100 p-3 text-sm">{message}</p>}
    <section className="rounded-xl border bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Kategori template</h2><p className="text-sm text-neutral-500">Kategori ini terpisah dari kategori menu.</p></div><button onClick={() => void createCategory()} className="rounded border px-3 py-2 text-sm">Tambah kategori</button></div>
      <div className="mt-3 flex flex-wrap gap-2">{categories.map((category) => <div key={category.id} className="rounded-full border px-3 py-1.5 text-sm">{category.name} <button aria-label={`Ubah kategori ${category.name}`} onClick={() => void saveCategory(category)} className="ml-1 underline">Ubah</button><button aria-label={`Hapus kategori ${category.name}`} onClick={() => { if (window.confirm(`Hapus ${category.name}? Template akan menjadi Tanpa Kategori.`)) void mutate(`/api/v1/admin/template-categories/${category.id}`, "DELETE"); }} className="ml-1 text-red-700 underline">Hapus</button></div>)}</div>
    </section>

    <section className="rounded-xl border bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-semibold">Template tersedia</h2><p className="text-sm text-neutral-500">Template bawaan tidak dapat diubah. Semua perubahan custom disimpan manual.</p></div><button onClick={() => beginEdit()} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">Buat template</button></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <label className="text-sm">Cari<input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1 block w-full rounded border px-3 py-2" /></label>
        <label className="text-sm">Kategori<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="mt-1 block w-full rounded border px-3 py-2"><option value="ALL">Semua kategori</option><option value="NONE">Tanpa Kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label className="text-sm">Urutkan<select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="mt-1 block w-full rounded border px-3 py-2"><option value="name">Nama</option><option value="updated">Terbaru diubah</option></select></label>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {visibleTemplates.map((template) => <article key={template.id} className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-medium">{template.name} {template.source === "BUILT_IN" && <span className="ml-1 rounded bg-neutral-100 px-2 py-0.5 text-xs">Bawaan · read-only</span>}</h3><p className="mt-1 text-xs text-neutral-500">{template.category_id ? categories.find((category) => category.id === template.category_id)?.name ?? "Tanpa Kategori" : "Tanpa Kategori"} · {template.configuration.variants.length} grup varian · {template.configuration.addons.length} grup add-on</p></div></div>
          <details className="mt-3"><summary className="cursor-pointer text-sm underline">Pratinjau konfigurasi</summary><ConfigurationSummary configuration={template.configuration} /></details>
          {template.source !== "BUILT_IN" && <div className="mt-3 flex gap-3 text-sm"><button onClick={() => beginEdit(template)} className="underline">Edit</button><button onClick={() => void duplicate(template)} className="underline">Duplikasi</button><button onClick={() => { if (window.confirm(`Hapus template ${template.name}? Menu yang sudah memakai salinannya tidak berubah.`)) void mutate(`/api/v1/admin/templates/${template.id}`, "DELETE"); }} className="text-red-700 underline">Hapus</button></div>}
          <button onClick={() => void apply(template)} className="mt-3 rounded border px-3 py-1.5 text-sm">Terapkan ke menu terpilih</button>
        </article>)}
        {!visibleTemplates.length && <p className="rounded bg-neutral-50 p-5 text-sm text-neutral-500">Tidak ada template yang cocok.</p>}
      </div>
    </section>

    <section className="rounded-xl border bg-white p-4 md:p-5">
      <h2 className="font-semibold">Terapkan atau simpan konfigurasi menu</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <label className="text-sm">Menu tujuan<select value={selectedMenu} onChange={(event) => setSelectedMenu(event.target.value)} className="mt-1 block w-full rounded border px-3 py-2"><option value="">Pilih menu</option>{menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.name}</option>)}</select></label>
        <label className="text-sm">Mode penerapan<select value={applyMode} onChange={(event) => setApplyMode(event.target.value as typeof applyMode)} className="mt-1 block w-full rounded border px-3 py-2"><option value="REPLACE_ALL">Ganti seluruh konfigurasi</option><option value="REPLACE_BY_TYPE">Ganti hanya jenis yang ada pada template</option></select></label>
        <div className="flex items-end"><button disabled={!selectedMenu || busy} onClick={() => void saveFromMenu()} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Simpan menu sebagai template</button></div>
      </div>
      <p className="mt-2 text-xs text-neutral-500">Penerapan dilakukan dari tombol di kartu template. Jika menu sudah berisi konfigurasi, dialog konfirmasi akan muncul.</p>
    </section>

    {draft && <div role="dialog" aria-modal="true" aria-labelledby="template-editor-title" className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-3 md:p-8">
      <form onSubmit={(event) => void saveDraft(event)} className="mx-auto max-w-3xl rounded-xl bg-white p-5 shadow-xl md:p-7">
        <h2 id="template-editor-title" className="text-xl font-semibold">{draft.id ? "Edit template" : "Template baru"}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Nama<input required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="mt-1 block w-full rounded border px-3 py-2" /></label><label className="text-sm">Kategori<select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })} className="mt-1 block w-full rounded border px-3 py-2"><option value="">Tanpa Kategori</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div>
        <div className="mt-5"><ConfigurationEditor value={draft.configuration} onChange={(configuration) => setDraft({ ...draft, configuration })} /></div>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => { const current = JSON.stringify({ id: draft.id, version: draft.version, name: draft.name, categoryId: draft.categoryId, configuration: draft.configuration }); if (current !== draft.original && !window.confirm("Buang perubahan template yang belum disimpan?")) return; setDraft(null); }} className="rounded border px-4 py-2 text-sm">Batal</button><button disabled={busy} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">Simpan template</button></div>
      </form>
    </div>}
  </div>;
}

function ConfigurationSummary({ configuration }: { configuration: MenuConfiguration }) {
  return <div className="mt-2 space-y-2 text-sm">{[...configuration.variants.map((group) => ({ ...group, kind: "Varian", values: group.options.map((option) => `${option.name} (${option.pricingMode === "OVERRIDE" ? "harga" : "+"} Rp${option.priceValue.toLocaleString("id-ID")})`) })), ...configuration.addons.map((group) => ({ ...group, kind: "Add-on", values: group.options.map((option) => `${option.name} (+Rp${option.unitPrice.toLocaleString("id-ID")})`) }))].map((group, index) => <div key={`${group.kind}-${group.name}-${index}`}><strong>{group.kind}: {group.name}</strong><div className="text-neutral-600">{group.values.join(", ")}</div></div>)}</div>;
}
