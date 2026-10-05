// oxlint-disable import/no-default-export
import stylex from "@stylexjs/unplugin";
import { devtools } from "@tanstack/devtools-vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    stylex.vite({ useCSSLayers: true }),
    viteReact(),
  ],
});

export default config;
