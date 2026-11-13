/**
 * Vite asset-import declarations. `?inline` returns the file as a base64
 * data URI (used to bundle Inter into the injected CSS with no network and
 * no web_accessible_resources).
 */
declare module '*.woff2?inline' {
  const src: `data:font/woff2;base64,${string}`
  export default src
}
