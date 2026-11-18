"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  ClipboardCheck,
  TicketPercent,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { shiftOperationalDate } from "@/lib/analytics/operational-date";

type Props = { operationalDate: string };
type Summary = {
  revenue: number;
  paidOrders: number;
  voucherDiscount: number;
  averageOrderValue: number;
};
type Point = { bucket: string; revenue: number };
type TopMenu = { menuName: string; quantity: number };
type Method = { method: string; revenue: number; transactions: number };
type Range = { from: string; to: string; granularity: "hour" | "day" | "week" };
const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
const presets = ["TODAY", "YESTERDAY", "7D", "30D", "CUSTOM"] as const;

export function AnalyticsDashboard({ operationalDate }: Props) {
  const [preset, setPreset] = useState<(typeof presets)[number]>("TODAY");
  const [range, setRange] = useState<Range>({
    from: operationalDate,
    to: operationalDate,
    granularity: "hour",
  });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [menus, setMenus] = useState<TopMenu[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const updatePreset = (value: (typeof presets)[number]) => {
    setPreset(value);
    if (value === "CUSTOM") return;
    if (value === "TODAY")
      setRange({
        from: operationalDate,
        to: operationalDate,
        granularity: "hour",
      });
    else if (value === "YESTERDAY") {
      const yesterday = shiftOperationalDate(operationalDate, -1);
      setRange({ from: yesterday, to: yesterday, granularity: "hour" });
    } else {
      const days = value === "7D" ? 7 : 30;
      setRange({
        from: shiftOperationalDate(operationalDate, -(days - 1)),
        to: operationalDate,
        granularity: "day",
      });
    }
  };
  const updateCustomDate = (field: "from" | "to", value: string) => {
    setPreset("CUSTOM");
    setRange((current) => {
      const next = { ...current, [field]: value };
      const duration =
        (Date.parse(`${next.to}T00:00:00Z`) -
          Date.parse(`${next.from}T00:00:00Z`)) /
        86_400_000;
      return { ...next, granularity: duration > 31 ? "week" : "day" };
    });
  };

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!range.from || !range.to || range.from > range.to) {
        setError("Rentang tanggal tidak valid.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        from: range.from,
        to: range.to,
        granularity: range.granularity,
      });
      const paths = ["summary", "sales-chart", "top-menus", "payment-methods"];
      try {
        const responses = await Promise.all(
          paths.map((path) =>
            fetch(`/api/v1/admin/analytics/${path}?${params}`, {
              cache: "no-store",
              signal,
            }),
          ),
        );
        const results = await Promise.all(
          responses.map((response) =>
            response.json().then((body) => ({ response, body })),
          ),
        );
        const failed = results.find(({ response }) => !response.ok);
        if (failed)
          throw new Error(failed.body.message ?? "Laporan belum dapat dimuat.");
        setSummary(results[0].body.data.summary);
        setPoints(results[1].body.data.points);
        setMenus(results[2].body.data.menus);
        setMethods(results[3].body.data.methods);
      } catch (e) {
        if (!signal.aborted)
          setError(
            e instanceof Error ? e.message : "Laporan belum dapat dimuat.",
          );
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [range],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void load(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  const metricCards = useMemo(
    () => [
      { label: "Omzet", value: money(summary?.revenue ?? 0), icon: Banknote },
      {
        label: "Paid order",
        value: new Intl.NumberFormat("id-ID").format(summary?.paidOrders ?? 0),
        icon: ClipboardCheck,
      },
      {
        label: "Diskon voucher",
        value: money(summary?.voucherDiscount ?? 0),
        icon: TicketPercent,
      },
      {
        label: "Rata-rata order",
        value: money(summary?.averageOrderValue ?? 0),
        icon: Activity,
      },
    ],
    [summary],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[14rem_1fr_1fr] sm:items-end">
        <div className="space-y-2">
          <Label>Periode</Label>
          <Select
            value={preset}
            onValueChange={(value) => {
              if (value && presets.includes(value as (typeof presets)[number]))
                updatePreset(value as (typeof presets)[number]);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAY">Hari ini</SelectItem>
              <SelectItem value="YESTERDAY">Kemarin</SelectItem>
              <SelectItem value="7D">7 hari</SelectItem>
              <SelectItem value="30D">30 hari</SelectItem>
              <SelectItem value="CUSTOM">Rentang khusus</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="analytics-from">Dari tanggal operasional</Label>
          <Input
            id="analytics-from"
            type="date"
            value={range.from}
            onChange={(e) => updateCustomDate("from", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="analytics-to">Sampai tanggal operasional</Label>
          <Input
            id="analytics-to"
            type="date"
            value={range.to}
            onChange={(e) => updateCustomDate("to", e.target.value)}
          />
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}{" "}
          <Button
            variant="outline"
            size="sm"
            className="ml-3"
            onClick={() => {
              const controller = new AbortController();
              void load(controller.signal);
            }}
          >
            Coba lagi
          </Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardDescription>{label}</CardDescription>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold tabular-nums">
                {loading ? "…" : value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Omzet</CardTitle>
            <CardDescription>
              Hanya pesanan dengan pembayaran berhasil ·{" "}
              {range.granularity === "hour"
                ? "per jam"
                : range.granularity === "day"
                  ? "per tanggal operasional"
                  : "per minggu"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72" aria-busy={loading}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={points}
                  margin={{ top: 8, right: 8, bottom: 4, left: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="bucket"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) =>
                      new Intl.NumberFormat("id-ID", {
                        notation: "compact",
                      }).format(value)
                    }
                    tick={{ fontSize: 12 }}
                    width={48}
                  />
                  <Tooltip formatter={(value) => money(Number(value))} />
                  <Bar
                    dataKey="revenue"
                    name="Omzet"
                    fill="var(--primary)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Metode pembayaran</CardTitle>
            <CardDescription>Transaksi paid pada periode ini.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Memuat…</p>
            ) : methods.length ? (
              methods.map((method) => (
                <div
                  key={method.method}
                  className="flex items-start justify-between gap-3 border-b pb-3 last:border-0"
                >
                  <div>
                    <p className="font-medium">{method.method}</p>
                    <p className="text-xs text-muted-foreground">
                      {method.transactions} transaksi
                    </p>
                  </div>
                  <p className="text-right text-sm tabular-nums">
                    {money(method.revenue)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Belum ada pembayaran sukses pada periode ini.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>10 menu terlaris</CardTitle>
          <CardDescription>
            Diurutkan berdasarkan jumlah item pada order paid.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Memuat…</p>
          ) : menus.length ? (
            <div className="divide-y">
              {menus.map((menu, index) => (
                <div
                  key={`${menu.menuName}-${index}`}
                  className="flex items-center justify-between gap-4 px-6 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
                      {index + 1}
                    </span>
                    <span className="truncate font-medium">
                      {menu.menuName}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                    {menu.quantity} terjual
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              Belum ada item terjual pada periode ini.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
