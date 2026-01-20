import { createRoot } from "react-dom/client";
import { injectSpeedInsights } from "@vercel/speed-insights";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";

injectSpeedInsights();

// Register service worker for PWA functionality (web only)
if ("serviceWorker" in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered:", registration);
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
  });
}

// Initialize Capacitor plugins on mobile
if (Capacitor.isNativePlatform()) {
  import("@capacitor/app").then(({ App: CapacitorApp }) => {
    // Handle app state changes
    CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      console.log("App state changed. Is active?", isActive);
    });

    // Handle URL open events (for OAuth callbacks)
    CapacitorApp.addListener("appUrlOpen", (data) => {
      console.log("App opened with URL:", data.url);
      // The URL will be handled by React Router
      if (data.url) {
        const url = new URL(data.url);
        window.location.href = url.pathname + url.search;
      }
    });
  });

  // Initialize StatusBar
  import("@capacitor/status-bar").then(({ StatusBar }) => {
    StatusBar.setStyle({ style: "dark" });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
