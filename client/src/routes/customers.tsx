import { createFileRoute } from "@tanstack/react-router";

import { CustomersPage } from "@/features/customers/customers-page.tsx";

export const Route = createFileRoute("/customers")({ component: CustomersPage });
