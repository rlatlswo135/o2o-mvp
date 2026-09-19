// oxlint-disable import/no-default-export
import stylex from "@stylexjs/unplugin";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), stylex.vite({ useCSSLayers: true }), tanstackStart(), viteReact()],
});

export default config;
