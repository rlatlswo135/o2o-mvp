// oxlint-disable react-perf/jsx-no-new-array-as-prop react-perf/jsx-no-new-object-as-prop
import { TanStackDevtools } from "@tanstack/react-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

export const TanStackRouterDevtools = () => {
  return (
    <TanStackDevtools
      config={{ position: "bottom-right" }}
      plugins={[
        {
          name: "Tanstack Router",
          render: <TanStackRouterDevtoolsPanel />,
        },
      ]}
    />
  );
};
