import { TransactionDetail } from "@/components/shared/transaction-detail";

export default async function StaffTransactionDetailPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <TransactionDetail orderId={orderId} endpoint="/api/v1/staff/orders" backHref="/staff/transactions" />;
}
