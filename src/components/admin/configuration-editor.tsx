"use client";

import type { MenuConfiguration } from "@/lib/catalog/built-in-templates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = { value: MenuConfiguration; onChange: (next: MenuConfiguration) => void };

export function ConfigurationEditor({ value, onChange }: Props) {
  function updateVariant(index: number, patch: Partial<MenuConfiguration["variants"][number]>) {
    onChange({ ...value, variants: value.variants.map((group, i) => i === index ? { ...group, ...patch } : group) });
  }

  function updateAddon(index: number, patch: Partial<MenuConfiguration["addons"][number]>) {
    onChange({ ...value, addons: value.addons.map((group, i) => i === index ? { ...group, ...patch } : group) });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Varian</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, variants: [...value.variants, { name: "", required: false, sortOrder: value.variants.length, options: [{ name: "", pricingMode: "ADJUSTMENT", priceValue: 0, isActive: true, sortOrder: 0 }] }] })}>Tambah grup varian</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!value.variants.length && <p className="text-sm text-muted-foreground">Belum ada varian.</p>}
          {value.variants.map((group, groupIndex) => (
            <Card key={group.id ?? groupIndex} className="bg-secondary/40">
              <CardContent className="space-y-4 p-4">
                <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
                  <div className="space-y-2"><Label htmlFor={`variant-group-${groupIndex}`}>Nama grup</Label><Input id={`variant-group-${groupIndex}`} value={group.name} onChange={(event) => updateVariant(groupIndex, { name: event.target.value })} /></div>
                  <div className="flex items-center gap-2 pb-2 text-sm"><Checkbox id={`variant-required-${groupIndex}`} checked={group.required} onCheckedChange={(checked) => updateVariant(groupIndex, { required: checked === true })} /><Label htmlFor={`variant-required-${groupIndex}`}>Wajib dipilih</Label></div>
                  <Button type="button" variant="destructive" size="sm" onClick={() => onChange({ ...value, variants: value.variants.filter((_, i) => i !== groupIndex) })}>Hapus grup</Button>
                </div>
                <div className="space-y-3">
                  {group.options.map((option, optionIndex) => (
                    <div key={option.id ?? optionIndex} className="grid items-end gap-2 sm:grid-cols-[1fr_140px_180px_auto_auto]">
                      <div className="space-y-2"><Label htmlFor={`variant-option-${groupIndex}-${optionIndex}`}>Nama opsi</Label><Input id={`variant-option-${groupIndex}-${optionIndex}`} value={option.name} onChange={(event) => updateVariant(groupIndex, { options: group.options.map((item, i) => i === optionIndex ? { ...item, name: event.target.value } : item) })} /></div>
                      <div className="space-y-2"><Label htmlFor={`variant-price-${groupIndex}-${optionIndex}`}>Harga (Rp)</Label><Input id={`variant-price-${groupIndex}-${optionIndex}`} type="number" min="0" step="1" value={option.priceValue} onChange={(event) => updateVariant(groupIndex, { options: group.options.map((item, i) => i === optionIndex ? { ...item, priceValue: Number(event.target.value) } : item) })} /></div>
                      <div className="space-y-2"><Label htmlFor={`variant-mode-${groupIndex}-${optionIndex}`}>Mode harga</Label><Select value={option.pricingMode} onValueChange={(pricingMode) => updateVariant(groupIndex, { options: group.options.map((item, i) => i === optionIndex ? { ...item, pricingMode: pricingMode as "ADJUSTMENT" | "OVERRIDE" } : item) })}><SelectTrigger id={`variant-mode-${groupIndex}-${optionIndex}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ADJUSTMENT">Penyesuaian</SelectItem><SelectItem value="OVERRIDE">Harga pengganti</SelectItem></SelectContent></Select></div>
                      <div className="flex items-center gap-1 pb-2 text-xs"><Checkbox id={`variant-active-${groupIndex}-${optionIndex}`} checked={option.isActive} onCheckedChange={(checked) => updateVariant(groupIndex, { options: group.options.map((item, i) => i === optionIndex ? { ...item, isActive: checked === true } : item) })} /><Label htmlFor={`variant-active-${groupIndex}-${optionIndex}`}>Aktif</Label></div>
                      <Button type="button" variant="ghost" size="sm" aria-label="Hapus opsi varian" onClick={() => updateVariant(groupIndex, { options: group.options.filter((_, i) => i !== optionIndex) })}>Hapus</Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => updateVariant(groupIndex, { options: [...group.options, { name: "", pricingMode: "ADJUSTMENT", priceValue: 0, isActive: true, sortOrder: group.options.length }] })}>Tambah opsi</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Add-on</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ ...value, addons: [...value.addons, { name: "", required: false, minSelect: 0, maxSelect: 1, sortOrder: value.addons.length, options: [{ name: "", unitPrice: 0, isActive: true, sortOrder: 0 }] }] })}>Tambah grup add-on</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!value.addons.length && <p className="text-sm text-muted-foreground">Belum ada add-on.</p>}
          {value.addons.map((group, groupIndex) => (
            <Card key={group.id ?? groupIndex} className="bg-secondary/40">
              <CardContent className="space-y-4 p-4">
                <div className="grid items-end gap-3 sm:grid-cols-[1fr_120px_120px_auto_auto]">
                  <div className="space-y-2"><Label htmlFor={`addon-group-${groupIndex}`}>Nama grup</Label><Input id={`addon-group-${groupIndex}`} value={group.name} onChange={(event) => updateAddon(groupIndex, { name: event.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor={`addon-min-${groupIndex}`}>Min. pilihan</Label><Input id={`addon-min-${groupIndex}`} type="number" min="0" value={group.minSelect} onChange={(event) => updateAddon(groupIndex, { minSelect: Number(event.target.value), required: Number(event.target.value) > 0 || group.required })} /></div>
                  <div className="space-y-2"><Label htmlFor={`addon-max-${groupIndex}`}>Maks. pilihan</Label><Input id={`addon-max-${groupIndex}`} type="number" min="0" max={group.options.length} value={group.maxSelect} onChange={(event) => updateAddon(groupIndex, { maxSelect: Number(event.target.value) })} /></div>
                  <div className="flex items-center gap-2 pb-2 text-sm"><Checkbox id={`addon-required-${groupIndex}`} checked={group.required} onCheckedChange={(checked) => updateAddon(groupIndex, { required: checked === true, minSelect: checked === true ? Math.max(1, group.minSelect) : group.minSelect })} /><Label htmlFor={`addon-required-${groupIndex}`}>Wajib</Label></div>
                  <Button type="button" variant="destructive" size="sm" onClick={() => onChange({ ...value, addons: value.addons.filter((_, i) => i !== groupIndex) })}>Hapus grup</Button>
                </div>
                <div className="space-y-3">
                  {group.options.map((option, optionIndex) => (
                    <div key={option.id ?? optionIndex} className="grid items-end gap-2 sm:grid-cols-[1fr_180px_auto_auto]">
                      <div className="space-y-2"><Label htmlFor={`addon-option-${groupIndex}-${optionIndex}`}>Nama opsi</Label><Input id={`addon-option-${groupIndex}-${optionIndex}`} value={option.name} onChange={(event) => updateAddon(groupIndex, { options: group.options.map((item, i) => i === optionIndex ? { ...item, name: event.target.value } : item) })} /></div>
                      <div className="space-y-2"><Label htmlFor={`addon-price-${groupIndex}-${optionIndex}`}>Harga per tambahan (Rp)</Label><Input id={`addon-price-${groupIndex}-${optionIndex}`} type="number" min="0" value={option.unitPrice} onChange={(event) => updateAddon(groupIndex, { options: group.options.map((item, i) => i === optionIndex ? { ...item, unitPrice: Number(event.target.value) } : item) })} /></div>
                      <div className="flex items-center gap-1 pb-2 text-xs"><Checkbox id={`addon-active-${groupIndex}-${optionIndex}`} checked={option.isActive} onCheckedChange={(checked) => updateAddon(groupIndex, { options: group.options.map((item, i) => i === optionIndex ? { ...item, isActive: checked === true } : item) })} /><Label htmlFor={`addon-active-${groupIndex}-${optionIndex}`}>Aktif</Label></div>
                      <Button type="button" variant="ghost" size="sm" aria-label="Hapus opsi add-on" onClick={() => updateAddon(groupIndex, { options: group.options.filter((_, i) => i !== optionIndex), maxSelect: Math.min(group.maxSelect, group.options.length - 1), minSelect: Math.min(group.minSelect, group.options.length - 1) })}>Hapus</Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => updateAddon(groupIndex, { options: [...group.options, { name: "", unitPrice: 0, isActive: true, sortOrder: group.options.length }], maxSelect: Math.max(group.maxSelect, group.options.length + 1) })}>Tambah opsi</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
