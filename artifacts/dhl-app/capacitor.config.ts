import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.dalehollowlake",
  appName: "Gillie",
  webDir: "dist/public",
  server: {
    url: "https://dale-hollow-nav.replit.app",
    cleartext: false,
    // Keep OAuth (Sign in with Apple / Google) flows INSIDE the webview.
    // Without this, Capacitor treats appleid.apple.com / accounts.google.com as
    // off-origin and pushes them to the external system browser, so the session
    // cookie is set in Safari and never returns to the app's webview (sign-in
    // appears to "do nothing" in the native app while working on the live site).
    allowNavigation: [
      "appleid.apple.com",
      "*.apple.com",
      "accounts.google.com",
      "*.google.com",
      "*.googleusercontent.com",
    ],
  },
};

export default config;
