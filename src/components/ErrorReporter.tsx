"use client";

import { useEffect } from "react";

const ENDPOINT = "/api/telemetry";

function send(payload: Record<string, unknown>): void {
  const body = JSON.stringify(payload);
  try {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
  } catch {
    // Fall through to fetch.
  }
  // Reporting must never raise a second error in the page, so a failed send is dropped.
  fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
}

function describe(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) return { message: value.message, stack: value.stack };
  try {
    return { message: typeof value === "string" ? value : JSON.stringify(value) ?? String(value) };
  } catch {
    return { message: String(value) };
  }
}

// Mount once in the root layout; renders nothing and reports uncaught browser errors.
export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      const d = e.error !== undefined && e.error !== null ? describe(e.error) : { message: e.message };
      send({
        event: "client_error",
        ...d,
        url: location.href,
        data: { source: e.filename, line: e.lineno, col: e.colno },
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      send({ event: "client_unhandled_rejection", ...describe(e.reason), url: location.href });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
