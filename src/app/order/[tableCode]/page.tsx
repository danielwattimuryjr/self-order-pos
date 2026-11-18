import { CustomerOrdering } from "@/components/customer/customer-ordering";

type OrderSearchParams = Record<string, string | string[] | undefined>;

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ tableCode: string }>;
  searchParams: Promise<OrderSearchParams>;
}) {
  const [{ tableCode }, query] = await Promise.all([params, searchParams]);
  const requestedPage = typeof query.page === "string" ? Number(query.page) : 1;
  const initialFilters = {
    search: typeof query.search === "string" ? query.search.trim() : "",
    category: typeof query.category === "string" ? query.category : "",
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
  };
  return (
    <CustomerOrdering tableCode={tableCode} initialFilters={initialFilters} />
  );
}
