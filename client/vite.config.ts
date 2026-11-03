import stylex from "@stylexjs/unplugin";
import { devtools } from "@tanstack/devtools-vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
// oxlint-disable import/no-default-export
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const src = fileURLToPath(new URL("./src", import.meta.url));

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    // .stylex 파일은 StyleX가 직접 풀어서 tsconfig paths를 따로 알려줘야 한다
    stylex.vite({ useCSSLayers: true, aliases: { "@/*": [`${src}/*`] } }),
    viteReact(),
  ],
});

export default config;
