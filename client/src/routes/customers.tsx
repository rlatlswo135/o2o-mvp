import { createFileRoute } from "@tanstack/react-router";

import { CustomersPage } from "@/features/customers/customers-page.tsx";
import { customerQueries } from "@/features/customers/customers.api.ts";

export const Route = createFileRoute("/customers")({
  loader: ({ context }) => context.queryClient.prefetchQuery(customerQueries.list()),
  component: CustomersPage,
});
