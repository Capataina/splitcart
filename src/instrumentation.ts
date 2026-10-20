import type { Instrumentation } from "next";

// Every server-side request error (render, route handler, server action, proxy)
// lands in telemetry. Telemetry imports node:fs, so it is loaded only in the
// nodejs runtime; edge errors still reach the console. Request headers are not
// logged because they carry the access cookie.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const data = {
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
  };
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { trackError } = await import("./lib/telemetry");
    trackError("onRequestError", err, data);
  } else {
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: "error", event: "error", where: "onRequestError", ...data, message: err instanceof Error ? err.message : String(err) }));
  }
};
