import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
import "./i18n";

initSentry();

const app = <App />;

createRoot(document.getElementById("root")!).render(
  import.meta.env.VITE_SENTRY_DSN ? (
    <Sentry.ErrorBoundary
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
          <p className="text-muted-foreground">Something went wrong. Please refresh the page.</p>
        </div>
      }
      showDialog={false}
    >
      {app}
    </Sentry.ErrorBoundary>
  ) : (
    app
  ),
);
