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
      "import/max-dependencies": ["warn", { max: 15 }],
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
        // shared는 브라우저와 Node 양쪽에서 실행된다. zod와 @orpc/* 외 런타임에 기대지 않는다.
        files: ["shared/**"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              patterns: [
                { group: ["node:*"], message: "shared는 브라우저에서도 실행되므로 Node 모듈을 쓰지 않는다." },
                { group: ["**/client/**", "**/server/**"], message: "shared는 client와 server를 import하지 않는다." },
              ],
            },
          ],
          "no-restricted-globals": ["error", "process"],
        },
      },
      {
        files: ["client/**"],
        plugins: ["react"],
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
          // 메모이제이션은 React Compiler에 맡기므로 react-perf 규칙은 두지 않는다.
        },
      },
    ],
  },
});
