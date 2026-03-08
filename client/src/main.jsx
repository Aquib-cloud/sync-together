import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

if (import.meta.env.DEV && typeof document !== "undefined" && typeof window !== "undefined") {
  if (window.__SYNC_TOGETHER_CLICK_DEBUG__) {
    document.removeEventListener("click", window.__SYNC_TOGETHER_CLICK_DEBUG__);
  }
  window.__SYNC_TOGETHER_CLICK_DEBUG__ = (event) => {
    console.log("Clicked:", event.target);
  };
  document.addEventListener("click", window.__SYNC_TOGETHER_CLICK_DEBUG__);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
