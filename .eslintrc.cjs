module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { sourceType: "module", ecmaVersion: "latest" },
  plugins: ["@typescript-eslint", "unused-imports"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    "unused-imports/no-unused-imports": "off",
    "@typescript-eslint/no-unused-vars": ["off", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/no-explicit-any": "off"
  },
  ignorePatterns: ["dist", "node_modules"]
};
