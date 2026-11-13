"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { MenuConfiguration } from "@/lib/catalog/built-in-templates";
import { priceForMenuChoice, type MenuChoice } from "@/lib/catalog/price";
import { createClient } from "@/lib/supabase/client";

type Menu = { id: string; categoryId: string; name: string; description: string; price: number; imageUrl: string | null; sortOrder: number; configuration: MenuConfiguration };
type Category = { id: string; name: string; sortOrder: number; menus: Menu[] };
type Catalog = { table: { tableNumber: number }; session: { id: string; expiresAt: string }; operatingStatus: { status: "OPEN" | "TEMPORARILY_CLOSED" | "OUTSIDE_HOURS" | "NOT_CONFIGURED"; nextOpeningAt?: string }; temporaryCloseReason: string | null; categories: Category[] };
type CartLine = MenuChoice & { key: string; menuId: string; menuName: string; quantity: number; note: string; unitPrice: number; needsAcceptance: boolean; unavailable: string | null; lineNotice: string | null; choiceLabels: string[] };
type CartState = { lines: CartLine[]; orderNote: string };
const emptyCart: CartState = { lines: [], orderNote: "" };
type VoucherPreview = { code: string; name: string; discountAmount: number; eligibleSubtotal: number; totalAmount: number; cartFingerprint: string };
type CreatedOrder = { id: string; orderNumber: string; status: "PENDING_PAYMENT"; totalAmount: number; expiresAt: string; accessToken: string };
type PaymentView = { qrUrl: string | null; paymentStatus: string; attemptStatus: string | null; expiresAt: string; paidAt: string | null };
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
  const [cartConfirmation, setCartConfirmation] = useState<{ kind: "line"; line: CartLine } | { kind: "clear" } | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherPreview, setVoucherPreview] = useState<VoucherPreview | null>(null);
  const [validatingVoucher, setValidatingVoucher] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [receiptEmail, setReceiptEmail] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [paymentView, setPaymentView] = useState<PaymentView | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [cancelOrderConfirm, setCancelOrderConfirm] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [paymentNow, setPaymentNow] = useState(0);
  const [paymentRetry, setPaymentRetry] = useState(0);

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
    try {
      const savedOrder = sessionStorage.getItem(`qr-order-created:${next.session.id}`);
      if (savedOrder) {
        const order = JSON.parse(savedOrder) as CreatedOrder;
        setCreatedOrder(order);
        setPaymentNow(Date.now());
        const savedPayment = sessionStorage.getItem(`qr-payment-view:${order.id}`);
        if (savedPayment) setPaymentView(JSON.parse(savedPayment) as PaymentView);
      }
    } catch {
      sessionStorage.removeItem(`qr-order-created:${next.session.id}`);
    }
    setSessionExpired(false);
    setCatalog(next);
    setActiveCategory((current) => current && next.categories.some((category) => category.id === current) ? current : next.categories[0]?.id ?? "");
    const key = `qr-order-cart:${tableCode}:${next.session.id}`;
    setStorageKey(key);
    try { setCart(JSON.parse(localStorage.getItem(key) ?? "null") as CartState ?? emptyCart); } catch { setCart(emptyCart); }
    setError("");
  }, [tableCode]);

  useEffect(() => {
    if (!createdOrder) return;
    let active = true;
    const updatePayment = (payment: PaymentView) => {
      if (!active) return;
      setPaymentView(payment);
      sessionStorage.setItem(`qr-payment-view:${createdOrder.id}`, JSON.stringify(payment));
    };
    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/v1/orders/${createdOrder.id}/payment-status`, { headers: { Authorization: `Bearer ${createdOrder.accessToken}` }, cache: "no-store" });
        const result = await response.json();
        if (response.ok && result.data) updatePayment({
          qrUrl: result.data.qrUrl ?? null, paymentStatus: result.data.paymentStatus,
          attemptStatus: result.data.attemptStatus ?? null, expiresAt: result.data.paymentExpiresAt ?? result.data.expiresAt,
          paidAt: result.data.paidAt ?? null,
        });
      } catch { /* Polling/realtime will retry. */ }
    };
    const ensureAttempt = async (retry = false) => {
      setPaymentBusy(true); setPaymentError("");
      try {
        const keyName = `qr-payment-idempotency:${createdOrder.id}`;
        let idempotencyKey = retry ? crypto.randomUUID() : sessionStorage.getItem(keyName);
        if (!idempotencyKey) idempotencyKey = crypto.randomUUID();
        sessionStorage.setItem(keyName, idempotencyKey);
        const response = await fetch(`/api/v1/orders/${createdOrder.id}/payment-attempts`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableCode, accessToken: createdOrder.accessToken, idempotencyKey }),
        });
        const result = await response.json();
        if (!response.ok) {
          if (result.error?.code === "PAYMENT_QR_PENDING") { await fetchStatus(); return; }
          throw new Error(result.message ?? "QRIS belum dapat dibuat.");
        }
        if (result.data.qrUrl) updatePayment({ qrUrl: result.data.qrUrl, paymentStatus: "PENDING", attemptStatus: result.data.status ?? "PENDING", expiresAt: result.data.expiresAt, paidAt: null });
        else if (result.data.status === "PAID") updatePayment({ qrUrl: null, paymentStatus: "PAID", attemptStatus: "PAID", expiresAt: createdOrder.expiresAt, paidAt: new Date().toISOString() });
        else if (result.data.status) updatePayment({ qrUrl: null, paymentStatus: "PENDING", attemptStatus: result.data.status, expiresAt: result.data.expiresAt ?? createdOrder.expiresAt, paidAt: null });
        await fetchStatus();
      } catch (error) { if (active) setPaymentError(error instanceof Error ? error.message : "QRIS belum dapat dibuat."); }
      finally { if (active) setPaymentBusy(false); }
    };
    void ensureAttempt(paymentRetry > 0);
    const poll = setInterval(() => {
      if (!paymentRealtimeConnected || Date.now() >= new Date(createdOrder.expiresAt).getTime()) void fetchStatus();
    }, 5000);
    let paymentRealtimeConnected = false;
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | undefined;
    void crypto.subtle.digest("SHA-256", new TextEncoder().encode(createdOrder.accessToken)).then((digest) => {
      if (!active) return;
      const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const supabase = createClient();
      channel = supabase.channel(`customer-payment:${createdOrder.id}:${tokenHash}`)
        .on("broadcast", { event: "payment_status_changed" }, () => void fetchStatus())
        .subscribe((status) => {
          paymentRealtimeConnected = status === "SUBSCRIBED";
          if (paymentRealtimeConnected) void fetchStatus();
        });
    }).catch(() => undefined);
    return () => { active = false; clearInterval(poll); if (channel) void createClient().removeChannel(channel); };
  }, [createdOrder, paymentRetry, tableCode]);

  useEffect(() => {
    if (!createdOrder || paymentView?.paymentStatus !== "PENDING") return;
    const timer = setInterval(() => setPaymentNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [createdOrder, paymentView?.paymentStatus]);

  async function cancelOrder() {
    if (!createdOrder || !catalog) return;
    setCancelBusy(true); setPaymentError("");
    try {
      const response = await fetch(`/api/v1/orders/${createdOrder.id}/cancel`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableCode, accessToken: createdOrder.accessToken }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Pesanan belum dapat dibatalkan.");
      setCancelOrderConfirm(false);
      await fetch(`/api/v1/orders/${createdOrder.id}/payment-status`, { headers: { Authorization: `Bearer ${createdOrder.accessToken}` }, cache: "no-store" }).then((response) => response.json()).then((result) => {
        if (result.data) setPaymentView({ qrUrl: result.data.qrUrl ?? null, paymentStatus: result.data.paymentStatus, attemptStatus: result.data.attemptStatus ?? null, expiresAt: result.data.paymentExpiresAt ?? result.data.expiresAt, paidAt: result.data.paidAt ?? null });
      });
      if (result.data.paymentStatus === "PAID" || result.data.status === "PAID") toast.success("Pembayaran berhasil dikonfirmasi.");
      else toast.success("Pesanan dibatalkan.");
    } catch (error) { setPaymentError(error instanceof Error ? error.message : "Pesanan belum dapat dibatalkan."); }
    finally { setCancelBusy(false); }
  }

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
  const cartFingerprint = JSON.stringify(cart.lines.map(({ menuId, quantity, note, variantSelections, addonSelections }) => ({ menuId, quantity, note, variantSelections, addonSelections })));
  const currentVoucher = voucherPreview?.cartFingerprint === cartFingerprint ? voucherPreview : null;
  const orderTotal = cartTotal - (currentVoucher?.discountAmount ?? 0);
  const isOpen = catalog?.operatingStatus.status === "OPEN";

  async function applyVoucher() {
    if (!catalog || !voucherCode.trim() || !cart.lines.length) return;
    setValidatingVoucher(true);
    try {
      const response = await fetch("/api/v1/vouchers/validate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableCode, sessionId: catalog.session.id, code: voucherCode,
          items: cart.lines.map(({ menuId, quantity, note, variantSelections, addonSelections }) => ({ menuId, quantity, note, variantSelections, addonSelections })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Voucher belum dapat diperiksa.");
      if (!result.data.valid) { setVoucherPreview(null); toast.error(result.data.reason); return; }
      setVoucherPreview({ ...result.data, cartFingerprint });
      toast.success("Voucher berhasil diterapkan.");
    } catch (voucherError) { toast.error(voucherError instanceof Error ? voucherError.message : "Voucher belum dapat diperiksa."); }
    finally { setValidatingVoucher(false); }
  }

  async function createOrder() {
    if (!catalog || !cart.lines.length || !isOpen || submittingOrder) return;
    if (cart.lines.some((line) => line.unavailable || line.needsAcceptance)) {
      toast.error("Periksa menu yang tidak tersedia atau setujui perubahan harga sebelum checkout."); return;
    }
    if (voucherCode.trim() && !currentVoucher) {
      toast.error("Periksa kembali voucher setelah perubahan keranjang."); return;
    }
    setSubmittingOrder(true);
    try {
      const pendingKey = `qr-order-pending:${catalog.session.id}:${cartFingerprint}`;
      let pending: { idempotencyKey: string; accessToken: string } | null = null;
      try { pending = JSON.parse(sessionStorage.getItem(pendingKey) ?? "null") as typeof pending; } catch { pending = null; }
      if (!pending) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const accessToken = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
        pending = { idempotencyKey: crypto.randomUUID(), accessToken };
        sessionStorage.setItem(pendingKey, JSON.stringify(pending));
      }
      const response = await fetch(`/api/v1/sessions/${encodeURIComponent(catalog.session.id)}/orders`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableCode, idempotencyKey: pending.idempotencyKey, accessToken: pending.accessToken,
          customerName, receiptEmail: receiptEmail.trim() || null,
          orderNotes: cart.orderNote,
          voucherCode: currentVoucher?.code ?? null,
          items: cart.lines.map(({ menuId, quantity, note, variantSelections, addonSelections }) => ({ menuId, quantity, note, variantSelections, addonSelections })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Pesanan belum dapat dibuat.");
      const order = result.data as CreatedOrder;
      setCreatedOrder(order);
      setPaymentNow(Date.now());
      sessionStorage.setItem(`qr-order-created:${catalog.session.id}`, JSON.stringify(order));
      sessionStorage.removeItem(pendingKey);
      setCart({ ...emptyCart });
      setVoucherCode(""); setVoucherPreview(null);
      localStorage.removeItem(storageKey);
      toast.success("Pesanan dibuat dan menunggu pembayaran.");
    } catch (orderError) { toast.error(orderError instanceof Error ? orderError.message : "Pesanan belum dapat dibuat."); }
    finally { setSubmittingOrder(false); }
  }

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
    toast.success(`${currentMenu.name} ditambahkan ke keranjang.`);
  }

  function removeLine(key: string) { setCart((current) => ({ ...current, lines: current.lines.filter((line) => line.key !== key) })); }
  function adjustLine(line: CartLine, delta: number) {
    if (delta < 0 && line.quantity === 1) { setCartConfirmation({ kind: "line", line }); return; }
    setCart((current) => ({ ...current, lines: current.lines.map((item) => item.key === line.key ? { ...item, quantity: Math.max(1, Math.min(99, item.quantity + delta)) } : item) }));
  }

  function confirmCartAction() {
    if (cartConfirmation?.kind === "line") removeLine(cartConfirmation.line.key);
    else if (cartConfirmation?.kind === "clear") setCart({ ...emptyCart });
    setCartConfirmation(null);
  }

  if (loading) return (
    <main aria-busy="true" aria-label="Memuat menu" className="min-h-svh bg-background pb-28">
      <span className="sr-only" role="status">Memuat menu…</span>
      <header className="border-b bg-card px-4 py-4">
        <div className="mx-auto max-w-5xl space-y-2">
          <Skeleton aria-hidden="true" className="h-3 w-24" />
          <Skeleton aria-hidden="true" className="h-6 w-44" />
          <Skeleton aria-hidden="true" className="h-3 w-36" />
        </div>
      </header>
      <div aria-hidden="true" className="sticky top-0 flex gap-2 overflow-hidden border-b bg-background px-4 py-3">
        <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
        <Skeleton className="h-9 w-20 shrink-0 rounded-full" />
      </div>
      <div aria-hidden="true" className="mx-auto grid max-w-5xl grid-cols-2 gap-3 px-4 py-5 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-xl border bg-card">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/5" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton aria-hidden="true" className="fixed inset-x-4 bottom-4 mx-auto h-14 max-w-lg rounded-lg" />
    </main>
  );
  if (sessionExpired) return <main className="grid min-h-svh place-items-center p-6"><div className="max-w-sm text-center"><h1 className="text-xl font-semibold">Sesi meja berakhir</h1><p className="mt-2 text-sm text-muted-foreground">Pindai ulang QR meja untuk memulai sesi baru. Keranjang pada sesi sebelumnya tidak dipindahkan.</p><Button onClick={() => { sessionStorage.removeItem(`qr-order-session:${tableCode}`); setCatalog(null); setLoading(true); setError(""); void loadCatalog().catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Meja tidak tersedia.")).finally(() => setLoading(false)); }} className="mt-4">Pindai ulang QR meja</Button></div></main>;
  if (error && !catalog) return <main className="grid min-h-svh place-items-center p-6"><div className="max-w-sm text-center"><h1 className="text-xl font-semibold">Meja tidak tersedia</h1><p role="alert" className="mt-2 text-sm text-muted-foreground">{error}</p></div></main>;
  if (!catalog) return null;

  return <main className="min-h-svh bg-background pb-28">
    <header className="border-b bg-card px-4 py-4"><div className="mx-auto max-w-5xl"><p className="text-xs uppercase tracking-wide text-muted-foreground">QR Restaurant</p><h1 className="mt-1 text-xl font-semibold">Menu · Meja {String(catalog.table.tableNumber).padStart(2, "0")}</h1><p className="mt-1 text-xs text-muted-foreground">Sesi berakhir {new Date(catalog.session.expiresAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</p></div></header>
    {!isOpen && <div className="border-b border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning"><div className="mx-auto max-w-5xl">{catalog.operatingStatus.status === "TEMPORARILY_CLOSED" ? `Restoran tutup sementara${catalog.temporaryCloseReason ? `: ${catalog.temporaryCloseReason}` : "."}` : catalog.operatingStatus.status === "OUTSIDE_HOURS" ? `Di luar jam operasional. Buka kembali ${catalog.operatingStatus.nextOpeningAt ? new Date(catalog.operatingStatus.nextOpeningAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" }) : "sesuai jadwal"}.` : "Jam operasional belum diatur. Pemesanan belum tersedia."} Katalog tetap dapat dilihat.</div></div>}
    {notice && <p role="status" className="mx-auto max-w-5xl px-4 pt-3 text-sm text-warning">{notice}</p>}
    <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur"><nav aria-label="Kategori menu" className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3">{catalog.categories.map((category) => <Button key={category.id} variant={activeCategory === category.id ? "default" : "outline"} onClick={() => { setActiveCategory(category.id); document.getElementById(`category-${category.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="shrink-0 rounded-full">{category.name}</Button>)}</nav></div>
    <div className="mx-auto max-w-5xl px-4 py-5">
      {!catalog.categories.length && <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Menu belum tersedia.</CardContent></Card>}
      {catalog.categories.map((category) => <section id={`category-${category.id}`} key={category.id} className="mb-8 scroll-mt-20"><h2 className="mb-3 text-lg font-semibold">{category.name}</h2>{category.menus.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">{category.menus.map((menu) => <Button variant="ghost" disabled={!isOpen} key={menu.id} onClick={() => openMenu(menu)} className="h-auto min-w-0 flex-col items-stretch overflow-hidden rounded-xl border bg-card p-0 text-left whitespace-normal shadow-none transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-70">{menu.imageUrl ? <Image src={menu.imageUrl} alt="" width={500} height={500} unoptimized className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center bg-secondary text-4xl text-muted-foreground">🍽</div>}<div className="p-3"><h3 className="line-clamp-2 min-h-10 text-sm font-medium">{menu.name}</h3><p className="mt-1 text-sm font-semibold">{money(menu.price)}</p>{(menu.configuration.variants.length + menu.configuration.addons.length > 0) && <p className="mt-1 text-xs text-muted-foreground">Dapat disesuaikan</p>}</div></Button>)}</div> : <Card><CardContent className="p-5 text-sm text-muted-foreground">Belum ada menu dalam kategori ini.</CardContent></Card>}</section>)}
    </div>

    <Button onClick={() => setShowCart(true)} className="fixed inset-x-4 bottom-4 z-20 mx-auto flex h-auto max-w-lg items-center justify-between px-5 py-4 text-left shadow-lg"><span><strong>Keranjang</strong><span className="ml-2 text-sm text-primary-foreground/80">{cartCount} item</span></span><strong>{money(cartTotal)}</strong></Button>

    <Dialog open={selectedMenu !== null} onOpenChange={(open) => { if (!open) setSelectedMenu(null); }}>
      {selectedMenu && <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>{selectedMenu.name}</DialogTitle><DialogDescription>{selectedMenu.description || `Harga dasar ${money(selectedMenu.price)}`}</DialogDescription></DialogHeader>
        {selectedMenu.imageUrl && <Image src={selectedMenu.imageUrl} alt="" width={600} height={600} unoptimized className="aspect-square max-h-64 w-full rounded-lg object-cover" />}
        <p className="font-semibold">Harga dasar {money(selectedMenu.price)}</p>
        {selectedMenu.configuration.variants.map((group, groupIndex) => <fieldset key={group.id ?? groupIndex} className="space-y-3"><legend className="font-medium">{group.name}{group.required ? <span className="ml-1 text-destructive">*</span> : <span className="ml-1 text-xs text-muted-foreground">(opsional)</span>}</legend><RadioGroup value={group.id ? variantSelections[group.id] ?? "" : ""} onValueChange={(optionId) => { if (group.id) setVariantSelections((current) => ({ ...current, [group.id as string]: optionId })); }} className="space-y-2">{group.options.map((option, optionIndex) => { const id = `variant-${group.id ?? groupIndex}-${option.id ?? optionIndex}`; return <div key={option.id ?? optionIndex} className="flex items-center gap-3 rounded-lg border p-3 text-sm"><RadioGroupItem id={id} value={option.id ?? ""} disabled={!option.id || !option.isActive} /><Label htmlFor={id} className="flex flex-1 cursor-pointer items-center justify-between gap-2 font-normal"><span>{option.name}</span><span>{option.pricingMode === "OVERRIDE" ? `Harga ${money(option.priceValue)}` : option.priceValue ? `+${money(option.priceValue)}` : "Tanpa biaya"}</span></Label></div>; })}</RadioGroup></fieldset>)}
        {selectedMenu.configuration.addons.map((group, groupIndex) => { const selection = group.id ? addonSelections[group.id] ?? {} : {}; return <fieldset key={group.id ?? groupIndex} className="space-y-3"><legend className="font-medium">{group.name} <span className="text-xs text-muted-foreground">(pilih {group.minSelect}–{group.maxSelect})</span></legend><div className="space-y-2">{group.options.map((option, optionIndex) => { const count = option.id ? selection[option.id] ?? 0 : 0; const selectedCount = Object.values(selection).filter((value) => value > 0).length; return <div key={option.id ?? optionIndex} className="flex items-center gap-3 rounded-lg border p-3 text-sm"><span className="flex-1">{option.name}<span className="ml-2 text-muted-foreground">+{money(option.unitPrice)} / tambahan</span></span><Button type="button" variant="outline" size="icon" aria-label={`Kurangi ${option.name}`} disabled={!count} onClick={() => { if (!group.id || !option.id) return; const next = { ...selection }; if (count <= 1) delete next[option.id]; else next[option.id] = count - 1; setAddonSelections({ ...addonSelections, [group.id]: next }); }}>−</Button><span className="w-5 text-center">{count}</span><Button type="button" variant="outline" size="icon" aria-label={`Tambah ${option.name}`} disabled={!group.id || !option.id || (count === 0 && selectedCount >= group.maxSelect) || count >= 99} onClick={() => { if (!group.id || !option.id) return; setAddonSelections({ ...addonSelections, [group.id]: { ...selection, [option.id]: count + 1 } }); }}>+</Button></div>; })}</div></fieldset>; })}
        <div className="space-y-2"><Label htmlFor="item-note">Catatan item (opsional)</Label><Textarea id="item-note" maxLength={500} value={itemNote} onChange={(event) => setItemNote(event.target.value)} rows={2} /></div>
        <div className="space-y-2"><Label htmlFor="item-quantity">Jumlah</Label><Input id="item-quantity" type="number" min="1" max="99" value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(99, Number(event.target.value))))} className="w-28" /></div>
        <Button disabled={!isOpen} onClick={addToCart} className="w-full">Tambah ke keranjang</Button>
      </DialogContent>}
    </Dialog>

    <Dialog open={showCart} onOpenChange={setShowCart}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Keranjang</DialogTitle><DialogDescription>{cartCount} item · {money(orderTotal)} termasuk diskon voucher yang masih berlaku</DialogDescription></DialogHeader>
        {createdOrder && <Card className="border-primary/20"><CardContent className="space-y-3 p-4 text-center">
          <div className="text-left"><p className="font-semibold">Pembayaran · {createdOrder.orderNumber}</p><p className="text-sm text-muted-foreground">Total {money(createdOrder.totalAmount)}</p></div>
          {paymentView?.paymentStatus === "PAID" ? <div role="status" className="rounded-lg bg-success-soft p-4 text-success"><p className="font-semibold">Pembayaran berhasil</p><p className="mt-1 text-sm">Pesanan Anda telah dikonfirmasi.</p></div>
            : paymentView?.paymentStatus === "CANCELLED" || paymentView?.paymentStatus === "EXPIRED" ? <div role="status" className="rounded-lg bg-secondary p-4"><p className="font-semibold">{paymentView.paymentStatus === "CANCELLED" ? "Pesanan dibatalkan" : "Batas pembayaran berakhir"}</p></div>
              : paymentView?.qrUrl ? <><Image src={paymentView.qrUrl} alt="Kode QRIS untuk pembayaran" width={320} height={320} unoptimized className="mx-auto aspect-square w-64 rounded-lg border bg-white object-contain p-2" /><p className="text-sm">Pindai QRIS melalui aplikasi pembayaran Anda.</p><p className="text-xs text-muted-foreground">Batas pembayaran {new Date(createdOrder.expiresAt).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })} WIB{paymentView.paymentStatus === "PENDING" ? ` · ${Math.max(0, Math.ceil((new Date(createdOrder.expiresAt).getTime() - paymentNow) / 1000))} detik tersisa` : ""}</p></>
                : <div role="status" className="rounded-lg bg-secondary p-4"><p className="font-medium">{paymentBusy ? "Menyiapkan QRIS…" : paymentView?.attemptStatus === "FAILED" ? "Percobaan pembayaran gagal." : "Menunggu QRIS dari provider…"}</p><p className="mt-1 text-sm text-muted-foreground">Status pembayaran diperbarui otomatis.</p>{paymentView?.attemptStatus === "FAILED" && <Button className="mt-3" variant="outline" onClick={() => setPaymentRetry((count) => count + 1)}>Coba lagi</Button>}</div>}
          {paymentError && <p role="alert" className="text-sm text-destructive">{paymentError}</p>}
          {paymentView?.paymentStatus === "PENDING" && <Button type="button" variant="outline" className="w-full" onClick={() => setCancelOrderConfirm(true)}>Batalkan pesanan</Button>}
        </CardContent></Card>}
        {!cart.lines.length && <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Keranjang masih kosong.</CardContent></Card>}
        <div className="space-y-3">{cart.lines.map((line) => <Card key={line.key}><CardContent className="p-3"><div className="flex justify-between gap-3"><div><h3 className="font-medium">{line.menuName}</h3>{line.choiceLabels.map((label) => <p key={label} className="text-xs text-muted-foreground">{label}</p>)}{line.note && <p className="mt-1 text-xs text-muted-foreground">Catatan: {line.note}</p>}</div><strong className="whitespace-nowrap text-sm">{money(line.unitPrice * line.quantity)}</strong></div>
          {line.unavailable && <p role="alert" className="mt-2 text-sm text-destructive">{line.unavailable}</p>}
          {line.lineNotice && <div role="status" className="mt-2 flex items-center justify-between gap-2 rounded-md bg-warning-soft p-2 text-sm text-warning"><span>{line.lineNotice}</span><Button size="sm" variant="ghost" onClick={() => setCart((current) => ({ ...current, lines: current.lines.map((item) => item.key === line.key ? { ...item, lineNotice: null } : item) }))}>Mengerti</Button></div>}
          {line.needsAcceptance && <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-warning-soft p-2 text-sm text-warning"><span>Harga berubah: {money(line.unitPrice)} per item.</span><Button size="sm" variant="outline" onClick={() => setCart((current) => ({ ...current, lines: current.lines.map((item) => item.key === line.key ? { ...item, needsAcceptance: false } : item) }))}>Setujui harga baru</Button></div>}
          <div className="mt-3 flex items-center gap-3"><Button variant="outline" size="icon" aria-label="Kurangi jumlah" onClick={() => adjustLine(line, -1)}>−</Button><span>{line.quantity}</span><Button variant="outline" size="icon" aria-label="Tambah jumlah" disabled={line.quantity >= 99} onClick={() => adjustLine(line, 1)}>+</Button><Button variant="destructive" size="sm" className="ml-auto" onClick={() => setCartConfirmation({ kind: "line", line })}>Hapus</Button></div>
        </CardContent></Card>)}</div>
        <div className="space-y-2"><Label htmlFor="order-note">Catatan pesanan (opsional)</Label><Textarea id="order-note" maxLength={1000} rows={2} value={cart.orderNote} onChange={(event) => setCart({ ...cart, orderNote: event.target.value })} /></div>
        {cart.lines.length > 0 && <>
          <div className="space-y-2 rounded-lg border p-3"><Label htmlFor="voucher-code">Kode voucher</Label><div className="flex gap-2"><Input id="voucher-code" value={voucherCode} onChange={(event) => { setVoucherCode(event.target.value.toUpperCase()); setVoucherPreview(null); }} maxLength={40} autoCapitalize="characters" /><Button type="button" variant="outline" disabled={validatingVoucher || !voucherCode.trim()} onClick={() => void applyVoucher()}>{validatingVoucher ? "Memeriksa…" : "Terapkan"}</Button></div>{currentVoucher && <div role="status" className="flex items-center justify-between gap-2 text-sm"><span>{currentVoucher.name}: potongan {money(currentVoucher.discountAmount)}</span><Button type="button" variant="ghost" size="sm" onClick={() => { setVoucherCode(""); setVoucherPreview(null); }}>Hapus voucher</Button></div>}{voucherPreview && !currentVoucher && <p className="text-xs text-warning">Keranjang berubah. Terapkan ulang voucher sebelum membuat pesanan.</p>}</div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="customer-name">Nama pelanggan (opsional)</Label><Input id="customer-name" maxLength={120} value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="receipt-email">Email struk (opsional)</Label><Input id="receipt-email" type="email" maxLength={254} value={receiptEmail} onChange={(event) => setReceiptEmail(event.target.value)} /><p className="text-xs text-muted-foreground">Digunakan untuk mengirim struk setelah pembayaran.</p></div></div>
          <div className="space-y-2 border-t pt-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(cartTotal)}</span></div>{currentVoucher && <div className="flex justify-between text-success"><span>Diskon voucher</span><span>−{money(currentVoucher.discountAmount)}</span></div>}<div className="flex justify-between pt-1 text-base font-semibold"><span>Total</span><span>{money(orderTotal)}</span></div></div>
          <Button variant="ghost" className="text-destructive" onClick={() => setCartConfirmation({ kind: "clear" })}>Kosongkan keranjang</Button>
          <Button type="button" className="w-full" disabled={!isOpen || submittingOrder || cart.lines.some((line) => line.unavailable || line.needsAcceptance) || (Boolean(voucherCode.trim()) && !currentVoucher)} onClick={() => void createOrder()}>{submittingOrder ? "Membuat pesanan…" : "Buat pesanan"}</Button>
          <p className="text-center text-xs text-muted-foreground">Pesanan akan divalidasi dan dihitung ulang oleh server. Pembayaran QRIS dilanjutkan setelah order dibuat.</p>
        </>}
      </DialogContent>
    </Dialog>

    <AlertDialog open={cartConfirmation !== null} onOpenChange={(open) => { if (!open) setCartConfirmation(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{cartConfirmation?.kind === "clear" ? "Kosongkan keranjang?" : "Hapus item dari keranjang?"}</AlertDialogTitle><AlertDialogDescription>{cartConfirmation?.kind === "clear" ? "Semua item dalam keranjang akan dihapus." : `${cartConfirmation?.line.menuName} akan dihapus dari keranjang.`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={confirmCartAction}>{cartConfirmation?.kind === "clear" ? "Kosongkan" : "Hapus item"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={cancelOrderConfirm} onOpenChange={(open) => { if (!cancelBusy) setCancelOrderConfirm(open); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Batalkan pesanan?</AlertDialogTitle><AlertDialogDescription>Provider akan diperiksa sebelum pembatalan. Jika pembayaran sudah berhasil, pesanan tidak dibatalkan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={cancelBusy}>Kembali</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={cancelBusy} onClick={(event) => { event.preventDefault(); void cancelOrder(); }}>{cancelBusy ? "Memeriksa…" : "Batalkan pesanan"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
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
