import nextEnv from "@next/env"
import { resolveBackendUrl } from "./lib/api/deployEnv.js"

nextEnv.loadEnvConfig(process.cwd())

const RESOLVED_BACKEND_URL = resolveBackendUrl()
import { createRequire } from "module"

const require = createRequire(import.meta.url)

const hasReactCompilerPlugin = (() => {
  try {
    require.resolve("babel-plugin-react-compiler")
    return true
  } catch {
    return false
  }
})()

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // React Compiler (stable in Next 16) — annotation mode so it ONLY compiles
  // components that opt-in via the `'use memo'` directive. This keeps the
  // upgrade low-risk on a 14k-line legacy file: we enable it per-component,
  // measure, and roll out incrementally instead of compiling the whole tree.
  // To opt-in: add `'use memo'` as the first statement inside the component
  // body. To opt-out a specific function: add `'use no memo'`.
  ...(hasReactCompilerPlugin
    ? {
        reactCompiler: {
          compilationMode: "annotation",
        },
      }
    : {}),
  // Proxy to backend (uses NEXT_PUBLIC_API_URL from env at build time, or fallback in config.js)
  async rewrites() {
    const base = RESOLVED_BACKEND_URL.replace(/\/$/, '')
    return [{ source: '/api-proxy/:path*', destination: `${base}/:path*` }]
  },
}

export default nextConfig
