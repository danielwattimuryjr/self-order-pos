import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TicketDetail } from "@/components/staff/ticket-detail";
import { requireRole } from "@/lib/auth/current-staff";

export default async function StaffTicketPage({ params, searchParams }: { params: Promise<{ ticketId: string }>; searchParams: Promise<{ from?: string }> }) {
  await requireRole("STAFF");
  const [{ ticketId }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) notFound();
  const fromHistory = query.from === "history";
  return <main className="mx-auto max-w-3xl space-y-5"><Button variant="ghost" asChild><Link href={fromHistory ? "/staff/history" : "/staff/queue"}>{fromHistory ? "← Kembali ke riwayat" : "← Kembali ke antrean"}</Link></Button><TicketDetail ticketId={ticketId} /></main>;
}
