import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-empty": "off",
      "no-console": "off",
      "no-useless-escape": "off",
      "no-useless-assignment": "off",
      "no-control-regex": "off",
    },
    ignores: [
      "**/node_modules/**",
      "**/vendor/**",
      "**/build/**",
      "**/dist/**",
      "**/coverage/**",
      "**/workflow-studio/**",
      "packages/yft-design/**",
    ],
  },
];
