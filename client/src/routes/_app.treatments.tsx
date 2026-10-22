import { createFileRoute } from "@tanstack/react-router";

import { TreatmentsPage } from "@/features/treatments/treatments-page.tsx";
import { treatmentQueries } from "@/features/treatments/treatments.api.ts";

export const Route = createFileRoute("/_app/treatments")({
  loader: ({ context }) => context.queryClient.prefetchQuery(treatmentQueries.list()),
  component: TreatmentsPage,
});
