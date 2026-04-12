/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_APP_DESCRIPTION: string;
  readonly VITE_APP_AUTHOR?: string;
  readonly VITE_SITE_URL: string;
  readonly VITE_OG_IMAGE_URL: string;
  readonly VITE_TWITTER_SITE?: string;
  readonly VITE_GOOGLE_FONTS_CSS_URL: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE?: string;
  readonly VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE?: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE_PROD?: string;
  readonly VITE_SUPABASE_URL?: string;
  /** New platform key (`sb_publishable_...`). Preferred over legacy anon. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Legacy JWT anon key; used if publishable is unset. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
