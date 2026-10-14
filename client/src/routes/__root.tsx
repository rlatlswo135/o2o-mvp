import type { QueryClient } from "@tanstack/react-query";

import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import { DevStyleXInject } from "@/_dev/dev-stylex-inject";
import { TanStackRouterDevtools } from "@/_dev/tanstack-router-devtools";
import { Toaster } from "@/shared/ui/toast/toast.tsx";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <DevStyleXInject />
      <Outlet />
      <Toaster />
      <TanStackRouterDevtools />
    </>
  ),
});
