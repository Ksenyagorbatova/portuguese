import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { primeVoices } from "./lib/speech";
import { pickTokenStorage } from "./lib/authStorage";
import { HideNativeSplash } from "./components/HideNativeSplash";
import "./index.css";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

primeVoices();

// Токены: в iOS-оболочке — Preferences (переживают чистку storage WebKit), в
// вебе — undefined → дефолтный localStorage провайдера.
const tokenStorage = pickTokenStorage();

// ErrorBoundary — на самом корне (внутри StrictMode, снаружи провайдеров):
// ловит и ошибки ConvexAuthProvider/queries, показывая «Перезагрузить»
// вместо белого экрана.
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HideNativeSplash />
    <ErrorBoundary>
      <ConvexAuthProvider client={convex} storage={tokenStorage}>
        <App />
      </ConvexAuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
