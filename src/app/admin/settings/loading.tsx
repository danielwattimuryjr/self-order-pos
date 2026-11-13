import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <main aria-busy="true" aria-label="Memuat pengaturan restoran" className="space-y-5">
      <span role="status" className="sr-only">Memuat pengaturan restoran…</span>
      <Skeleton aria-hidden="true" className="h-8 w-64" />
      <div aria-hidden="true" className="grid max-w-4xl gap-6 lg:grid-cols-2">
        {[0, 1].map((card) => (
          <div key={card} className="space-y-4 rounded-xl border bg-card p-5">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-32" />
          </div>
        ))}
      </div>
    </main>
  );
}
