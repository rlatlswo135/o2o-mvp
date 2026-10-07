import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    sortImports: {
      groups: [
        "type-import",
        ["value-builtin", "value-external"],
        "type-internal",
        "value-internal",
        ["type-parent", "type-sibling", "type-index"],
        ["value-parent", "value-sibling", "value-index"],
        "unknown",
      ],
    },
    overrides: [
      {
        files: ["server/**"],
        options: { singleQuote: true, trailingComma: "all" },
      },
    ],
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    plugins: ["typescript", "promise", "import", "vitest"],
    rules: {
      // promise
      "promise/avoid-new": "warn",
      "promise/always-return": "warn",
      "promise/no-multiple-resolved": "warn",
      // import
      "import/namespace": "error",
      "import/newline-after-import": "error",
      "import/no-absolute-path": "error",
      "import/no-cycle": "error",
      "import/consistent-type-specifier-style": "warn",
      "import/default": "warn",
      "import/export": "warn",
      "import/max-dependencies": ["warn", { max: 10 }],
      "import/no-default-export": "warn",
      "import/no-duplicates": "warn",
      // vite-plus
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    overrides: [
      {
        files: ["server/**"],
        env: { node: true },
        rules: {
          "typescript/no-explicit-any": "off",
          "typescript/no-floating-promises": "error",
        },
      },
      {
        files: ["client/**"],
        plugins: ["react", "react-perf"],
        rules: {
          // react
          "react/self-closing-comp": "error",
          "react/refs": "error",
          "react/no-array-index-key": "error",
          "react/unsupported-syntax": "error",
          "react/static-components": "error",
          "react/set-state-in-effect": "error",
          "react/memo-dependencies": "error",
          "react/jsx-props-no-spread-multi": "error",
          "react/jsx-no-useless-fragment": "error",
          "react/jsx-no-duplicate-props": "error",
          "react/jsx-key": "error",
          "react/jsx-handler-names": "error",
          // react-perf
          "react-perf/jsx-no-jsx-as-prop": "error",
          "react-perf/jsx-no-new-array-as-prop": "error",
          "react-perf/jsx-no-new-function-as-prop": "error",
          "react-perf/jsx-no-new-object-as-prop": "error",
        },
      },
    ],
  },
});
