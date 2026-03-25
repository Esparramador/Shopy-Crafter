import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "es.shopybrain.app",
  appName: "Shopy Crafter",
  webDir: "dist/public",
  server: {
    url: process.env.APP_URL ?? "https://shopycrafter.com",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#080810",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
  },
};

export default config;
