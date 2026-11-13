import { Skeleton } from "@/components/ui/skeleton";

export default function TablesLoading() {
  return (
    <main aria-busy="true" aria-label="Memuat data meja" className="space-y-5">
      <span role="status" className="sr-only">Memuat data meja…</span>
      <div className="space-y-2">
        <Skeleton aria-hidden="true" className="h-8 w-28" />
        <Skeleton aria-hidden="true" className="h-4 w-2/3 max-w-xl" />
      </div>
      <Skeleton aria-hidden="true" className="h-9 w-60" />
      <div aria-hidden="true" className="overflow-hidden rounded-xl border bg-card">
        <Skeleton className="h-12 rounded-none" />
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton key={row} className="m-3 h-12 w-[calc(100%-1.5rem)]" />
        ))}
      </div>
    </main>
  );
}
