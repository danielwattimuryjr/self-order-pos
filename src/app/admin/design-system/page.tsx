import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
  Textarea,
} from "@/components/ui";

const swatches = [
  { name: "Primary", color: "bg-primary", value: "#B85C38" },
  { name: "Background", color: "bg-background", value: "#FAF8F5" },
  { name: "Surface muted", color: "bg-secondary", value: "#F3F0EC" },
  { name: "Success", color: "bg-success", value: "#237A4B" },
  { name: "Warning", color: "bg-warning", value: "#A76716" },
  { name: "Destructive", color: "bg-destructive", value: "#C43D3D" },
  { name: "Information", color: "bg-information", value: "#2865A6" },
];

export default function DesignSystemPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-primary">UI Foundation</p>
        <h1 className="text-3xl font-semibold tracking-tight">Design system</h1>
        <p className="max-w-2xl text-muted-foreground">
          Komponen bersama dan token visual untuk Admin, Staff, dan pengalaman pelanggan.
        </p>
      </header>

      <section aria-labelledby="colors-heading" className="space-y-4">
        <div>
          <h2 id="colors-heading" className="text-xl font-semibold">Warna</h2>
          <p className="text-sm text-muted-foreground">Token tema awal dari DESIGN_SYSTEM.md.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {swatches.map((swatch) => (
            <Card key={swatch.name} className="overflow-hidden">
              <div className={`h-12 ${swatch.color}`} aria-hidden="true" />
              <div className="p-3">
                <p className="text-sm font-medium">{swatch.name}</p>
                <p className="text-xs text-muted-foreground">{swatch.value}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="buttons-heading">
        <Card>
          <CardHeader>
            <CardTitle id="buttons-heading">Buttons</CardTitle>
            <CardDescription>Varian dan ukuran yang disediakan oleh Button bersama.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Form controls</CardTitle>
            <CardDescription>Label, input, dan textarea dasar dengan token bersama.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="showcase-name">Nama menu</Label>
              <Input id="showcase-name" placeholder="Contoh: Nasi goreng" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="showcase-description">Deskripsi</Label>
              <Textarea id="showcase-description" placeholder="Deskripsi singkat menu" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="showcase-disabled">Kontrol nonaktif</Label>
              <Input id="showcase-disabled" disabled value="Tidak dapat diedit" readOnly />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Badges & feedback</CardTitle>
            <CardDescription>Status selalu ditampilkan dengan label, bukan warna saja.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>Aktif</Badge>
              <Badge variant="secondary">Draft</Badge>
              <Badge variant="outline">Kategori</Badge>
              <Badge variant="success">Berhasil</Badge>
              <Badge variant="warning">Menunggu</Badge>
              <Badge variant="information">Informasi</Badge>
              <Badge variant="destructive">Gagal</Badge>
            </div>
            <Alert variant="success">Perubahan berhasil disimpan.</Alert>
            <Alert variant="warning">Restoran sedang mendekati jam tutup.</Alert>
            <Alert variant="information">Informasi status untuk pengguna.</Alert>
            <Alert variant="destructive">Terjadi kesalahan. Periksa kembali data.</Alert>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="loading-heading">
        <Card>
          <CardHeader>
            <CardTitle id="loading-heading">Loading state</CardTitle>
            <CardDescription>Skeleton untuk menjaga stabilitas layout saat data dimuat.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
