"use client";

import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

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
        <p className="max-w-2xl text-muted-foreground">Komponen shadcn/ui dan token visual untuk Admin, Staff, dan pengalaman pelanggan.</p>
      </header>

      <section aria-labelledby="colors-heading" className="space-y-4">
        <div>
          <h2 id="colors-heading" className="text-xl font-semibold">Warna</h2>
          <p className="text-sm text-muted-foreground">Token tema yang sudah disepakati di DESIGN_SYSTEM.md.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {swatches.map((swatch) => (
            <Card key={swatch.name} className="overflow-hidden">
              <div className={`h-12 ${swatch.color}`} aria-hidden="true" />
              <div className="p-3"><p className="text-sm font-medium">{swatch.name}</p><p className="text-xs text-muted-foreground">{swatch.value}</p></div>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="buttons-heading">
        <Card>
          <CardHeader><CardTitle id="buttons-heading">Buttons</CardTitle><CardDescription>Button component dari shadcn/ui, dengan varian dan ukuran yang tersedia.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button><Button variant="destructive">Destructive</Button><Button variant="link">Link</Button>
            <Button size="sm">Small</Button><Button size="lg">Large</Button><Button disabled>Disabled</Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Form controls</CardTitle><CardDescription>Input, textarea, select, dan label shadcn/ui.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label htmlFor="showcase-name">Nama menu</Label><Input id="showcase-name" placeholder="Contoh: Nasi goreng" /></div>
            <div className="space-y-2"><Label htmlFor="showcase-description">Deskripsi</Label><Textarea id="showcase-description" placeholder="Deskripsi singkat menu" /></div>
            <div className="space-y-2"><Label>Kategori</Label><Select defaultValue="utama"><SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger><SelectContent><SelectItem value="utama">Menu utama</SelectItem><SelectItem value="minuman">Minuman</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="showcase-disabled">Kontrol nonaktif</Label><Input id="showcase-disabled" disabled value="Tidak dapat diedit" readOnly /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Badges & feedback</CardTitle><CardDescription>Status ditampilkan dengan label dan teks, bukan warna saja.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>Aktif</Badge><Badge variant="secondary">Draft</Badge><Badge variant="outline">Kategori</Badge>
              <Badge className="border-transparent bg-success-soft text-success">Berhasil</Badge>
              <Badge className="border-transparent bg-warning-soft text-warning">Menunggu</Badge>
              <Badge className="border-transparent bg-information-soft text-information">Informasi</Badge>
              <Badge variant="destructive">Gagal</Badge>
            </div>
            <Alert><AlertTitle>Informasi</AlertTitle><AlertDescription>Komponen Alert digunakan untuk pesan kontekstual yang tampil di halaman.</AlertDescription></Alert>
            <Alert variant="destructive"><AlertTitle>Perlu perhatian</AlertTitle><AlertDescription>Pesan error atau perhatian yang perlu dibaca pengguna.</AlertDescription></Alert>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => toast.success("Perubahan berhasil disimpan.")}>Contoh toast sukses</Button>
              <Button variant="outline" onClick={() => toast.error("Perubahan belum dapat disimpan.")}>Contoh toast error</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Dialog</CardTitle><CardDescription>Dialog untuk form atau informasi singkat.</CardDescription></CardHeader>
          <CardContent>
            <Dialog>
              <DialogTrigger asChild><Button variant="outline">Buka dialog</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Contoh dialog</DialogTitle><DialogDescription>Gunakan Dialog untuk interaksi yang membutuhkan isi atau kontrol lebih dari sekadar konfirmasi.</DialogDescription></DialogHeader>
                <DialogFooter><DialogClose asChild><Button variant="outline">Tutup</Button></DialogClose></DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Konfirmasi destruktif</CardTitle><CardDescription>AlertDialog shadcn/ui untuk meminta konfirmasi tindakan.</CardDescription></CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive">Contoh konfirmasi</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Konfirmasi tindakan?</AlertDialogTitle><AlertDialogDescription>Ini hanya contoh dialog dan tidak mengubah data.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction variant="destructive">Lanjutkan contoh</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="loading-heading">
        <Card>
          <CardHeader><CardTitle id="loading-heading">Loading state</CardTitle><CardDescription>Skeleton menjaga stabilitas layout saat data dimuat.</CardDescription></CardHeader>
          <CardContent className="flex items-center gap-4"><Skeleton className="size-12 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-2/3" /></div></CardContent>
        </Card>
      </section>
    </main>
  );
}
