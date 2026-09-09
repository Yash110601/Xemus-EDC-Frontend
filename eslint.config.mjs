import nextVitals from "eslint-config-next/core-web-vitals";

export default [
  {
    ignores: [
      "**/.next/**",
      "**/out/**",
      // Nested duplicate checkout under repo root (not the Next.js app root). Lint-only — does not change runtime.
      "PR-EDC-Frontend/**",
    ],
  },
  ...nextVitals,
];
