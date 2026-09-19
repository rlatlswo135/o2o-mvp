import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

import { DevStyleXInject } from "@/_dev/dev-stylex-inject";
import { TanStackRouterDevtools } from "@/_dev/tanstack-router-devtools";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <DevStyleXInject cssHref="../styles.css" />
      </head>
      <body>
        {children}
        <TanStackRouterDevtools />
        <Scripts />
      </body>
    </html>
  );
}
