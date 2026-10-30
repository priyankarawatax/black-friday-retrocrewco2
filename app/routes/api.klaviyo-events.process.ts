import type { ActionFunctionArgs } from "react-router";

import {
  isAuthorizedKlaviyoRequest,
  isKlaviyoRouteConfigured,
} from "../services/klaviyo-route-auth.server";
import { processKlaviyoOutbox } from "../services/klaviyo.server";

export const loader = async () =>
  Response.json({ error: "Method not allowed." }, { status: 405 });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }
  if (!isKlaviyoRouteConfigured()) {
    return Response.json({ error: "Klaviyo processor is not configured." }, { status: 503 });
  }
  if (!isAuthorizedKlaviyoRequest(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  return Response.json(await processKlaviyoOutbox({ limit: 25 }));
};
