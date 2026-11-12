import { CustomerOrdering } from "@/components/customer/customer-ordering";

export default async function OrderPage({ params }: { params: Promise<{ tableCode: string }> }) {
  const { tableCode } = await params;
  return <CustomerOrdering tableCode={tableCode} />;
}
