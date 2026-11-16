import type { Metadata } from "next";
import { ReceiptViewer } from "./receipt-viewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Struk Pesanan", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-8 sm:px-6"><ReceiptViewer token={token} /></main>;
}
