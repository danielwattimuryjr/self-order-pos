"use client";

import { useCallback, useEffect, useState } from "react";
import type { MenuConfiguration } from "@/lib/catalog/built-in-templates";
import { priceForMenuChoice, type MenuChoice } from "@/lib/catalog/price";
import { createClient } from "@/lib/supabase/client";

type Menu = { id: string; categoryId: string; name: string; description: string; price: number; imageUrl: string | null; sortOrder: number; configuration: MenuConfiguration };
type Category = { id: string; name: string; sortOrder: number; menus: Menu[] };
type Catalog = { table: { tableNumber: number }; session: { id: string; expiresAt: string }; operatingStatus: { status: "OPEN" | "TEMPORARILY_CLOSED" | "OUTSIDE_HOURS" | "NOT_CONFIGURED"; nextOpeningAt?: string }; temporaryCloseReason: string | null; categories: Category[] };
type CartLine = MenuChoice & { key: string; menuId: string; menuName: string; quantity: number; note: string; unitPrice: number; needsAcceptance: boolean; unavailable: string | null; lineNotice: string | null; choiceLabels: string[] };
type CartState = { lines: CartLine[]; orderNote: string };
const emptyCart: CartState = { lines: [], orderNote: "" };
const money = (amount: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);

export function CustomerOrdering({ tableCode }: { tableCode: string }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [activeCategory, setActiveCategory] = useState("");
  const [cart, setCart] = useState<CartState>(emptyCart);
  const [storageKey, setStorageKey] = useState("");
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>({});
  const [addonSelections, setAddonSelections] = useState<Record<string, Record<string, number>>>({});
  const [itemNote, setItemNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  const loadCatalog = useCallback(async () => {
    const storageSessionKey = `qr-order-session:${tableCode}`;
    const knownSession = sessionStorage.getItem(storageSessionKey);
    const query = knownSession ? `?sessionId=${encodeURIComponent(knownSession)}` : "";
    const response = await fetch(`/api/v1/tables/${encodeURIComponent(tableCode)}/catalog${query}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) {
      if (result.error?.code === "SESSION_EXPIRED") setSessionExpired(true);
      throw new Error(result.message ?? "Meja atau katalog tidak tersedia.");
    }
    const next = result.data as Catalog;
    sessionStorage.setItem(storageSessionKey, next.session.id);
    setSessionExpired(false);
    setCatalog(next);
    setActiveCategory((current) => current && next.categories.some((category) => category.id === current) ? current : next.categories[0]?.id ?? "");
    const key = `qr-order-cart:${tableCode}:${next.session.id}`;
    setStorageKey(key);
    try { setCart(JSON.parse(localStorage.getItem(key) ?? "null") as CartState ?? emptyCart); } catch { setCart(emptyCart); }
    setError("");
  }, [tableCode]);

  useEffect(() => {
    // Initial catalog state is loaded from an external API.
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCatalog().catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "Katalog belum dapat dimuat."); }).finally(() => { if (active) setLoading(false); });
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let connected = false;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void loadCatalog().catch(() => setNotice("Katalog belum dapat diperbarui. Coba muat ulang halaman.")), 150);
    };
    const channel = supabase.channel(`public-catalog-${tableCode}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "catalog_change_notices" }, scheduleRefresh)
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setNotice("Koneksi katalog terputus. Mencoba menyambung kembali.");
        if (status === "SUBSCRIBED") { setNotice(""); if (connected) scheduleRefresh(); connected = true; }
      });
    return () => { active = false; if (refreshTimer) clearTimeout(refreshTimer); void supabase.removeChannel(channel); };
  }, [loadCatalog, tableCode]);

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [cart, storageKey]);

  useEffect(() => {
    if (!catalog) return;
    const remaining = new Date(catalog.session.expiresAt).getTime() - Date.now();
    const timer = setTimeout(() => void loadCatalog().catch(() => undefined), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [catalog, loadCatalog]);

  useEffect(() => {
    if (!catalog) return;
    const menus = new Map(catalog.categories.flatMap((category) => category.menus).map((menu) => [menu.id, menu]));
    // Reconcile persisted cart selections against the authoritative refreshed catalog.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart((current) => ({ ...current, lines: current.lines.map((line) => {
      const menu = menus.get(line.menuId);
      if (!menu) return { ...line, unavailable: "Menu tidak tersedia. Hapus item ini sebelum checkout.", needsAcceptance: false };
      const reconciled = reconcileMenuChoice(menu, line);
      const result = priceForMenuChoice(menu.price, menu.configuration, reconciled.choice);
      if (!result.valid) return { ...line, ...reconciled.choice, menuName: menu.name, unavailable: `${result.reason} Hapus item ini lalu tambahkan ulang.`, lineNotice: null, needsAcceptance: false };
      const labels = choiceLabelsForMenu(menu, reconciled.choice);
      const choicesChanged = reconciled.changed || JSON.stringify(labels) !== JSON.stringify(line.choiceLabels);
      return { ...line, ...reconciled.choice, menuName: menu.name, choiceLabels: labels, lineNotice: choicesChanged ? "Pilihan menu berubah dan sudah dihitung ulang. Periksa kembali item ini." : line.lineNotice, unavailable: null, unitPrice: result.unitPrice, needsAcceptance: result.unitPrice !== line.unitPrice ? true : line.needsAcceptance };
    }) }));
  }, [catalog]);

  const cartCount = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const isOpen = catalog?.operatingStatus.status === "OPEN";

  function openMenu(menu: Menu) {
    setSelectedMenu(menu); setVariantSelections({}); setAddonSelections({}); setItemNote(""); setQuantity(1);
  }

  function addToCart() {
    if (!selectedMenu || !isOpen || !catalog) return;
    const currentMenu = catalog.categories.flatMap((category) => category.menus).find((menu) => menu.id === selectedMenu.id);
    if (!currentMenu) { setNotice("Menu sudah tidak tersedia. Periksa katalog yang diperbarui."); setSelectedMenu(null); return; }
    const choice: MenuChoice = { variantSelections, addonSelections };
    const priced = priceForMenuChoice(currentMenu.price, currentMenu.configuration, choice);
    if (!priced.valid) { setNotice(priced.reason); return; }
    const choiceLabels = choiceLabelsForMenu(currentMenu, choice);
    const signature = JSON.stringify([currentMenu.id, itemNote.trim(), Object.entries(variantSelections).sort(), Object.entries(addonSelections).map(([group, values]) => [group, Object.entries(values).sort()]).sort()]);
    setCart((current) => {
      const found = current.lines.find((line) => line.key === signature);
      if (found) return { ...current, lines: current.lines.map((line) => line.key === signature ? { ...line, quantity: Math.min(99, line.quantity + quantity) } : line) };
      return { ...current, lines: [...current.lines, { ...choice, key: signature, menuId: currentMenu.id, menuName: currentMenu.name, quantity, note: itemNote.trim(), unitPrice: priced.unitPrice, needsAcceptance: false, unavailable: null, lineNotice: null, choiceLabels }] };
    });
    setSelectedMenu(null); setShowCart(true); setNotice("");
  }

  function removeLine(key: string) { setCart((current) => ({ ...current, lines: current.lines.filter((line) => line.key !== key) })); }
  function adjustLine(line: CartLine, delta: number) {
    if (delta < 0 && line.quantity === 1) { if (window.confirm("Hapus item ini dari keranjang?")) removeLine(line.key); return; }
    setCart((current) => ({ ...current, lines: current.lines.map((item) => item.key === line.key ? { ...item, quantity: Math.max(1, Math.min(99, item.quantity + delta)) } : item) }));
  }

  if (loading) return <main className="grid min-h-screen place-items-center p-6 text-neutral-600">Memuat menu…</main>;
  if (sessionExpired) return <main className="grid min-h-screen place-items-center p-6"><div className="max-w-sm text-center"><h1 className="text-xl font-semibold">Sesi meja berakhir</h1><p className="mt-2 text-sm text-neutral-600">Pindai ulang QR meja untuk memulai sesi baru. Keranjang pada sesi sebelumnya tidak dipindahkan.</p><button onClick={() => { sessionStorage.removeItem(`qr-order-session:${tableCode}`); setCatalog(null); setLoading(true); setError(""); void loadCatalog().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Meja tidak tersedia.")).finally(() => setLoading(false)); }} className="mt-4 rounded-lg bg-neutral-900 px-4 py-3 text-sm text-white">Pindai ulang QR meja</button></div></main>;
  if (error && !catalog) return <main className="grid min-h-screen place-items-center p-6"><div className="max-w-sm text-center"><h1 className="text-xl font-semibold">Meja tidak tersedia</h1><p className="mt-2 text-sm text-neutral-600">{error}</p></div></main>;
  if (!catalog) return null;

  return <main className="min-h-screen bg-neutral-50 pb-28">
    <header className="border-b bg-white px-4 py-4"><div className="mx-auto max-w-5xl"><p className="text-xs uppercase tracking-wide text-neutral-500">QR Restaurant</p><h1 className="mt-1 text-xl font-semibold">Menu · Meja {String(catalog.table.tableNumber).padStart(2, "0")}</h1><p className="mt-1 text-xs text-neutral-500">Sesi berakhir {new Date(catalog.session.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p></div></header>
    {!isOpen && <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><div className="mx-auto max-w-5xl">{catalog.operatingStatus.status === "TEMPORARILY_CLOSED" ? `Restoran tutup sementara${catalog.temporaryCloseReason ? `: ${catalog.temporaryCloseReason}` : "."}` : catalog.operatingStatus.status === "OUTSIDE_HOURS" ? `Di luar jam operasional. Buka kembali ${catalog.operatingStatus.nextOpeningAt ? new Date(catalog.operatingStatus.nextOpeningAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" }) : "sesuai jadwal"}.` : "Jam operasional belum diatur. Pemesanan belum tersedia."} Katalog tetap dapat dilihat.</div></div>}
    {notice && <p role="status" className="mx-auto max-w-5xl px-4 pt-3 text-sm text-amber-800">{notice}</p>}
    <div className="sticky top-0 z-10 border-b bg-neutral-50/95 backdrop-blur"><nav aria-label="Kategori menu" className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3">{catalog.categories.map((category) => <button key={category.id} onClick={() => { setActiveCategory(category.id); document.getElementById(`category-${category.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className={`shrink-0 rounded-full px-4 py-2 text-sm ${activeCategory === category.id ? "bg-neutral-900 text-white" : "border bg-white"}`}>{category.name}</button>)}</nav></div>
    <div className="mx-auto max-w-5xl px-4 py-5">
      {!catalog.categories.length && <p className="rounded-xl border bg-white p-8 text-center text-sm text-neutral-500">Menu belum tersedia.</p>}
      {catalog.categories.map((category) => <section id={`category-${category.id}`} key={category.id} className="mb-8 scroll-mt-20"><h2 className="mb-3 text-lg font-semibold">{category.name}</h2>{category.menus.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{category.menus.map((menu) => <button disabled={!isOpen} key={menu.id} onClick={() => openMenu(menu)} className="overflow-hidden rounded-xl border bg-white text-left transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-70">{menu.imageUrl ? <img src={menu.imageUrl} alt="" className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center bg-neutral-100 text-4xl text-neutral-300">🍽</div>}<div className="p-3"><h3 className="line-clamp-2 min-h-10 text-sm font-medium">{menu.name}</h3><p className="mt-1 text-sm font-semibold">{money(menu.price)}</p>{(menu.configuration.variants.length + menu.configuration.addons.length > 0) && <p className="mt-1 text-xs text-neutral-500">Dapat disesuaikan</p>}</div></button>)}</div> : <p className="rounded-lg bg-white p-5 text-sm text-neutral-500">Belum ada menu dalam kategori ini.</p>}</section>)}
    </div>

    <button onClick={() => setShowCart(true)} className="fixed inset-x-4 bottom-4 z-20 mx-auto flex max-w-lg items-center justify-between rounded-xl bg-neutral-900 px-5 py-4 text-left text-white shadow-lg"><span><strong>Keranjang</strong><span className="ml-2 text-sm text-neutral-300">{cartCount} item</span></span><strong>{money(cartTotal)}</strong></button>

    {selectedMenu && <div role="dialog" aria-modal="true" aria-labelledby="menu-title" className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center md:p-6"><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 md:rounded-2xl"><div className="flex justify-between"><h2 id="menu-title" className="text-xl font-semibold">{selectedMenu.name}</h2><button onClick={() => setSelectedMenu(null)} aria-label="Tutup detail menu">✕</button></div>{selectedMenu.imageUrl && <img src={selectedMenu.imageUrl} alt="" className="mt-3 aspect-square max-h-64 w-full rounded-lg object-cover" />}<p className="mt-3 whitespace-pre-wrap text-sm text-neutral-600">{selectedMenu.description}</p><p className="mt-2 font-semibold">Harga dasar {money(selectedMenu.price)}</p>
      {selectedMenu.configuration.variants.map((group) => <fieldset key={group.id} className="mt-5"><legend className="font-medium">{group.name}{group.required ? <span className="ml-1 text-red-700">*</span> : <span className="ml-1 text-xs text-neutral-500">(opsional)</span>}</legend><div className="mt-2 space-y-2">{group.options.map((option) => <label key={option.id} className="flex items-center gap-3 rounded border p-3 text-sm"><input type="radio" name={`variant-${group.id}`} checked={Boolean(group.id && variantSelections[group.id] === option.id)} onChange={() => group.id && option.id && setVariantSelections({ ...variantSelections, [group.id]: option.id })} /> <span className="flex-1">{option.name}</span><span>{option.pricingMode === "OVERRIDE" ? `Harga ${money(option.priceValue)}` : option.priceValue ? `+${money(option.priceValue)}` : "Tanpa biaya"}</span></label>)}</div></fieldset>)}
      {selectedMenu.configuration.addons.map((group) => { const selection = group.id ? addonSelections[group.id] ?? {} : {}; return <fieldset key={group.id} className="mt-5"><legend className="font-medium">{group.name} <span className="text-xs text-neutral-500">(pilih {group.minSelect}–{group.maxSelect})</span></legend><div className="mt-2 space-y-2">{group.options.map((option) => { const count = option.id ? selection[option.id] ?? 0 : 0; const selectedCount = Object.values(selection).filter((value) => value > 0).length; return <div key={option.id} className="flex items-center gap-3 rounded border p-3 text-sm"><span className="flex-1">{option.name}<span className="ml-2 text-neutral-500">+{money(option.unitPrice)} / tambahan</span></span><button type="button" aria-label={`Kurangi ${option.name}`} disabled={!count} onClick={() => { if (!group.id || !option.id) return; const next = { ...selection }; if (count <= 1) delete next[option.id]; else next[option.id] = count - 1; setAddonSelections({ ...addonSelections, [group.id]: next }); }} className="h-8 w-8 rounded border disabled:opacity-40">−</button><span className="w-5 text-center">{count}</span><button type="button" aria-label={`Tambah ${option.name}`} disabled={!group.id || !option.id || (count === 0 && selectedCount >= group.maxSelect) || count >= 99} onClick={() => { if (!group.id || !option.id) return; setAddonSelections({ ...addonSelections, [group.id]: { ...selection, [option.id]: count + 1 } }); }} className="h-8 w-8 rounded border disabled:opacity-40">+</button></div>})}</div></fieldset>; })}
      <label className="mt-5 block text-sm">Catatan item (opsional)<textarea maxLength={500} value={itemNote} onChange={(event) => setItemNote(event.target.value)} rows={2} className="mt-1 block w-full rounded border px-3 py-2" /></label><label className="mt-4 block text-sm">Jumlah<input type="number" min="1" max="99" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(99, Number(event.target.value))))} className="mt-1 block w-28 rounded border px-3 py-2" /></label>
      <button disabled={!isOpen} onClick={addToCart} className="mt-5 w-full rounded-lg bg-neutral-900 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-600">Tambah ke keranjang</button>
    </div></div>}

    {showCart && <div role="dialog" aria-modal="true" aria-labelledby="cart-title" className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 md:items-center md:p-6"><div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 md:rounded-2xl"><div className="flex justify-between"><h2 id="cart-title" className="text-xl font-semibold">Keranjang</h2><button onClick={() => setShowCart(false)} aria-label="Tutup keranjang">✕</button></div>
      {!cart.lines.length && <p className="mt-6 text-center text-sm text-neutral-500">Keranjang masih kosong.</p>}
      <div className="mt-4 space-y-3">{cart.lines.map((line) => <article key={line.key} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><div><h3 className="font-medium">{line.menuName}</h3>{line.choiceLabels.map((label) => <p key={label} className="text-xs text-neutral-600">{label}</p>)}{line.note && <p className="mt-1 text-xs text-neutral-600">Catatan: {line.note}</p>}</div><strong className="whitespace-nowrap text-sm">{money(line.unitPrice * line.quantity)}</strong></div>
        {line.unavailable && <p role="alert" className="mt-2 text-sm text-red-700">{line.unavailable}</p>}
        {line.lineNotice && <div role="status" className="mt-2 flex items-center justify-between gap-2 text-sm text-amber-800"><span>{line.lineNotice}</span><button onClick={() => setCart((current) => ({ ...current, lines: current.lines.map((item) => item.key === line.key ? { ...item, lineNotice: null } : item) }))} className="shrink-0 underline">Mengerti</button></div>}
        {line.needsAcceptance && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span className="text-amber-800">Harga berubah: {money(line.unitPrice)} per item.</span><button onClick={() => setCart((current) => ({ ...current, lines: current.lines.map((item) => item.key === line.key ? { ...item, needsAcceptance: false } : item) }))} className="underline">Setujui harga baru</button></div>}
        <div className="mt-3 flex items-center gap-3"><button onClick={() => adjustLine(line, -1)} aria-label="Kurangi jumlah" className="h-8 w-8 rounded border">−</button><span>{line.quantity}</span><button onClick={() => adjustLine(line, 1)} aria-label="Tambah jumlah" disabled={line.quantity >= 99} className="h-8 w-8 rounded border disabled:opacity-40">+</button><button onClick={() => { if (window.confirm(`Hapus ${line.menuName} dari keranjang?`)) removeLine(line.key); }} className="ml-auto text-sm text-red-700 underline">Hapus</button></div>
      </article>)}</div>
      <label className="mt-4 block text-sm">Catatan pesanan (opsional)<textarea maxLength={1000} rows={2} value={cart.orderNote} onChange={(event) => setCart({ ...cart, orderNote: event.target.value })} className="mt-1 block w-full rounded border px-3 py-2" /></label>
      {cart.lines.length > 0 && <><div className="mt-4 flex justify-between border-t pt-3 font-semibold"><span>Total sementara</span><span>{money(cartTotal)}</span></div><button onClick={() => { if (window.confirm("Kosongkan seluruh keranjang?")) setCart({ ...emptyCart }); }} className="mt-3 text-sm text-red-700 underline">Kosongkan keranjang</button><button disabled className="mt-4 w-full cursor-not-allowed rounded-lg bg-neutral-300 px-4 py-3 font-medium text-neutral-600">Lanjut ke checkout — tersedia pada fase berikutnya</button><p className="mt-2 text-center text-xs text-neutral-500">Pesanan online hanya dapat dibuat setelah validasi checkout server tersedia.</p></>}
      </div></div>}
  </main>;
}

function choiceLabelsForMenu(menu: Menu, choice: MenuChoice) {
  return [
    ...menu.configuration.variants.flatMap((group) => { const id = group.id ? choice.variantSelections[group.id] : undefined; const option = group.options.find((item) => item.id === id); return option ? [`${group.name}: ${option.name}`] : []; }),
    ...menu.configuration.addons.flatMap((group) => Object.entries(group.id ? choice.addonSelections[group.id] ?? {} : {}).flatMap(([id, count]) => { const option = group.options.find((item) => item.id === id); return option ? [`${group.name}: ${option.name}${count > 1 ? ` ×${count}` : ""}`] : []; })),
  ];
}

function reconcileMenuChoice(menu: Menu, line: MenuChoice): { choice: MenuChoice; changed: boolean } {
  let changed = false;
  const variantGroupIds = new Set(menu.configuration.variants.map((group) => group.id).filter((id): id is string => Boolean(id)));
  const addonGroupIds = new Set(menu.configuration.addons.map((group) => group.id).filter((id): id is string => Boolean(id)));
  const variantSelections: Record<string, string> = {};
  for (const [groupId, optionId] of Object.entries(line.variantSelections)) {
    const group = menu.configuration.variants.find((candidate) => candidate.id === groupId);
    const option = group?.options.find((candidate) => candidate.id === optionId && candidate.isActive);
    if (variantGroupIds.has(groupId) && option) variantSelections[groupId] = optionId;
    else changed = true;
  }
  const addonSelections: Record<string, Record<string, number>> = {};
  for (const [groupId, selections] of Object.entries(line.addonSelections)) {
    const group = menu.configuration.addons.find((candidate) => candidate.id === groupId);
    if (!group || !addonGroupIds.has(groupId)) { changed = true; continue; }
    const activeOptionIds = new Set(group.options.filter((option) => option.isActive).map((option) => option.id).filter((id): id is string => Boolean(id)));
    const validSelections = Object.fromEntries(Object.entries(selections).filter(([optionId]) => activeOptionIds.has(optionId)));
    if (Object.keys(validSelections).length !== Object.keys(selections).length) changed = true;
    if (Object.keys(validSelections).length) addonSelections[groupId] = validSelections;
  }
  return { choice: { variantSelections, addonSelections }, changed };
}
