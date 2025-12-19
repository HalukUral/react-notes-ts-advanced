import { Hono } from "npm:hono";
import { z } from "npm:zod";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import * as jose from "npm:jose";

import { orm } from "../db/drizzle.ts";
import { users } from "../db/schema.ts";
import { eq } from "npm:drizzle-orm";
import { saveDb } from "../db/connection.ts";
import { tokenBlacklist } from "../utils/bloomFilter.ts";

const JWT_SECRET = Deno.env.get("JWT_SECRET") || "your-super-secret-key-12345-change-this";
const secret = new TextEncoder().encode(JWT_SECRET);

const authRoute = new Hono();

// Zod schemas
const RegisterSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

// Register endpoint
authRoute.post("/register", async (c) => {
  try {
    const body = await c.req.json();
    const validated = RegisterSchema.parse(body);

    // Check if user exists
    const existingUser = await orm
      .select()
      .from(users)
      .where(eq(users.username, validated.username))
      .get();

    if (existingUser) {
      return c.json({ error: "Username already exists" }, 400);
    }

    // Check if email exists
    const existingEmail = await orm
      .select()
      .from(users)
      .where(eq(users.email, validated.email))
      .get();

    if (existingEmail) {
      return c.json({ error: "Email already exists" }, 400);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(validated.password);

    // Create user
    const newUser = {
      username: validated.username,
      email: validated.email,
      passwordHash,
    };

    const result = await orm.insert(users).values(newUser).returning().get();
    await saveDb();

    // Generate JWT token
    const token = await new jose.SignJWT({ 
      userId: result.id, 
      username: result.username, 
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret);

    return c.json({
      message: "User created successfully",
      user: {
        id: result.id,
        username: result.username,
        email: result.email,
      },
      token,
    }, 201);
  } catch (error) {
    console.error("Registration error:", error);
    if (error instanceof z.ZodError) {
      return c.json({ error: error.errors }, 400);
    }
    return c.json({ error: "Registration failed" }, 500);
  }
});

// Login endpoint
authRoute.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const validated = LoginSchema.parse(body);

    // Find user
    const user = await orm
      .select()
      .from(users)
      .where(eq(users.username, validated.username))
      .get();

    if (!user) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    // Verify password
    const validPassword = await bcrypt.compare(validated.password, user.passwordHash);
    if (!validPassword) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    // Generate JWT token
    const token = await new jose.SignJWT({ 
      userId: user.id, 
      username: user.username 
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret);

    return c.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof z.ZodError) {
      return c.json({ error: error.errors }, 400);
    }
    return c.json({ error: "Login failed" }, 500);
  }
});

// Logout endpoint
authRoute.post("/logout", async (c) => {
  try {
    // Get token from Authorization header
    const authHeader = c.req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      // Add token to blacklist
      await tokenBlacklist.add(token);
      console.log("Token blacklisted on logout");
    }
    return c.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return c.json({ error: "Logout failed" }, 500);
  }
});

// Verify token endpoint (optional)
authRoute.post("/verify", async (c) => {
  try {
    const { token } = await c.req.json();
    
    const { payload } = await jose.jwtVerify(token, secret);
    return c.json({ valid: true, user: payload });
  } catch {
    return c.json({ valid: false }, 401);
  }
});

// Check if token is blacklisted (for debugging)
authRoute.post("/check-blacklist", async (c) => {
  try {
    const { token } = await c.req.json();
    if (!token) {
      return c.json({ error: "Token required" }, 400);
    }
    
    const isBlacklisted = await tokenBlacklist.contains(token);
    return c.json({ 
      token: token.substring(0, 20) + "...", 
      isBlacklisted,
      stats: tokenBlacklist.getStats()
    });
  } catch (error) {
    console.error("Check blacklist error:", error);
    return c.json({ error: "Check failed" }, 500);
  }
});

export { authRoute };