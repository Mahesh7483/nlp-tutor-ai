/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional cross-origin API origin, e.g. "https://nlp-tutor-ai.onrender.com" (no trailing slash). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
