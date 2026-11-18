import { TransactionDetail } from "@/components/shared/transaction-detail";

export default async function AdminTransactionDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return (
    <TransactionDetail
      orderId={orderId}
      endpoint="/api/v1/admin/transactions"
      backHref="/admin/transactions"
      adminPresentation
    />
  );
}
