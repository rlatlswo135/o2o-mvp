import { createFileRoute } from "@tanstack/react-router";

import { customersQueryOptions } from "@/features/customers/customer-api.ts";
import { CustomersPage } from "@/features/customers/customers-page.tsx";

export const Route = createFileRoute("/customers")({
  loader: ({ context }) => context.queryClient.prefetchQuery(customersQueryOptions),
  component: CustomersPage,
});
