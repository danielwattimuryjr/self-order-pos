import { CatalogManager } from "@/components/admin/catalog-manager";

export default function AdminCatalogPage() {
  return <main><h1 className="text-2xl font-semibold">Kategori &amp; Menu</h1><p className="mt-2 text-sm text-neutral-600">Kelola katalog yang ditampilkan kepada pelanggan.</p><CatalogManager /></main>;
}
