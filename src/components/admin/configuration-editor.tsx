"use client";

import type { MenuConfiguration } from "@/lib/catalog/built-in-templates";

type Props = { value: MenuConfiguration; onChange: (next: MenuConfiguration) => void };

export function ConfigurationEditor({ value, onChange }: Props) {
  function updateVariant(index: number, patch: Partial<MenuConfiguration["variants"][number]>) {
    onChange({ ...value, variants: value.variants.map((group, i) => i === index ? { ...group, ...patch } : group) });
  }
  function updateAddon(index: number, patch: Partial<MenuConfiguration["addons"][number]>) {
    onChange({ ...value, addons: value.addons.map((group, i) => i === index ? { ...group, ...patch } : group) });
  }

  return <div className="space-y-4">
    <section className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between"><h3 className="font-medium">Varian</h3><button type="button" onClick={() => onChange({ ...value, variants: [...value.variants, { name: "", required: false, sortOrder: value.variants.length, options: [{ name: "", pricingMode: "ADJUSTMENT", priceValue: 0, isActive: true, sortOrder: 0 }] }] })} className="text-sm underline">Tambah grup varian</button></div>
      {!value.variants.length && <p className="mt-2 text-sm text-neutral-500">Belum ada varian.</p>}
      {value.variants.map((group, groupIndex) => <div key={group.id ?? groupIndex} className="mt-4 rounded-md bg-neutral-50 p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1 text-sm">Nama grup<input value={group.name} onChange={(event) => updateVariant(groupIndex, { name: event.target.value })} className="mt-1 block w-full rounded border px-2 py-1.5" /></label>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={group.required} onChange={(event) => updateVariant(groupIndex, { required: event.target.checked })} /> Wajib dipilih</label>
          <button type="button" onClick={() => onChange({ ...value, variants: value.variants.filter((_, i) => i !== groupIndex) })} className="pb-2 text-sm text-red-700 underline">Hapus grup</button>
        </div>
        <div className="mt-3 space-y-2">
          {group.options.map((option, optionIndex) => <div key={option.id ?? optionIndex} className="grid gap-2 sm:grid-cols-[1fr_140px_150px_auto_auto]">
            <label className="text-xs">Nama opsi<input value={option.name} onChange={(event) => updateVariant(groupIndex, { options: group.options.map((item, i) => i === optionIndex ? { ...item, name: event.target.value } : item) })} className="mt-1 block w-full rounded border bg-white px-2 py-1.5 text-sm" /></label>
            <label className="text-xs">Harga (Rp)<input type="number" min="0" step="1" value={option.priceValue} onChange={(event) => updateVariant(groupIndex, { options: group.options.map((item, i) => i === optionIndex ? { ...item, priceValue: Number(event.target.value) } : item) })} className="mt-1 block w-full rounded border bg-white px-2 py-1.5 text-sm" /></label>
            <label className="text-xs">Mode harga<select value={option.pricingMode} onChange={(event) => updateVariant(groupIndex, { options: group.options.map((item, i) => i === optionIndex ? { ...item, pricingMode: event.target.value as "ADJUSTMENT" | "OVERRIDE" } : item) })} className="mt-1 block w-full rounded border bg-white px-2 py-1.5 text-sm"><option value="ADJUSTMENT">Penyesuaian</option><option value="OVERRIDE">Harga pengganti</option></select></label>
            <label className="flex items-center gap-1 self-end pb-2 text-xs"><input type="checkbox" checked={option.isActive} onChange={(event) => updateVariant(groupIndex, { options: group.options.map((item, i) => i === optionIndex ? { ...item, isActive: event.target.checked } : item) })} /> Aktif</label>
            <button type="button" aria-label="Hapus opsi varian" onClick={() => updateVariant(groupIndex, { options: group.options.filter((_, i) => i !== optionIndex) })} className="self-end px-2 py-2 text-sm text-red-700">Hapus</button>
          </div>)}
          <button type="button" onClick={() => updateVariant(groupIndex, { options: [...group.options, { name: "", pricingMode: "ADJUSTMENT", priceValue: 0, isActive: true, sortOrder: group.options.length }] })} className="text-sm underline">Tambah opsi</button>
        </div>
      </div>)}
    </section>

    <section className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between"><h3 className="font-medium">Add-on</h3><button type="button" onClick={() => onChange({ ...value, addons: [...value.addons, { name: "", required: false, minSelect: 0, maxSelect: 1, sortOrder: value.addons.length, options: [{ name: "", unitPrice: 0, isActive: true, sortOrder: 0 }] }] })} className="text-sm underline">Tambah grup add-on</button></div>
      {!value.addons.length && <p className="mt-2 text-sm text-neutral-500">Belum ada add-on.</p>}
      {value.addons.map((group, groupIndex) => <div key={group.id ?? groupIndex} className="mt-4 rounded-md bg-neutral-50 p-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px_120px_auto]">
          <label className="text-xs">Nama grup<input value={group.name} onChange={(event) => updateAddon(groupIndex, { name: event.target.value })} className="mt-1 block w-full rounded border bg-white px-2 py-1.5 text-sm" /></label>
          <label className="text-xs">Min. pilihan<input type="number" min="0" value={group.minSelect} onChange={(event) => updateAddon(groupIndex, { minSelect: Number(event.target.value), required: Number(event.target.value) > 0 || group.required })} className="mt-1 block w-full rounded border bg-white px-2 py-1.5 text-sm" /></label>
          <label className="text-xs">Maks. pilihan<input type="number" min="0" max={group.options.length} value={group.maxSelect} onChange={(event) => updateAddon(groupIndex, { maxSelect: Number(event.target.value) })} className="mt-1 block w-full rounded border bg-white px-2 py-1.5 text-sm" /></label>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={group.required} onChange={(event) => updateAddon(groupIndex, { required: event.target.checked, minSelect: event.target.checked ? Math.max(1, group.minSelect) : group.minSelect })} /> Wajib</label>
          <button type="button" onClick={() => onChange({ ...value, addons: value.addons.filter((_, i) => i !== groupIndex) })} className="pb-2 text-sm text-red-700 underline">Hapus grup</button>
        </div>
        <div className="mt-3 space-y-2">
          {group.options.map((option, optionIndex) => <div key={option.id ?? optionIndex} className="grid gap-2 sm:grid-cols-[1fr_180px_auto_auto]">
            <label className="text-xs">Nama opsi<input value={option.name} onChange={(event) => updateAddon(groupIndex, { options: group.options.map((item, i) => i === optionIndex ? { ...item, name: event.target.value } : item) })} className="mt-1 block w-full rounded border bg-white px-2 py-1.5 text-sm" /></label>
            <label className="text-xs">Harga per tambahan (Rp)<input type="number" min="0" value={option.unitPrice} onChange={(event) => updateAddon(groupIndex, { options: group.options.map((item, i) => i === optionIndex ? { ...item, unitPrice: Number(event.target.value) } : item) })} className="mt-1 block w-full rounded border bg-white px-2 py-1.5 text-sm" /></label>
            <label className="flex items-center gap-1 self-end pb-2 text-xs"><input type="checkbox" checked={option.isActive} onChange={(event) => updateAddon(groupIndex, { options: group.options.map((item, i) => i === optionIndex ? { ...item, isActive: event.target.checked } : item) })} /> Aktif</label>
            <button type="button" aria-label="Hapus opsi add-on" onClick={() => updateAddon(groupIndex, { options: group.options.filter((_, i) => i !== optionIndex), maxSelect: Math.min(group.maxSelect, group.options.length - 1), minSelect: Math.min(group.minSelect, group.options.length - 1) })} className="self-end px-2 py-2 text-sm text-red-700">Hapus</button>
          </div>)}
          <button type="button" onClick={() => updateAddon(groupIndex, { options: [...group.options, { name: "", unitPrice: 0, isActive: true, sortOrder: group.options.length }], maxSelect: Math.max(group.maxSelect, group.options.length + 1) })} className="text-sm underline">Tambah opsi</button>
        </div>
      </div>)}
    </section>
  </div>;
}
