import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript quality rules
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "@typescript-eslint/no-non-null-assertion": "off",
    
    // React best practices
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react-hooks/exhaustive-deps": "warn",
    
    // Next.js recommendations
    "@next/next/no-img-element": "off",
    
    // General JavaScript clean-code standards
    "prefer-const": "warn",
    "no-debugger": "error",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["warn", "error", "info"] }],
    "no-empty": ["warn", { "allowEmptyCatch": true }],
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "upload/**", "download/**", "mini-services/**", "scripts/**"]
}];

export default eslintConfig;
