import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Verbatim copies from the phone repo; unused parameters there are not ours to fix.
    files: ["src/shared/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off",
      "no-useless-assignment": "off",
    },
  },
  {
    files: ["vite.config.ts", "tooling/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
);
