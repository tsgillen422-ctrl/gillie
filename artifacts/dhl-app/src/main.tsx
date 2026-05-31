import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { isPushSupported, registerServiceWorker } from "./lib/push";

createRoot(document.getElementById("root")!).render(<App />);

if (isPushSupported()) {
  window.addEventListener("load", () => {
    void registerServiceWorker();
  });
}
