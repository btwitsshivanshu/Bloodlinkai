import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from '@react-oauth/google';
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { SocketProvider } from "./context/SocketContext";

// @ts-ignore
const GOOGLE_CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID || "642011452919-re59pnbhidn4m7k6u4ueo2rmljjbs45h.apps.googleusercontent.com";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <SocketProvider>
          <App />
        </SocketProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </StrictMode>
);
