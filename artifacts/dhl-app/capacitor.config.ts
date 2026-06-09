import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.dalehollowlake",
  appName: "Gillie",
  webDir: "dist/public",
  server: {
    url: "https://dale-hollow-nav.replit.app",
    cleartext: false,
  },
};

export default config;
