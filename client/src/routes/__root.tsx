import type { QueryClient } from "@tanstack/react-query";

import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

import { DevStyleXInject } from "@/_dev/dev-stylex-inject";
import { TanStackRouterDevtools } from "@/_dev/tanstack-router-devtools";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <DevStyleXInject />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
});
