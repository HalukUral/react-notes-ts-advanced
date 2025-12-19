
import { Hono } from "npm:hono";
import { wsManager } from "../utils/wsManager.ts";

export const wsRoute = new Hono();

// WebSocket endpoint at /ws
wsRoute.get("/ws", (c) => {
 
  const userId = c.req.query("userId");
  const username = c.req.query("username");
  const token = c.req.query("token");

  if (!userId || !username || !token) {
    return c.json({ error: "Missing credentials" }, 400);
  }

  const { socket, response } = Deno.upgrade(c.req.raw);
  const clientId = wsManager.addClient(socket, Number(userId), username);


  (async () => {
    try {
      for await (const message of socket) {
        if (typeof message === "string") {
          try {
            const data = JSON.parse(message);
            console.log(`[WS] Message from ${clientId}:`, data);
            
            if (data.type === "ping") {
              socket.send(JSON.stringify({ type: "pong" }));
            }
          } catch (error) {
            console.error(`[WS] Error parsing message from ${clientId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`[WS] Connection error for ${clientId}:`, error);
    } finally {
      wsManager.removeClient(clientId);
      socket.close();
    }
  })();

  return response;
});
