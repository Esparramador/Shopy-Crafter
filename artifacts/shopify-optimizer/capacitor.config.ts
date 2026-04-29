import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "es.shopybrain.app",
  appName: "Shopy Crafter",
  webDir: "dist/public",
  server: {
    url: process.env.APP_URL ?? "https://shopycrafter.com",
    cleartext: false,
    androidScheme: "https",
    iosScheme: "https",
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#080810",
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
    preferredContentMode: "mobile",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#080810",
      androidSplashResourceName: "splash",
      iosSplashResourceName: "Default",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
