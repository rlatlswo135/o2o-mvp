import { useEffect } from "react";

const DevStyleXInjectImpl = () => {
  useEffect(() => {
    // @ts-ignore
    if (import.meta.env.DEV) {
      // @ts-ignore
      import("virtual:stylex:runtime");
    }
  }, []);
  return <link rel="stylesheet" href="/virtual:stylex.css" />;
};

export function DevStyleXInject({ cssHref }: { cssHref: string }) {
  // @ts-ignore
  return import.meta.env.DEV ? <DevStyleXInjectImpl /> : <link rel="stylesheet" href={cssHref} />;
}
