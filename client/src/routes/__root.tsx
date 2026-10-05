import { createRootRoute, Outlet } from "@tanstack/react-router";

import { DevStyleXInject } from "@/_dev/dev-stylex-inject";
import { TanStackRouterDevtools } from "@/_dev/tanstack-router-devtools";

export const Route = createRootRoute({
  component: () => (
    <>
      <DevStyleXInject />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
});
