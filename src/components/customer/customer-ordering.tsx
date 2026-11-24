"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { LoaderCircle, Search, X } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { MenuConfiguration } from "@/lib/catalog/built-in-templates";
import { priceForMenuChoice, type MenuChoice } from "@/lib/catalog/price";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Menu = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  sortOrder: number;
  configuration: MenuConfiguration;
};
type Category = { id: string; name: string; sortOrder: number; menus: Menu[] };
type Catalog = {
  table: { tableNumber: number };
  session: { id: string; expiresAt: string };
  operatingStatus: {
    status: "OPEN" | "TEMPORARILY_CLOSED" | "OUTSIDE_HOURS" | "NOT_CONFIGURED";
    nextOpeningAt?: string;
  };
  temporaryCloseReason: string | null;
  categories: Category[];
  retainedMenus: Menu[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};
type CatalogFilters = { search: string; category: string; page: number };
type CartLine = MenuChoice & {
  key: string;
  menuId: string;
  menuName: string;
  quantity: number;
  note: string;
  unitPrice: number;
  needsAcceptance: boolean;
  unavailable: string | null;
  lineNotice: string | null;
  choiceLabels: string[];
};
type CartState = { lines: CartLine[]; orderNote: string };
const emptyCart: CartState = { lines: [], orderNote: "" };
type VoucherPreview = {
  code: string;
  name: string;
  discountAmount: number;
  eligibleSubtotal: number;
  totalAmount: number;
  cartFingerprint: string;
};
type CreatedOrder = {
  id: string;
  orderNumber: string;
  status: "PENDING_PAYMENT";
  totalAmount: number;
  expiresAt: string;
  accessToken: string;
};
type PaymentView = {
  qrUrl: string | null;
  paymentStatus: string;
  attemptStatus: string | null;
  expiresAt: string;
  paidAt: string | null;
};
type CustomerPanelStep = "cart" | "checkout" | "payment";
type SubmittedOrderSummary = {
  tableNumber: number;
  lines: CartLine[];
  orderNotes: string;
};
const money = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

function syncCatalogUrl(filters: CatalogFilters, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.delete("search");
  url.searchParams.delete("category");
  url.searchParams.delete("page");
  if (filters.search.trim())
    url.searchParams.set("search", filters.search.trim());
  if (filters.category) url.searchParams.set("category", filters.category);
  if (filters.page > 1) url.searchParams.set("page", String(filters.page));
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return;
  if (replace) window.history.replaceState({}, "", next);
  else window.history.pushState({}, "", next);
}

function readCatalogFiltersFromUrl(): CatalogFilters {
  const params = new URLSearchParams(window.location.search);
  const requestedPage = Number(params.get("page") ?? "1");
  return {
    search: params.get("search")?.trim() ?? "",
    category: params.get("category") ?? "",
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
  };
}

export function CustomerOrdering({
  tableCode,
  initialFilters,
}: {
  tableCode: string;
  initialFilters: CatalogFilters;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [activeCategory, setActiveCategory] = useState(initialFilters.category);
  const [searchQuery, setSearchQuery] = useState(initialFilters.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters.search);
  const [currentPage, setCurrentPage] = useState(initialFilters.page);
  const [cart, setCart] = useState<CartState>(emptyCart);
  const [storageKey, setStorageKey] = useState("");
  const [selectedMenu, setSelectedMenu] = useState<Menu | null>(null);
  const [variantSelections, setVariantSelections] = useState<
    Record<string, string>
  >({});
  const [addonSelections, setAddonSelections] = useState<
    Record<string, Record<string, number>>
  >({});
  const [itemNote, setItemNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [showCart, setShowCart] = useState(false);
  const [panelStep, setPanelStep] = useState<CustomerPanelStep>("cart");
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);
  const [catalogQueryError, setCatalogQueryError] = useState("");
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [initialRetry, setInitialRetry] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [cartConfirmation, setCartConfirmation] = useState<
    { kind: "line"; line: CartLine } | { kind: "clear" } | null
  >(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherPreview, setVoucherPreview] = useState<VoucherPreview | null>(
    null,
  );
  const [validatingVoucher, setValidatingVoucher] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [receiptEmail, setReceiptEmail] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [submittedOrderSummary, setSubmittedOrderSummary] =
    useState<SubmittedOrderSummary | null>(null);
  const [paymentView, setPaymentView] = useState<PaymentView | null>(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [cancelOrderConfirm, setCancelOrderConfirm] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [paymentNow, setPaymentNow] = useState(0);
  const [paymentRetry, setPaymentRetry] = useState(0);
  const catalogRequestId = useRef(0);
  const hasLoadedInitialCatalog = useRef(false);
  const storageKeyRef = useRef("");
  const retainedMenuIdsRef = useRef<string[]>([]);
  const latestFiltersRef = useRef<CatalogFilters>(initialFilters);

  useEffect(() => {
    latestFiltersRef.current = {
      search: debouncedSearch,
      category: activeCategory,
      page: currentPage,
    };
  }, [debouncedSearch, activeCategory, currentPage]);

  useEffect(() => {
    storageKeyRef.current = storageKey;
  }, [storageKey]);

  useEffect(() => {
    retainedMenuIdsRef.current = [
      ...new Set([
        ...cart.lines.map((line) => line.menuId),
        ...(selectedMenu ? [selectedMenu.id] : []),
      ]),
    ];
  }, [cart.lines, selectedMenu]);

  const loadCatalog = useCallback(
    async (filters: CatalogFilters, signal?: AbortSignal) => {
      const requestId = ++catalogRequestId.current;
      const storageSessionKey = `qr-order-session:${tableCode}`;
      const knownSession = sessionStorage.getItem(storageSessionKey);
      const query = new URLSearchParams();
      if (knownSession) query.set("sessionId", knownSession);
      if (filters.search.trim()) query.set("search", filters.search.trim());
      if (filters.category) query.set("category", filters.category);
      if (filters.page > 1) query.set("page", String(filters.page));

      let savedCartMenuIds: string[] = [];
      if (knownSession) {
        try {
          const savedCart = JSON.parse(
            localStorage.getItem(
              `qr-order-cart:${tableCode}:${knownSession}`,
            ) ?? "null",
          ) as CartState | null;
          savedCartMenuIds = savedCart?.lines.map((line) => line.menuId) ?? [];
        } catch {
          savedCartMenuIds = [];
        }
      }
      const retainedMenuIds = [
        ...new Set([...retainedMenuIdsRef.current, ...savedCartMenuIds]),
      ];
      retainedMenuIds.forEach((menuId) => query.append("retainMenuId", menuId));
      const queryString = query.toString();
      const response = await fetch(
        `/api/v1/tables/${encodeURIComponent(tableCode)}/catalog${queryString ? `?${queryString}` : ""}`,
        { cache: "no-store", signal },
      );
      const result = await response.json();
      if (requestId !== catalogRequestId.current) return null;
      if (!response.ok) {
        if (result.error?.code === "SESSION_EXPIRED") setSessionExpired(true);
        throw new Error(result.message ?? "Meja atau katalog tidak tersedia.");
      }
      const next = result.data as Catalog;
      sessionStorage.setItem(storageSessionKey, next.session.id);
      try {
        const savedOrder = sessionStorage.getItem(
          `qr-order-created:${next.session.id}`,
        );
        if (savedOrder) {
          const order = JSON.parse(savedOrder) as CreatedOrder;
          setCreatedOrder(order);
          const savedSummary = sessionStorage.getItem(
            `qr-order-summary:${order.id}`,
          );
          if (savedSummary)
            setSubmittedOrderSummary(
              JSON.parse(savedSummary) as SubmittedOrderSummary,
            );
          setPaymentNow(Date.now());
          const savedPayment = sessionStorage.getItem(
            `qr-payment-view:${order.id}`,
          );
          if (savedPayment)
            setPaymentView(JSON.parse(savedPayment) as PaymentView);
        }
      } catch {
        sessionStorage.removeItem(`qr-order-created:${next.session.id}`);
      }
      setSessionExpired(false);
      hasLoadedInitialCatalog.current = true;
      setCatalog(next);
      if (
        filters.category &&
        !next.categories.some((item) => item.id === filters.category)
      ) {
        setActiveCategory("");
        setCurrentPage(1);
        syncCatalogUrl({ search: filters.search, category: "", page: 1 }, true);
      }
      const lastPage = Math.max(1, next.pagination.totalPages);
      if (filters.page > lastPage) {
        setCurrentPage(lastPage);
        syncCatalogUrl({ ...filters, page: lastPage }, true);
      }
      const key = `qr-order-cart:${tableCode}:${next.session.id}`;
      if (storageKeyRef.current !== key) {
        setStorageKey(key);
        try {
          setCart(
            (JSON.parse(localStorage.getItem(key) ?? "null") as CartState) ??
              emptyCart,
          );
        } catch {
          setCart(emptyCart);
        }
      }
      setError("");
      setCatalogQueryError("");
      return next;
    },
    [tableCode],
  );

  useEffect(() => {
    if (!createdOrder) return;
    let active = true;
    let pendingAttemptRetry: ReturnType<typeof setTimeout> | undefined;
    const updatePayment = (payment: PaymentView) => {
      if (!active) return;
      setPaymentView(payment);
      sessionStorage.setItem(
        `qr-payment-view:${createdOrder.id}`,
        JSON.stringify(payment),
      );
    };
    const fetchStatus = async () => {
      try {
        const response = await fetch(
          `/api/v1/orders/${createdOrder.id}/payment-status`,
          {
            headers: { Authorization: `Bearer ${createdOrder.accessToken}` },
            cache: "no-store",
          },
        );
        const result = await response.json();
        if (response.ok && result.data)
          updatePayment({
            qrUrl: result.data.qrUrl ?? null,
            paymentStatus: result.data.paymentStatus,
            attemptStatus: result.data.attemptStatus ?? null,
            expiresAt: result.data.paymentExpiresAt ?? result.data.expiresAt,
            paidAt: result.data.paidAt ?? null,
          });
      } catch {
        /* Polling/realtime will retry. */
      }
    };
    const ensureAttempt = async (retry = false) => {
      setPaymentBusy(true);
      setPaymentError("");
      try {
        const keyName = `qr-payment-idempotency:${createdOrder.id}`;
        let idempotencyKey = retry
          ? crypto.randomUUID()
          : sessionStorage.getItem(keyName);
        if (!idempotencyKey) idempotencyKey = crypto.randomUUID();
        sessionStorage.setItem(keyName, idempotencyKey);
        const response = await fetch(
          `/api/v1/orders/${createdOrder.id}/payment-attempts`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tableCode,
              accessToken: createdOrder.accessToken,
              idempotencyKey,
            }),
          },
        );
        const result = await response.json();
        if (!response.ok) {
          if (result.error?.code === "PAYMENT_QR_PENDING") {
            await fetchStatus();
            if (active)
              pendingAttemptRetry = setTimeout(
                () => void ensureAttempt(false),
                5000,
              );
            return;
          }
          throw new Error(result.message ?? "QRIS belum dapat dibuat.");
        }
        if (result.data.qrUrl)
          updatePayment({
            qrUrl: result.data.qrUrl,
            paymentStatus: "PENDING",
            attemptStatus: result.data.status ?? "PENDING",
            expiresAt: result.data.expiresAt,
            paidAt: null,
          });
        else if (result.data.status === "PAID")
          updatePayment({
            qrUrl: null,
            paymentStatus: "PAID",
            attemptStatus: "PAID",
            expiresAt: createdOrder.expiresAt,
            paidAt: new Date().toISOString(),
          });
        else if (result.data.status)
          updatePayment({
            qrUrl: null,
            paymentStatus: "PENDING",
            attemptStatus: result.data.status,
            expiresAt: result.data.expiresAt ?? createdOrder.expiresAt,
            paidAt: null,
          });
        await fetchStatus();
      } catch (error) {
        if (active)
          setPaymentError(
            error instanceof Error ? error.message : "QRIS belum dapat dibuat.",
          );
      } finally {
        if (active) setPaymentBusy(false);
      }
    };
    void ensureAttempt(paymentRetry > 0);
    const poll = setInterval(() => {
      if (
        !paymentRealtimeConnected ||
        Date.now() >= new Date(createdOrder.expiresAt).getTime()
      )
        void fetchStatus();
    }, 5000);
    let paymentRealtimeConnected = false;
    let channel:
      ReturnType<ReturnType<typeof createClient>["channel"]> | undefined;
    void crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(createdOrder.accessToken))
      .then((digest) => {
        if (!active) return;
        const tokenHash = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
        const supabase = createClient();
        channel = supabase
          .channel(`customer-payment:${createdOrder.id}:${tokenHash}`)
          .on(
            "broadcast",
            { event: "payment_status_changed" },
            () => void fetchStatus(),
          )
          .subscribe((status) => {
            paymentRealtimeConnected = status === "SUBSCRIBED";
            if (paymentRealtimeConnected) void fetchStatus();
          });
      })
      .catch(() => undefined);
    return () => {
      active = false;
      clearInterval(poll);
      if (pendingAttemptRetry) clearTimeout(pendingAttemptRetry);
      if (channel) void createClient().removeChannel(channel);
    };
  }, [createdOrder, paymentRetry, tableCode]);

  useEffect(() => {
    if (!createdOrder || paymentView?.paymentStatus !== "PENDING") return;
    const timer = setInterval(() => setPaymentNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [createdOrder, paymentView?.paymentStatus]);

  async function cancelOrder() {
    if (!createdOrder || !catalog) return;
    setCancelBusy(true);
    setPaymentError("");
    try {
      const response = await fetch(`/api/v1/orders/${createdOrder.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableCode,
          accessToken: createdOrder.accessToken,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Pesanan belum dapat dibatalkan.");
      setCancelOrderConfirm(false);
      await fetch(`/api/v1/orders/${createdOrder.id}/payment-status`, {
        headers: { Authorization: `Bearer ${createdOrder.accessToken}` },
        cache: "no-store",
      })
        .then((response) => response.json())
        .then((result) => {
          if (result.data)
            setPaymentView({
              qrUrl: result.data.qrUrl ?? null,
              paymentStatus: result.data.paymentStatus,
              attemptStatus: result.data.attemptStatus ?? null,
              expiresAt: result.data.paymentExpiresAt ?? result.data.expiresAt,
              paidAt: result.data.paidAt ?? null,
            });
        });
      if (result.data.paymentStatus === "PAID" || result.data.status === "PAID")
        toast.success("Pembayaran berhasil dikonfirmasi.");
      else toast.success("Pesanan dibatalkan.");
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : "Pesanan belum dapat dibatalkan.",
      );
    } finally {
      setCancelBusy(false);
    }
  }

  async function downloadPaymentQr() {
    if (!createdOrder || !paymentView?.qrUrl || downloadingQr) return;
    setDownloadingQr(true);
    try {
      const response = await fetch(
        `/api/v1/orders/${createdOrder.id}/payment-qr`,
        {
          headers: { Authorization: `Bearer ${createdOrder.accessToken}` },
          cache: "no-store",
        },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          result?.message ?? "QR pembayaran belum dapat diunduh.",
        );
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `qris-${createdOrder.orderNumber}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "QR pembayaran belum dapat diunduh.",
      );
    } finally {
      setDownloadingQr(false);
    }
  }

  useEffect(() => {
    // Initial catalog state is loaded from an external API.
    let active = true;
    hasLoadedInitialCatalog.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCatalog(initialFilters)
      .then((result) => {
        if (active && result) hasLoadedInitialCatalog.current = true;
      })
      .catch((loadError: unknown) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Katalog belum dapat dimuat.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let connected = false;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(
        () =>
          void loadCatalog(latestFiltersRef.current).catch(() =>
            setNotice(
              "Katalog belum dapat diperbarui. Coba muat ulang halaman.",
            ),
          ),
        150,
      );
    };
    const channel = supabase
      .channel(
        `public-catalog-${tableCode}-${Math.random().toString(36).slice(2)}`,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "catalog_change_notices" },
        scheduleRefresh,
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setNotice("Koneksi katalog terputus. Mencoba menyambung kembali.");
        if (status === "SUBSCRIBED") {
          setNotice("");
          if (connected) scheduleRefresh();
          connected = true;
        }
      });
    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [initialRetry, initialFilters, loadCatalog, tableCode]);

  useEffect(() => {
    const syncFromHistory = () => {
      const filters = readCatalogFiltersFromUrl();
      setSearchQuery(filters.search);
      setDebouncedSearch(filters.search);
      setActiveCategory(filters.category);
      setCurrentPage(filters.page);
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === debouncedSearch) return;
    const timer = setTimeout(() => {
      const search = searchQuery.trim();
      setDebouncedSearch(search);
      setCurrentPage(1);
      syncCatalogUrl({ search, category: activeCategory, page: 1 });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, debouncedSearch, activeCategory]);

  useEffect(() => {
    if (!hasLoadedInitialCatalog.current) return;
    const controller = new AbortController();
    setLoadingResults(true);
    setCatalogQueryError("");
    void loadCatalog(
      { search: debouncedSearch, category: activeCategory, page: currentPage },
      controller.signal,
    )
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted)
          setCatalogQueryError(
            requestError instanceof Error
              ? requestError.message
              : "Katalog belum dapat dimuat.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingResults(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, activeCategory, currentPage, catalogRetry, loadCatalog]);

  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [cart, storageKey]);

  useEffect(() => {
    if (!catalog) return;
    const remaining =
      new Date(catalog.session.expiresAt).getTime() - Date.now();
    const timer = setTimeout(
      () => void loadCatalog(latestFiltersRef.current).catch(() => undefined),
      Math.max(0, remaining),
    );
    return () => clearTimeout(timer);
  }, [catalog, loadCatalog]);

  useEffect(() => {
    if (!catalog) return;
    const menus = new Map(
      [
        ...catalog.categories.flatMap((category) => category.menus),
        ...catalog.retainedMenus,
      ].map((menu) => [menu.id, menu]),
    );
    // Reconcile persisted cart selections against the authoritative refreshed catalog.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCart((current) => ({
      ...current,
      lines: current.lines.map((line) => {
        const menu = menus.get(line.menuId);
        if (!menu)
          return {
            ...line,
            unavailable:
              "Menu tidak tersedia. Hapus item ini sebelum checkout.",
            needsAcceptance: false,
          };
        const reconciled = reconcileMenuChoice(menu, line);
        const result = priceForMenuChoice(
          menu.price,
          menu.configuration,
          reconciled.choice,
        );
        if (!result.valid)
          return {
            ...line,
            ...reconciled.choice,
            menuName: menu.name,
            unavailable: `${result.reason} Hapus item ini lalu tambahkan ulang.`,
            lineNotice: null,
            needsAcceptance: false,
          };
        const labels = choiceLabelsForMenu(menu, reconciled.choice);
        const choicesChanged =
          reconciled.changed ||
          JSON.stringify(labels) !== JSON.stringify(line.choiceLabels);
        return {
          ...line,
          ...reconciled.choice,
          menuName: menu.name,
          choiceLabels: labels,
          lineNotice: choicesChanged
            ? "Pilihan menu berubah dan sudah dihitung ulang. Periksa kembali item ini."
            : line.lineNotice,
          unavailable: null,
          unitPrice: result.unitPrice,
          needsAcceptance:
            result.unitPrice !== line.unitPrice ? true : line.needsAcceptance,
        };
      }),
    }));
  }, [catalog]);

  const cartCount = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cart.lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const cartFingerprint = JSON.stringify(
    cart.lines.map(
      ({ menuId, quantity, note, variantSelections, addonSelections }) => ({
        menuId,
        quantity,
        note,
        variantSelections,
        addonSelections,
      }),
    ),
  );
  const currentVoucher =
    voucherPreview?.cartFingerprint === cartFingerprint ? voucherPreview : null;
  const orderTotal = cartTotal - (currentVoucher?.discountAmount ?? 0);
  const selectedMenuPricing = selectedMenu
    ? priceForMenuChoice(selectedMenu.price, selectedMenu.configuration, {
        variantSelections,
        addonSelections,
      })
    : null;
  const receiptEmailInvalid = Boolean(
    receiptEmail.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiptEmail.trim()),
  );
  const isOpen = catalog?.operatingStatus.status === "OPEN";
  const matchingMenuCount = catalog?.pagination.totalItems ?? 0;
  const visibleCategories =
    catalog?.categories.filter(
      (category) => category.menus.length > 0 || category.id === activeCategory,
    ) ?? [];
  const hasActiveMenuFilters = Boolean(debouncedSearch || activeCategory);

  async function applyVoucher() {
    if (!catalog || !voucherCode.trim() || !cart.lines.length) return;
    setValidatingVoucher(true);
    try {
      const response = await fetch("/api/v1/vouchers/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableCode,
          sessionId: catalog.session.id,
          code: voucherCode,
          items: cart.lines.map(
            ({
              menuId,
              quantity,
              note,
              variantSelections,
              addonSelections,
            }) => ({
              menuId,
              quantity,
              note,
              variantSelections,
              addonSelections,
            }),
          ),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Voucher belum dapat diperiksa.");
      if (!result.data.valid) {
        setVoucherPreview(null);
        toast.error(result.data.reason);
        return;
      }
      setVoucherPreview({ ...result.data, cartFingerprint });
      toast.success("Voucher berhasil diterapkan.");
    } catch (voucherError) {
      toast.error(
        voucherError instanceof Error
          ? voucherError.message
          : "Voucher belum dapat diperiksa.",
      );
    } finally {
      setValidatingVoucher(false);
    }
  }

  async function createOrder() {
    if (!catalog || !cart.lines.length || !isOpen || submittingOrder) return;
    if (cart.lines.some((line) => line.unavailable || line.needsAcceptance)) {
      setError(
        "Periksa menu yang tidak tersedia atau setujui perubahan harga sebelum checkout.",
      );
      return;
    }
    if (voucherCode.trim() && !currentVoucher) {
      setError("Periksa kembali voucher setelah perubahan keranjang.");
      return;
    }
    setSubmittingOrder(true);
    setError("");
    try {
      const pendingKey = `qr-order-pending:${catalog.session.id}:${cartFingerprint}`;
      let pending: { idempotencyKey: string; accessToken: string } | null =
        null;
      try {
        pending = JSON.parse(
          sessionStorage.getItem(pendingKey) ?? "null",
        ) as typeof pending;
      } catch {
        pending = null;
      }
      if (!pending) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const accessToken = btoa(String.fromCharCode(...bytes))
          .replaceAll("+", "-")
          .replaceAll("/", "_")
          .replaceAll("=", "");
        pending = { idempotencyKey: crypto.randomUUID(), accessToken };
        sessionStorage.setItem(pendingKey, JSON.stringify(pending));
      }
      const response = await fetch(
        `/api/v1/sessions/${encodeURIComponent(catalog.session.id)}/orders`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableCode,
            idempotencyKey: pending.idempotencyKey,
            accessToken: pending.accessToken,
            customerName,
            receiptEmail: receiptEmail.trim() || null,
            orderNotes: cart.orderNote,
            voucherCode: currentVoucher?.code ?? null,
            items: cart.lines.map(
              ({
                menuId,
                quantity,
                note,
                variantSelections,
                addonSelections,
              }) => ({
                menuId,
                quantity,
                note,
                variantSelections,
                addonSelections,
              }),
            ),
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        if (result.error?.code === "SESSION_EXPIRED") setSessionExpired(true);
        throw new Error(result.message ?? "Pesanan belum dapat dibuat.");
      }
      const order = result.data as CreatedOrder;
      const summary: SubmittedOrderSummary = {
        tableNumber: catalog.table.tableNumber,
        lines: cart.lines.map((line) => ({ ...line })),
        orderNotes: cart.orderNote,
      };
      setCreatedOrder(order);
      setSubmittedOrderSummary(summary);
      setPaymentView(null);
      setPaymentError("");
      setPanelStep("payment");
      setShowCart(true);
      setPaymentNow(Date.now());
      sessionStorage.setItem(
        `qr-order-created:${catalog.session.id}`,
        JSON.stringify(order),
      );
      sessionStorage.setItem(
        `qr-order-summary:${order.id}`,
        JSON.stringify(summary),
      );
      sessionStorage.removeItem(pendingKey);
      setCart({ ...emptyCart });
      setVoucherCode("");
      setVoucherPreview(null);
      localStorage.removeItem(storageKey);
      toast.success("Pesanan dibuat dan menunggu pembayaran.");
    } catch (orderError) {
      const message =
        orderError instanceof Error
          ? orderError.message
          : "Pesanan belum dapat dibuat.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmittingOrder(false);
    }
  }

  function openMenu(menu: Menu) {
    setSelectedMenu(menu);
    setVariantSelections({});
    setAddonSelections({});
    setItemNote("");
    setQuantity(1);
  }

  function addToCart(
    menu: Menu,
    choice: MenuChoice,
    rawNote: string,
    addQuantity: number,
  ) {
    if (!isOpen || !catalog) return false;
    const currentMenu = [
      ...catalog.categories.flatMap((category) => category.menus),
      ...catalog.retainedMenus,
    ].find((item) => item.id === menu.id);
    if (!currentMenu) {
      setNotice("Menu sudah tidak tersedia. Periksa katalog yang diperbarui.");
      setSelectedMenu(null);
      return false;
    }
    const priced = priceForMenuChoice(
      currentMenu.price,
      currentMenu.configuration,
      choice,
    );
    if (!priced.valid) {
      setNotice(priced.reason);
      return false;
    }
    const note = rawNote.trim();
    const choiceLabels = choiceLabelsForMenu(currentMenu, choice);
    const signature = lineKey(currentMenu.id, note, choice);
    setCart((current) => {
      const found = current.lines.find((line) => line.key === signature);
      if (found)
        return {
          ...current,
          lines: current.lines.map((line) =>
            line.key === signature
              ? {
                  ...line,
                  quantity: Math.min(99, line.quantity + addQuantity),
                }
              : line,
          ),
        };
      return {
        ...current,
        lines: [
          ...current.lines,
          {
            ...choice,
            key: signature,
            menuId: currentMenu.id,
            menuName: currentMenu.name,
            quantity: addQuantity,
            note,
            unitPrice: priced.unitPrice,
            needsAcceptance: false,
            unavailable: null,
            lineNotice: null,
            choiceLabels,
          },
        ],
      };
    });
    setNotice("");
    return true;
  }

  function removeLine(key: string) {
    setCart((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.key !== key),
    }));
  }
  function adjustLine(line: CartLine, delta: number) {
    if (delta < 0 && line.quantity === 1) {
      setCartConfirmation({ kind: "line", line });
      return;
    }
    setCart((current) => ({
      ...current,
      lines: current.lines.map((item) =>
        item.key === line.key
          ? {
              ...item,
              quantity: Math.max(1, Math.min(99, item.quantity + delta)),
            }
          : item,
      ),
    }));
  }

  function confirmCartAction() {
    if (cartConfirmation?.kind === "line")
      removeLine(cartConfirmation.line.key);
    else if (cartConfirmation?.kind === "clear") setCart({ ...emptyCart });
    setCartConfirmation(null);
  }

  function selectCategory(categoryId: string) {
    const search = searchQuery.trim();
    setActiveCategory(categoryId);
    setCurrentPage(1);
    setDebouncedSearch(search);
    syncCatalogUrl({ search, category: categoryId, page: 1 });
  }

  function clearMenuFilters() {
    setSearchQuery("");
    setDebouncedSearch("");
    setActiveCategory("");
    setCurrentPage(1);
    syncCatalogUrl({ search: "", category: "", page: 1 });
  }

  function selectCatalogPage(page: number) {
    const nextPage = Math.max(
      1,
      Math.min(catalog?.pagination.totalPages ?? 1, page),
    );
    setCurrentPage(nextPage);
    syncCatalogUrl({
      search: debouncedSearch,
      category: activeCategory,
      page: nextPage,
    });
  }

  if (loading)
    return (
      <main
        aria-busy="true"
        aria-label="Memuat menu"
        className="min-h-svh bg-background pb-28"
      >
        <span className="sr-only" role="status">
          Memuat menu…
        </span>
        <header className="border-b bg-card px-4 py-4">
          <div className="mx-auto max-w-5xl space-y-2">
            <Skeleton aria-hidden="true" className="h-3 w-24" />
            <Skeleton aria-hidden="true" className="h-6 w-44" />
            <Skeleton aria-hidden="true" className="h-3 w-36" />
          </div>
        </header>
        <div
          aria-hidden="true"
          className="sticky top-0 flex gap-2 overflow-hidden border-b bg-background px-4 py-3"
        >
          <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
          <Skeleton className="h-9 w-20 shrink-0 rounded-full" />
        </div>
        <div
          aria-hidden="true"
          className="mx-auto grid max-w-5xl gap-3 px-4 py-5 md:grid-cols-2"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="flex gap-3 rounded-xl border bg-card p-3"
            >
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-4 w-2/5" />
              </div>
              <Skeleton className="size-24 shrink-0 rounded-lg md:size-28" />
            </div>
          ))}
        </div>
        <Skeleton
          aria-hidden="true"
          className="fixed inset-x-4 bottom-4 mx-auto h-14 max-w-lg rounded-lg"
        />
      </main>
    );
  if (sessionExpired)
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold">Sesi meja berakhir</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Pindai ulang QR meja untuk memulai sesi baru. Keranjang pada sesi
            sebelumnya tidak dipindahkan.
          </p>
          <Button
            onClick={() => {
              sessionStorage.removeItem(`qr-order-session:${tableCode}`);
              setCatalog(null);
              setLoading(true);
              setError("");
              setInitialRetry((value) => value + 1);
            }}
            className="mt-4"
          >
            Pindai ulang QR meja
          </Button>
        </div>
      </main>
    );
  if (error && !catalog)
    return (
      <main className="grid min-h-svh place-items-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-semibold">Katalog belum dapat dimuat</h1>
          <p role="alert" className="mt-2 text-sm text-muted-foreground">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => {
              setError("");
              setLoading(true);
              setInitialRetry((value) => value + 1);
            }}
          >
            Coba lagi
          </Button>
        </div>
      </main>
    );
  if (!catalog) return null;

  return (
    <main className="min-h-svh bg-background pb-28">
      <header className="border-b bg-card px-4 py-4">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            QR Restaurant
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            Menu · Meja {String(catalog.table.tableNumber).padStart(2, "0")}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Sesi berakhir{" "}
            {new Date(catalog.session.expiresAt).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </header>
      {!isOpen && (
        <div className="border-b border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <div className="mx-auto max-w-5xl">
            {catalog.operatingStatus.status === "TEMPORARILY_CLOSED"
              ? `Restoran tutup sementara${catalog.temporaryCloseReason ? `: ${catalog.temporaryCloseReason}` : "."}`
              : catalog.operatingStatus.status === "OUTSIDE_HOURS"
                ? `Di luar jam operasional. Buka kembali ${catalog.operatingStatus.nextOpeningAt ? new Date(catalog.operatingStatus.nextOpeningAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "short", timeStyle: "short" }) : "sesuai jadwal"}.`
                : "Jam operasional belum diatur. Pemesanan belum tersedia."}{" "}
            Katalog tetap dapat dilihat.
          </div>
        </div>
      )}
      {createdOrder && (
        <div className="mx-auto max-w-5xl px-4 pt-3">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="font-medium">
                  Pesanan {createdOrder.orderNumber}
                </p>
                <p className="text-sm text-muted-foreground">
                  {paymentView?.paymentStatus === "PAID"
                    ? "Pembayaran terkonfirmasi"
                    : paymentView?.paymentStatus === "CANCELLED"
                      ? "Pesanan dibatalkan"
                      : paymentView?.paymentStatus === "EXPIRED"
                        ? "Batas pembayaran berakhir"
                        : "Status pembayaran diperbarui otomatis"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPanelStep("payment");
                  setShowCart(true);
                }}
              >
                Lihat pesanan
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="mx-auto max-w-5xl px-4 pt-3 text-sm text-warning"
        >
          {notice}
        </p>
      )}
      <section
        aria-label="Cari dan filter menu"
        className="mx-auto max-w-5xl px-4 pt-4"
      >
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Cari menu berdasarkan nama atau deskripsi"
            type="text"
            role="searchbox"
            placeholder="Cari menu..."
            maxLength={200}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-11 bg-card pl-10 pr-10"
          />
          {searchQuery.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Hapus pencarian"
              onClick={() => setSearchQuery("")}
              className="absolute right-1 top-1/2 size-9 -translate-y-1/2"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p
            aria-live="polite"
            aria-atomic="true"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            {loadingResults && (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            )}
            {loadingResults
              ? "Memuat hasil menu…"
              : `${matchingMenuCount} menu ditemukan`}
          </p>
          {Boolean(searchQuery.trim() || activeCategory) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearMenuFilters}
            >
              Hapus filter
            </Button>
          )}
        </div>
      </section>
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <nav
          aria-label="Kategori menu"
          className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3"
        >
          <Button
            type="button"
            variant={activeCategory === "" ? "default" : "outline"}
            aria-pressed={activeCategory === ""}
            onClick={() => selectCategory("")}
            className="shrink-0 rounded-full"
          >
            Semua
          </Button>
          {catalog.categories.map((category) => (
            <Button
              type="button"
              key={category.id}
              variant={activeCategory === category.id ? "default" : "outline"}
              aria-pressed={activeCategory === category.id}
              onClick={() => selectCategory(category.id)}
              className="shrink-0 rounded-full"
            >
              {category.name}
            </Button>
          ))}
        </nav>
      </div>
      <div
        aria-busy={loadingResults}
        inert={loadingResults}
        className={cn(
          "mx-auto max-w-5xl px-4 py-5 transition-opacity motion-reduce:transition-none",
          loadingResults && "opacity-60",
        )}
      >
        {catalogQueryError ? (
          <Card>
            <CardContent className="space-y-3 p-8 text-center">
              <p role="alert" className="text-sm text-destructive">
                {catalogQueryError}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCatalogRetry((value) => value + 1)}
              >
                Coba lagi
              </Button>
            </CardContent>
          </Card>
        ) : matchingMenuCount === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {hasActiveMenuFilters
                  ? activeCategory && !debouncedSearch
                    ? "Belum ada menu dalam kategori ini."
                    : "Tidak ada menu yang cocok dengan pencarian atau filter Anda."
                  : "Menu belum tersedia."}
              </p>
              {hasActiveMenuFilters && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearMenuFilters}
                >
                  Hapus pencarian dan filter
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          visibleCategories.map((category) => (
            <section
              id={`category-${category.id}`}
              key={category.id}
              className="mb-8 scroll-mt-20"
            >
              <h2 className="mb-3 text-section-title font-semibold">
                {category.name}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {category.menus.map((menu) => {
                  const customizable =
                    menu.configuration.variants.length +
                      menu.configuration.addons.length >
                    0;
                  const lines = cart.lines.filter(
                    (line) => line.menuId === menu.id,
                  );
                  const inCart = lines.reduce(
                    (sum, line) => sum + line.quantity,
                    0,
                  );
                  const plainKey = lineKey(menu.id, "", noChoice);
                  // The card stepper may only drive a single plain line; noted/configured lines are edited in the cart.
                  const stepperLine =
                    !customizable &&
                    lines.every((line) => line.key === plainKey)
                      ? lines[0]
                      : undefined;
                  return (
                    <div
                      key={menu.id}
                      className="relative flex gap-3 rounded-xl border bg-card p-3 transition-shadow hover:shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium">
                          <button
                            type="button"
                            disabled={!isOpen}
                            onClick={() => openMenu(menu)}
                            className="line-clamp-2 text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50 disabled:cursor-not-allowed"
                          >
                            {menu.name}
                          </button>
                        </h3>
                        {menu.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {menu.description}
                          </p>
                        )}
                        <p className="mt-2 text-sm font-semibold tabular-nums">
                          {money(menu.price)}
                        </p>
                        {customizable && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Dapat disesuaikan
                          </p>
                        )}
                        {inCart > 0 && !stepperLine && (
                          <p className="mt-1 text-xs font-medium text-primary">
                            {inCart} di keranjang
                          </p>
                        )}
                      </div>
                      <div className="flex w-24 shrink-0 flex-col items-center md:w-28">
                        {menu.imageUrl ? (
                          <Image
                            src={menu.imageUrl}
                            alt=""
                            width={224}
                            height={224}
                            unoptimized
                            className="aspect-square w-full rounded-lg object-cover"
                          />
                        ) : (
                          <div
                            aria-hidden="true"
                            className="grid aspect-square w-full place-items-center rounded-lg bg-secondary text-3xl text-muted-foreground"
                          >
                            🍽
                          </div>
                        )}
                        <div className="relative z-10 -mt-5">
                          {stepperLine ? (
                            <div className="flex items-center rounded-full border bg-background shadow-sm">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="rounded-full"
                                aria-label={`Kurangi jumlah ${menu.name}`}
                                disabled={!isOpen}
                                onClick={() => adjustLine(stepperLine, -1)}
                              >
                                −
                              </Button>
                              <span
                                className="min-w-5 text-center text-sm font-medium tabular-nums"
                                aria-live="polite"
                              >
                                {stepperLine.quantity}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="rounded-full"
                                aria-label={`Tambah jumlah ${menu.name}`}
                                disabled={!isOpen || stepperLine.quantity >= 99}
                                onClick={() => adjustLine(stepperLine, 1)}
                              >
                                +
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-full border-primary px-5 text-primary shadow-sm hover:text-primary"
                              aria-label={`Tambah ${menu.name}`}
                              disabled={!isOpen}
                              onClick={() =>
                                customizable || lines.length
                                  ? openMenu(menu)
                                  : addToCart(menu, noChoice, "", 1)
                              }
                            >
                              Tambah
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
        {!catalogQueryError && catalog.pagination.totalPages > 1 && (
          <nav
            aria-label="Halaman menu"
            className="flex items-center justify-center gap-2 border-t pt-4"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loadingResults}
              onClick={() => selectCatalogPage(1)}
            >
              Pertama
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || loadingResults}
              onClick={() => selectCatalogPage(currentPage - 1)}
            >
              Sebelumnya
            </Button>
            <span
              aria-live="polite"
              className="px-2 text-sm text-muted-foreground"
            >
              Halaman {currentPage} dari {catalog.pagination.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                currentPage >= catalog.pagination.totalPages || loadingResults
              }
              onClick={() => selectCatalogPage(currentPage + 1)}
            >
              Berikutnya
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                currentPage >= catalog.pagination.totalPages || loadingResults
              }
              onClick={() => selectCatalogPage(catalog.pagination.totalPages)}
            >
              Terakhir
            </Button>
          </nav>
        )}
      </div>

      <Button
        onClick={() => {
          setPanelStep(cartCount ? "cart" : createdOrder ? "payment" : "cart");
          setShowCart(true);
        }}
        className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mx-auto flex h-auto max-w-lg items-center justify-between px-5 py-4 text-left shadow-lg"
      >
        <span>
          <strong>{cartCount ? "Keranjang" : "Pesanan"}</strong>
          <span className="ml-2 text-sm text-primary-foreground/80">
            {cartCount
              ? `${cartCount} item`
              : (createdOrder?.orderNumber ?? "Pilih menu")}
          </span>
        </span>
        <strong>
          {cartCount ? money(cartTotal) : createdOrder ? "Lihat" : "Buka"}
        </strong>
      </Button>

      <Sheet
        open={selectedMenu !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedMenu(null);
        }}
      >
        {selectedMenu && (
          <SheetContent
            side="bottom"
            className="max-h-[92dvh] gap-0 overflow-y-auto p-0 md:inset-x-auto md:bottom-auto md:left-1/2 md:right-auto md:top-1/2 md:max-h-[88dvh] md:w-[min(36rem,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-overlay md:border"
          >
            <SheetHeader className="shrink-0 border-b px-5 py-4 pr-14 text-left">
              <SheetTitle>{selectedMenu.name}</SheetTitle>
              <SheetDescription>
                {selectedMenu.description ||
                  `Harga dasar ${money(selectedMenu.price)}`}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-5 py-4">
              {selectedMenu.imageUrl && (
                <Image
                  src={selectedMenu.imageUrl}
                  alt=""
                  width={600}
                  height={600}
                  unoptimized
                  className="aspect-square max-h-64 w-full rounded-lg object-cover"
                />
              )}
              <p className="font-semibold">
                Harga dasar {money(selectedMenu.price)}
              </p>
              {selectedMenu.configuration.variants.map((group, groupIndex) => (
                <fieldset key={group.id ?? groupIndex} className="space-y-3">
                  <legend className="font-medium">
                    {group.name}
                    {group.required ? (
                      <span className="ml-1 text-destructive">*</span>
                    ) : (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (opsional)
                      </span>
                    )}
                  </legend>
                  <RadioGroup
                    value={group.id ? (variantSelections[group.id] ?? "") : ""}
                    onValueChange={(optionId) => {
                      if (group.id)
                        setVariantSelections((current) => ({
                          ...current,
                          [group.id as string]: optionId,
                        }));
                    }}
                    className="space-y-2"
                  >
                    {group.options.map((option, optionIndex) => {
                      const id = `variant-${group.id ?? groupIndex}-${option.id ?? optionIndex}`;
                      return (
                        <div
                          key={option.id ?? optionIndex}
                          className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                        >
                          <RadioGroupItem
                            id={id}
                            value={option.id ?? ""}
                            disabled={!option.id || !option.isActive}
                          />
                          <Label
                            htmlFor={id}
                            className="flex flex-1 cursor-pointer items-center justify-between gap-2 font-normal"
                          >
                            <span>{option.name}</span>
                            <span>
                              {option.pricingMode === "OVERRIDE"
                                ? `Harga ${money(option.priceValue)}`
                                : option.priceValue
                                  ? `+${money(option.priceValue)}`
                                  : "Tanpa biaya"}
                            </span>
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </fieldset>
              ))}
              {selectedMenu.configuration.addons.map((group, groupIndex) => {
                const selection = group.id
                  ? (addonSelections[group.id] ?? {})
                  : {};
                return (
                  <fieldset key={group.id ?? groupIndex} className="space-y-3">
                    <legend className="font-medium">
                      {group.name}{" "}
                      <span className="text-xs text-muted-foreground">
                        (pilih {group.minSelect}–{group.maxSelect})
                      </span>
                    </legend>
                    <div className="space-y-2">
                      {group.options.map((option, optionIndex) => {
                        const count = option.id
                          ? (selection[option.id] ?? 0)
                          : 0;
                        const selectedCount = Object.values(selection).filter(
                          (value) => value > 0,
                        ).length;
                        return (
                          <div
                            key={option.id ?? optionIndex}
                            className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                          >
                            <span className="flex-1">
                              {option.name}
                              <span className="ml-2 text-muted-foreground">
                                +{money(option.unitPrice)} / tambahan
                              </span>
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              aria-label={`Kurangi ${option.name}`}
                              disabled={!count}
                              onClick={() => {
                                if (!group.id || !option.id) return;
                                const next = { ...selection };
                                if (count <= 1) delete next[option.id];
                                else next[option.id] = count - 1;
                                setAddonSelections({
                                  ...addonSelections,
                                  [group.id]: next,
                                });
                              }}
                            >
                              −
                            </Button>
                            <span className="w-5 text-center">{count}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              aria-label={`Tambah ${option.name}`}
                              disabled={
                                !group.id ||
                                !option.id ||
                                (count === 0 &&
                                  selectedCount >= group.maxSelect) ||
                                count >= 99
                              }
                              onClick={() => {
                                if (!group.id || !option.id) return;
                                setAddonSelections({
                                  ...addonSelections,
                                  [group.id]: {
                                    ...selection,
                                    [option.id]: count + 1,
                                  },
                                });
                              }}
                            >
                              +
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
              <div className="space-y-2">
                <Label htmlFor="item-note">Catatan item (opsional)</Label>
                <Textarea
                  id="item-note"
                  maxLength={500}
                  value={itemNote}
                  onChange={(event) => setItemNote(event.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-quantity">Jumlah</Label>
                <Input
                  id="item-quantity"
                  type="number"
                  min="1"
                  max="99"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      Math.max(1, Math.min(99, Number(event.target.value))),
                    )
                  }
                  className="w-28"
                />
              </div>
            </div>
            <SheetFooter className="sticky bottom-0 z-10 border-t bg-background px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:static">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  {selectedMenuPricing?.valid
                    ? `${money(selectedMenuPricing.unitPrice)} / item`
                    : "Lengkapi pilihan"}
                </span>
                <strong className="tabular-nums">
                  {selectedMenuPricing?.valid
                    ? money(selectedMenuPricing.unitPrice * quantity)
                    : "—"}
                </strong>
              </div>
              {selectedMenuPricing && !selectedMenuPricing.valid && (
                <p role="status" className="text-xs text-warning">
                  {selectedMenuPricing.reason}
                </p>
              )}
              <Button
                disabled={!isOpen || !selectedMenuPricing?.valid}
                onClick={() => {
                  if (
                    addToCart(
                      selectedMenu,
                      { variantSelections, addonSelections },
                      itemNote,
                      quantity,
                    )
                  ) {
                    setSelectedMenu(null);
                    toast.success(
                      `${selectedMenu.name} ditambahkan ke keranjang.`,
                    );
                  }
                }}
                className="w-full"
              >
                Tambah ke keranjang
              </Button>
            </SheetFooter>
          </SheetContent>
        )}
      </Sheet>

      <Sheet
        open={showCart}
        onOpenChange={(open) => {
          setShowCart(open);
          if (open && !cartCount && createdOrder) setPanelStep("payment");
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[94dvh] gap-0 overflow-hidden p-0 md:inset-x-auto md:bottom-auto md:left-1/2 md:right-auto md:top-1/2 md:max-h-[88dvh] md:w-[min(44rem,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-overlay md:border"
        >
          <SheetHeader className="shrink-0 border-b px-5 py-4 pr-14 text-left">
            <SheetTitle>
              {panelStep === "checkout"
                ? "Periksa pesanan"
                : panelStep === "payment"
                  ? "Pembayaran"
                  : "Keranjang"}
            </SheetTitle>
            <SheetDescription>
              {panelStep === "checkout"
                ? "Periksa detail sebelum membuat pesanan."
                : panelStep === "payment" && createdOrder
                  ? createdOrder.orderNumber +
                    " · Meja " +
                    String(
                      submittedOrderSummary?.tableNumber ??
                        catalog.table.tableNumber,
                    ).padStart(2, "0")
                  : cartCount +
                    " item · " +
                    money(orderTotal) +
                    " sebelum pembayaran"}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
            {panelStep === "cart" && (
              <div className="space-y-4">
                {!cart.lines.length ? (
                  <div className="space-y-3 py-8 text-center">
                    <p className="font-medium">Keranjang masih kosong</p>
                    <p className="text-sm text-muted-foreground">
                      Pilih menu dan sesuaikan pesanan Anda.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setShowCart(false)}
                    >
                      Kembali ke menu
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {cart.lines.map((line) => (
                        <Card key={line.key}>
                          <CardContent className="p-3">
                            <div className="flex justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="font-medium">{line.menuName}</h3>
                                {line.choiceLabels.map((label) => (
                                  <p
                                    key={label}
                                    className="text-sm text-muted-foreground"
                                  >
                                    {label}
                                  </p>
                                ))}
                                {line.note && (
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    Catatan: {line.note}
                                  </p>
                                )}
                              </div>
                              <strong className="whitespace-nowrap text-sm tabular-nums">
                                {money(line.unitPrice * line.quantity)}
                              </strong>
                            </div>
                            {line.unavailable && (
                              <p
                                role="alert"
                                className="mt-2 text-sm text-destructive"
                              >
                                {line.unavailable}
                              </p>
                            )}
                            {line.lineNotice && (
                              <div
                                role="status"
                                className="mt-2 space-y-2 rounded-md bg-warning-soft p-2 text-sm text-warning"
                              >
                                <p>{line.lineNotice}</p>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    setCart((current) => ({
                                      ...current,
                                      lines: current.lines.map((item) =>
                                        item.key === line.key
                                          ? { ...item, lineNotice: null }
                                          : item,
                                      ),
                                    }))
                                  }
                                >
                                  Mengerti
                                </Button>
                              </div>
                            )}
                            {line.needsAcceptance && (
                              <div className="mt-2 space-y-2 rounded-md bg-warning-soft p-2 text-sm text-warning">
                                <p>
                                  Harga berubah menjadi {money(line.unitPrice)}{" "}
                                  per item. Setujui harga baru untuk
                                  melanjutkan.
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setCart((current) => ({
                                      ...current,
                                      lines: current.lines.map((item) =>
                                        item.key === line.key
                                          ? { ...item, needsAcceptance: false }
                                          : item,
                                      ),
                                    }))
                                  }
                                >
                                  Setujui harga baru
                                </Button>
                              </div>
                            )}
                            <div className="mt-3 flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label={"Kurangi jumlah " + line.menuName}
                                onClick={() => adjustLine(line, -1)}
                              >
                                −
                              </Button>
                              <span
                                className="min-w-6 text-center tabular-nums"
                                aria-live="polite"
                              >
                                {line.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label={"Tambah jumlah " + line.menuName}
                                disabled={line.quantity >= 99}
                                onClick={() => adjustLine(line, 1)}
                              >
                                +
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="ml-auto text-destructive"
                                onClick={() =>
                                  setCartConfirmation({ kind: "line", line })
                                }
                              >
                                Hapus
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="space-y-3 rounded-lg border p-3">
                      <div className="space-y-2">
                        <Label htmlFor="voucher-code">
                          Kode voucher (opsional)
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="voucher-code"
                            value={voucherCode}
                            onChange={(event) => {
                              setVoucherCode(event.target.value.toUpperCase());
                              setVoucherPreview(null);
                            }}
                            maxLength={40}
                            autoCapitalize="characters"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={validatingVoucher || !voucherCode.trim()}
                            onClick={() => void applyVoucher()}
                          >
                            {validatingVoucher ? "Memeriksa…" : "Terapkan"}
                          </Button>
                        </div>
                      </div>
                      {currentVoucher && (
                        <div
                          role="status"
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span>
                            {currentVoucher.name}: potongan{" "}
                            {money(currentVoucher.discountAmount)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setVoucherCode("");
                              setVoucherPreview(null);
                            }}
                          >
                            Hapus voucher
                          </Button>
                        </div>
                      )}
                      {voucherPreview && !currentVoucher && (
                        <p role="status" className="text-sm text-warning">
                          Keranjang berubah. Terapkan ulang voucher sebelum
                          checkout.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 border-t pt-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span>Subtotal</span>
                        <span className="tabular-nums">{money(cartTotal)}</span>
                      </div>
                      {currentVoucher && (
                        <div className="flex justify-between gap-3 text-success">
                          <span>Diskon voucher</span>
                          <span className="tabular-nums">
                            −{money(currentVoucher.discountAmount)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between gap-3 pt-1 text-base font-semibold">
                        <span>Total sementara</span>
                        <span className="tabular-nums">
                          {money(orderTotal)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Total akhir dihitung dan dikonfirmasi oleh server saat
                        pesanan dibuat.
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setCartConfirmation({ kind: "clear" })}
                    >
                      Kosongkan keranjang
                    </Button>
                  </>
                )}
              </div>
            )}

            {panelStep === "checkout" && (
              <div className="space-y-5">
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer-name">
                      Nama pelanggan (opsional)
                    </Label>
                    <Input
                      id="customer-name"
                      maxLength={120}
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="checkout-order-note">
                      Catatan pesanan (opsional)
                    </Label>
                    <Textarea
                      id="checkout-order-note"
                      maxLength={1000}
                      rows={3}
                      value={cart.orderNote}
                      onChange={(event) =>
                        setCart((current) => ({
                          ...current,
                          orderNote: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="receipt-email">
                      Email struk (opsional)
                    </Label>
                    <Input
                      id="receipt-email"
                      type="email"
                      maxLength={254}
                      value={receiptEmail}
                      onChange={(event) => setReceiptEmail(event.target.value)}
                      aria-invalid={receiptEmailInvalid}
                      aria-describedby={
                        receiptEmailInvalid
                          ? "receipt-email-help receipt-email-error"
                          : "receipt-email-help"
                      }
                    />
                    <p
                      id="receipt-email-help"
                      className="text-sm text-muted-foreground"
                    >
                      Struk dikirim setelah pembayaran berhasil dikonfirmasi.
                    </p>
                    {receiptEmailInvalid && (
                      <p
                        id="receipt-email-error"
                        className="text-sm text-destructive"
                      >
                        Masukkan alamat email dengan format yang benar.
                      </p>
                    )}
                  </div>
                </div>
                <section
                  aria-labelledby="checkout-summary-title"
                  className="space-y-3 border-t pt-4"
                >
                  <h3 id="checkout-summary-title" className="font-semibold">
                    Ringkasan pesanan
                  </h3>
                  <div className="space-y-3">
                    {cart.lines.map((line) => (
                      <div
                        key={line.key}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p>
                            {line.quantity} × {line.menuName}
                          </p>
                          {line.choiceLabels.map((label) => (
                            <p key={label} className="text-muted-foreground">
                              {label}
                            </p>
                          ))}
                        </div>
                        <span className="shrink-0 tabular-nums">
                          {money(line.unitPrice * line.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2 border-t pt-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span>Subtotal</span>
                      <span className="tabular-nums">{money(cartTotal)}</span>
                    </div>
                    {currentVoucher && (
                      <div className="flex justify-between gap-3 text-success">
                        <span>Diskon · {currentVoucher.name}</span>
                        <span className="tabular-nums">
                          −{money(currentVoucher.discountAmount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-3 text-base font-semibold">
                      <span>Total sementara</span>
                      <span className="tabular-nums">{money(orderTotal)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Server memvalidasi harga, voucher, dan total sebelum
                      pesanan dibuat.
                    </p>
                  </div>
                </section>
              </div>
            )}

            {panelStep === "payment" && createdOrder && (
              <div className="space-y-5">
                <section
                  aria-labelledby="submitted-order-title"
                  className="space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 id="submitted-order-title" className="font-semibold">
                        Pesanan {createdOrder.orderNumber}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Meja{" "}
                        {String(
                          submittedOrderSummary?.tableNumber ??
                            catalog.table.tableNumber,
                        ).padStart(2, "0")}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        paymentView?.paymentStatus === "PAID"
                          ? "bg-success-soft text-success"
                          : paymentView?.paymentStatus === "CANCELLED" ||
                              paymentView?.paymentStatus === "EXPIRED"
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-warning-soft text-warning"
                      }`}
                    >
                      {paymentView?.paymentStatus === "PAID"
                        ? "Pembayaran berhasil"
                        : paymentView?.paymentStatus === "CANCELLED"
                          ? "Pesanan dibatalkan"
                          : paymentView?.paymentStatus === "EXPIRED"
                            ? "Batas pembayaran berakhir"
                            : "Menunggu pembayaran"}
                    </span>
                  </div>
                  <div className="divide-y rounded-lg border">
                    {submittedOrderSummary?.lines.map((line, index) => (
                      <div
                        key={line.key + "-submitted-" + index}
                        className="space-y-1 p-3 text-sm"
                      >
                        <p>
                          {line.quantity} × {line.menuName}
                        </p>
                        {line.choiceLabels.map((label) => (
                          <p key={label} className="text-muted-foreground">
                            {label}
                          </p>
                        ))}
                        {line.note && (
                          <p className="text-muted-foreground">
                            Catatan: {line.note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  {submittedOrderSummary?.orderNotes && (
                    <p className="text-sm text-muted-foreground">
                      Catatan pesanan: {submittedOrderSummary.orderNotes}
                    </p>
                  )}
                  <div className="flex justify-between gap-3 border-t pt-3 text-lg font-semibold">
                    <span>Total pesanan</span>
                    <span className="tabular-nums">
                      {money(createdOrder.totalAmount)}
                    </span>
                  </div>
                </section>

                {paymentView?.paymentStatus === "PAID" ? (
                  <div
                    role="status"
                    className="space-y-3 rounded-lg bg-success-soft p-4 text-success"
                  >
                    <div>
                      <p className="font-semibold">Pembayaran terkonfirmasi</p>
                      <p className="mt-1 text-sm">
                        Pesanan Anda telah dikonfirmasi.
                      </p>
                    </div>
                    <Button asChild>
                      <a
                        href={
                          "/receipt/" +
                          encodeURIComponent(createdOrder.accessToken)
                        }
                      >
                        Lihat struk
                      </a>
                    </Button>
                  </div>
                ) : paymentView?.paymentStatus === "CANCELLED" ||
                  paymentView?.paymentStatus === "EXPIRED" ? (
                  <div role="status" className="rounded-lg bg-secondary p-4">
                    <p className="font-medium">
                      {paymentView.paymentStatus === "CANCELLED"
                        ? "Pesanan dibatalkan."
                        : "Waktu pembayaran telah berakhir."}
                    </p>
                  </div>
                ) : paymentView?.qrUrl ? (
                  <section
                    aria-label="Pembayaran QRIS"
                    className="space-y-3 rounded-lg bg-muted/50 p-4 text-center"
                  >
                    <Image
                      src={paymentView.qrUrl}
                      alt="Kode QRIS untuk pembayaran"
                      width={320}
                      height={320}
                      unoptimized
                      className="mx-auto aspect-square w-64 max-w-full rounded-lg border bg-white object-contain p-2"
                    />
                    <p className="text-sm">
                      Pindai kode QRIS dengan aplikasi pembayaran yang mendukung
                      pemindaian kode.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={downloadingQr}
                      onClick={() => void downloadPaymentQr()}
                    >
                      {downloadingQr ? "Mengunduh QR…" : "Unduh QR pembayaran"}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Batas pembayaran{" "}
                      {new Date(createdOrder.expiresAt).toLocaleTimeString(
                        "id-ID",
                        {
                          timeZone: "Asia/Jakarta",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}{" "}
                      WIB
                      {paymentView.paymentStatus === "PENDING"
                        ? " · " +
                          Math.max(
                            0,
                            Math.ceil(
                              (new Date(createdOrder.expiresAt).getTime() -
                                paymentNow) /
                                1000,
                            ),
                          ) +
                          " detik tersisa"
                        : ""}
                    </p>
                  </section>
                ) : (
                  <div
                    role="status"
                    className="space-y-3 rounded-lg bg-secondary p-4"
                  >
                    <p className="font-medium">
                      {paymentBusy
                        ? "Menyiapkan QRIS…"
                        : paymentView?.attemptStatus === "FAILED"
                          ? "Percobaan pembayaran gagal."
                          : "Menunggu status QRIS dari provider…"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Status pembayaran diperbarui otomatis.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Batas pembayaran pukul{" "}
                      {new Date(createdOrder.expiresAt).toLocaleTimeString(
                        "id-ID",
                        {
                          timeZone: "Asia/Jakarta",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}{" "}
                      WIB.
                    </p>
                    {(paymentView?.attemptStatus === "FAILED" ||
                      paymentError) &&
                      paymentView?.paymentStatus !== "PAID" && (
                        <Button
                          variant="outline"
                          onClick={() => setPaymentRetry((count) => count + 1)}
                        >
                          Coba lagi
                        </Button>
                      )}
                  </div>
                )}
                {paymentError && (
                  <p role="alert" className="text-sm text-destructive">
                    {paymentError}
                  </p>
                )}
                {paymentView?.paymentStatus === "PENDING" && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setCancelOrderConfirm(true)}
                  >
                    Batalkan pesanan
                  </Button>
                )}
              </div>
            )}

            {panelStep === "payment" && !createdOrder && (
              <div className="space-y-3 py-8 text-center">
                <p className="font-medium">Belum ada pesanan untuk dibayar</p>
                <p className="text-sm text-muted-foreground">
                  Tambahkan menu ke keranjang untuk melanjutkan.
                </p>
              </div>
            )}
          </div>

          <SheetFooter className="shrink-0 border-t bg-background px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
            {panelStep === "cart" && cart.lines.length > 0 && (
              <Button
                className="w-full"
                disabled={
                  !isOpen ||
                  cart.lines.some(
                    (line) => line.unavailable || line.needsAcceptance,
                  ) ||
                  (Boolean(voucherCode.trim()) && !currentVoucher)
                }
                onClick={() => {
                  setPanelStep("checkout");
                  setError("");
                }}
              >
                Lanjut ke checkout · {money(orderTotal)}
              </Button>
            )}
            {panelStep === "checkout" && (
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPanelStep("cart")}
                >
                  Kembali ke keranjang
                </Button>
                <Button
                  className="flex-1"
                  disabled={
                    !isOpen ||
                    submittingOrder ||
                    cart.lines.some(
                      (line) => line.unavailable || line.needsAcceptance,
                    ) ||
                    (Boolean(voucherCode.trim()) && !currentVoucher) ||
                    receiptEmailInvalid
                  }
                  onClick={() => void createOrder()}
                >
                  {submittingOrder ? "Membuat pesanan…" : "Buat pesanan"}
                </Button>
              </div>
            )}
            {panelStep === "payment" && createdOrder && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowCart(false)}
              >
                Kembali ke menu
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={cartConfirmation !== null}
        onOpenChange={(open) => {
          if (!open) setCartConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cartConfirmation?.kind === "clear"
                ? "Kosongkan keranjang?"
                : "Hapus item dari keranjang?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cartConfirmation?.kind === "clear"
                ? "Semua item dalam keranjang akan dihapus."
                : `${cartConfirmation?.line.menuName} akan dihapus dari keranjang.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmCartAction}
            >
              {cartConfirmation?.kind === "clear" ? "Kosongkan" : "Hapus item"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={cancelOrderConfirm}
        onOpenChange={(open) => {
          if (!cancelBusy) setCancelOrderConfirm(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan pesanan?</AlertDialogTitle>
            <AlertDialogDescription>
              Provider akan diperiksa sebelum pembatalan. Jika pembayaran sudah
              berhasil, pesanan tidak dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelBusy}>Kembali</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelBusy}
              onClick={(event) => {
                event.preventDefault();
                void cancelOrder();
              }}
            >
              {cancelBusy ? "Memeriksa…" : "Batalkan pesanan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

const noChoice: MenuChoice = { variantSelections: {}, addonSelections: {} };

function lineKey(menuId: string, note: string, choice: MenuChoice) {
  return JSON.stringify([
    menuId,
    note,
    Object.entries(choice.variantSelections).sort(),
    Object.entries(choice.addonSelections)
      .map(([group, values]) => [group, Object.entries(values).sort()])
      .sort(),
  ]);
}

function choiceLabelsForMenu(menu: Menu, choice: MenuChoice) {
  return [
    ...menu.configuration.variants.flatMap((group) => {
      const id = group.id ? choice.variantSelections[group.id] : undefined;
      const option = group.options.find((item) => item.id === id);
      return option ? [`${group.name}: ${option.name}`] : [];
    }),
    ...menu.configuration.addons.flatMap((group) =>
      Object.entries(
        group.id ? (choice.addonSelections[group.id] ?? {}) : {},
      ).flatMap(([id, count]) => {
        const option = group.options.find((item) => item.id === id);
        return option
          ? [`${group.name}: ${option.name}${count > 1 ? ` ×${count}` : ""}`]
          : [];
      }),
    ),
  ];
}

function reconcileMenuChoice(
  menu: Menu,
  line: MenuChoice,
): { choice: MenuChoice; changed: boolean } {
  let changed = false;
  const variantGroupIds = new Set(
    menu.configuration.variants
      .map((group) => group.id)
      .filter((id): id is string => Boolean(id)),
  );
  const addonGroupIds = new Set(
    menu.configuration.addons
      .map((group) => group.id)
      .filter((id): id is string => Boolean(id)),
  );
  const variantSelections: Record<string, string> = {};
  for (const [groupId, optionId] of Object.entries(line.variantSelections)) {
    const group = menu.configuration.variants.find(
      (candidate) => candidate.id === groupId,
    );
    const option = group?.options.find(
      (candidate) => candidate.id === optionId && candidate.isActive,
    );
    if (variantGroupIds.has(groupId) && option)
      variantSelections[groupId] = optionId;
    else changed = true;
  }
  const addonSelections: Record<string, Record<string, number>> = {};
  for (const [groupId, selections] of Object.entries(line.addonSelections)) {
    const group = menu.configuration.addons.find(
      (candidate) => candidate.id === groupId,
    );
    if (!group || !addonGroupIds.has(groupId)) {
      changed = true;
      continue;
    }
    const activeOptionIds = new Set(
      group.options
        .filter((option) => option.isActive)
        .map((option) => option.id)
        .filter((id): id is string => Boolean(id)),
    );
    const validSelections = Object.fromEntries(
      Object.entries(selections).filter(([optionId]) =>
        activeOptionIds.has(optionId),
      ),
    );
    if (Object.keys(validSelections).length !== Object.keys(selections).length)
      changed = true;
    if (Object.keys(validSelections).length)
      addonSelections[groupId] = validSelections;
  }
  return { choice: { variantSelections, addonSelections }, changed };
}
