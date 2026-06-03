import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Mounts /api/auth/* including the OAuth callback /api/auth/callback/{provider}.
auth.addHttpRoutes(http);

export default http;
