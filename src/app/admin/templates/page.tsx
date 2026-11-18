import { TemplatesManager } from "@/components/admin/templates-manager";

export default function AdminTemplatesPage() {
  return (
    <main>
      <header className="space-y-1">
        <h1 className="text-page-title font-semibold">
          Template Varian &amp; Add-on
        </h1>
        <p className="text-sm text-muted-foreground">
          Template adalah preset yang disalin ke menu dan tidak terhubung
          setelah diterapkan.
        </p>
      </header>
      <TemplatesManager />
    </main>
  );
}
