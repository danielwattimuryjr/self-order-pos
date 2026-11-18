import { CatalogManager } from "@/components/admin/catalog-manager";

export default function AdminCatalogPage() {
  return (
    <main>
      <header className="space-y-1">
        <h1 className="text-page-title font-semibold">Kategori &amp; Menu</h1>
        <p className="text-sm text-muted-foreground">
          Kelola katalog yang ditampilkan kepada pelanggan.
        </p>
      </header>
      <CatalogManager />
    </main>
  );
}
