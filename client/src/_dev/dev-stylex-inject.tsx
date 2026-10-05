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

// production에서는 StyleX 규칙이 전역 CSS 자산(__root의 styles.css)에 합쳐지므로 dev에서만 주입한다.
export function DevStyleXInject() {
  // @ts-ignore
  return import.meta.env.DEV ? <DevStyleXInjectImpl /> : null;
}
