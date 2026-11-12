import { TemplatesManager } from "@/components/admin/templates-manager";

export default function AdminTemplatesPage() {
  return <main><h1 className="text-2xl font-semibold">Template Varian &amp; Add-on</h1><p className="mt-2 text-sm text-neutral-600">Template adalah preset yang disalin ke menu dan tidak terhubung setelah diterapkan.</p><TemplatesManager /></main>;
}
