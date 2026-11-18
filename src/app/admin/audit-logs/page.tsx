import { AuditLogViewer } from "@/components/admin/audit-log-viewer";

export default function AdminAuditLogsPage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-page-title font-semibold">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Riwayat perubahan penting dan aktivitas akun.
        </p>
      </div>
      <AuditLogViewer />
    </main>
  );
}
