import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AnchoredToastProvider, ToastProvider } from "./components/ui/toast";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <AnchoredToastProvider>
        <App />
      </AnchoredToastProvider>
    </ToastProvider>
  </StrictMode>,
);
