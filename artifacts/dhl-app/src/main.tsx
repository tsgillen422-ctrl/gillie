import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "./index.css";
import { isPushSupported, registerServiceWorker } from "./lib/push";
import { initNativePushListeners } from "./lib/native-push";

createRoot(document.getElementById("root")!).render(<App />);

if (Capacitor.isNativePlatform()) {
  void initNativePushListeners();
} else if (isPushSupported()) {
  window.addEventListener("load", () => {
    void registerServiceWorker();
  });
}
