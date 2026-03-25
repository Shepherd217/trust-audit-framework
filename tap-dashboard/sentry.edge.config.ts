import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://e58e44a0e774c57e27178a03cca5a622@o4511106058420224.ingest.us.sentry.io/4511106082471936",

  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  enableLogs: true,
});
