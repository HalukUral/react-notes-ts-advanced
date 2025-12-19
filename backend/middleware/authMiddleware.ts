import { Context, Next } from "npm:hono";
import * as jose from "npm:jose";
import { tokenBlacklist } from "../utils/bloomFilter.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-super-secret-key-12345-change-this";
const secret = new TextEncoder().encode(JWT_SECRET);

export async function authMiddleware(c: Context, next: Next) {
  // Public routes - auth gerektirmeyenler
  const publicRoutes = [
    "/api/auth/login", 
    "/api/auth/register", 
    "/api/auth/verify",
    "/api/auth/logout",
    "/api/hello", 
    "/openapi.json", 
    "/docs"
  ];
  
  if (publicRoutes.includes(c.req.path)) {
    return next();
  }

  // Get token from Authorization header
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized - No token provided" }, 401);
  }

  const token = authHeader.substring(7);

  try {
    // Check if token is blacklisted
    const isBlacklisted = await tokenBlacklist.contains(token);
    if (isBlacklisted) {
      return c.json({ error: "Unauthorized - Token has been revoked" }, 401);
    }

    // Verify token
    const { payload } = await jose.jwtVerify(token, secret);
    
    // Add user info to context
    c.set("user", {
      userId: payload.userId as number,
      username: payload.username as string,
    });
    
    // Store token in context for logout if needed
    c.set("token", token);

    return next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return c.json({ error: "Unauthorized - Invalid or expired token" }, 401);
  }
}