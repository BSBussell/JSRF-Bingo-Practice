import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

function isPopoutView() {
  if (typeof window === "undefined") {
    return false;
  }

  const currentUrl = new URL(window.location.href);
  return currentUrl.pathname.endsWith("/popout.html") || currentUrl.pathname.endsWith("popout.html");
}

function getErrorMessage(errorLike) {
  if (errorLike instanceof Error) {
    return errorLike.stack ?? errorLike.message;
  }

  if (typeof errorLike === "string") {
    return errorLike;
  }

  try {
    return JSON.stringify(errorLike, null, 2);
  } catch {
    return String(errorLike);
  }
}

function renderFatalScreen(title, detail) {
  const container = document.getElementById("root") ?? document.body;
  if (!container) {
    return;
  }

  container.innerHTML = `
    <div style="
      min-height: 100vh;
      padding: 24px;
      background: #10151e;
      color: #f7efe5;
      font-family: 'Jet Set', 'Segoe UI', sans-serif;
    ">
      <div style="
        max-width: 900px;
        margin: 0 auto;
        padding: 20px;
        border-radius: 16px;
        border: 1px solid rgba(255, 228, 202, 0.12);
        background: rgba(15, 19, 29, 0.92);
      ">
        <p style="margin: 0 0 8px; color: #ffd38c; letter-spacing: 0.08em;">POP OUT ERROR</p>
        <h1 style="margin: 0 0 12px; font-size: 28px;">${title}</h1>
        <p style="margin: 0 0 12px;">The desktop popout hit a fatal error while loading.</p>
        <pre style="
          margin: 0;
          padding: 16px;
          overflow: auto;
          white-space: pre-wrap;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.28);
          color: #e1d6c9;
        ">${detail.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</pre>
      </div>
    </div>
  `;
}

if (typeof window !== "undefined" && isPopoutView()) {
  window.addEventListener("error", (event) => {
    renderFatalScreen(
      event.message || "Unhandled error",
      getErrorMessage(event.error ?? event.message)
    );
  });

  window.addEventListener("unhandledrejection", (event) => {
    renderFatalScreen(
      "Unhandled promise rejection",
      getErrorMessage(event.reason)
    );
  });
}

try {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  renderFatalScreen("Render failed", getErrorMessage(error));
}
