import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Keep the historical migration backlog visible without making every lint run fail.
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react/no-unescaped-entities": "warn",
      // Guard against the recurring "bold word</strong>\nnext word" → "wordnext word"
      // space-drop: when an inline element and adjacent text are split across lines with no
      // explicit space, the rendered space is lost. Forces an explicit {' '} / same-line space.
      "react/jsx-child-element-spacing": "warn",
    },
  },
  {
    // Node build/tooling scripts are CommonJS (run directly via `node`, not bundled
    // as ESM), so `require()` is correct there. Scope the exemption to scripts/ so
    // app code keeps ESM-only enforcement.
    files: ["scripts/**/*.js", "scripts/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
