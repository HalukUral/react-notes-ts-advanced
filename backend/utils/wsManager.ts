/**
 * WebSocket Manager for real-time task updates
 * Manages client connections and broadcasts updates across users
 */

interface ConnectedClient {
  ws: WebSocket;
  userId: number;
  username: string;
}

class WSManager {
  private clients: Map<string, ConnectedClient> = new Map();
  private clientIdCounter = 0;

  /**
   * Add a new client connection
   */
  addClient(ws: WebSocket, userId: number, username: string): string {
    const clientId = `${userId}-${this.clientIdCounter++}`;
    this.clients.set(clientId, { ws, userId, username });
    console.log(`[WS] Client connected: ${clientId} (${username})`);
    return clientId;
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string): void {
    this.clients.delete(clientId);
    console.log(`[WS] Client disconnected: ${clientId}`);
  }

  /**
   * Broadcast task update to all clients of a specific user
   */
  broadcastTaskUpdate(
    userId: number,
    eventType: "create" | "update" | "delete",
    task: any
  ): void {
    const message = JSON.stringify({
      type: "task",
      eventType,
      task,
      timestamp: Date.now(),
    });

    let sentCount = 0;
    for (const [clientId, client] of this.clients.entries()) {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
          sentCount++;
        } catch (error) {
          console.error(`[WS] Error sending to ${clientId}:`, error);
          this.removeClient(clientId);
        }
      }
    }

    console.log(
      `[WS] Broadcasted ${eventType} event to ${sentCount} client(s) of user ${userId}`
    );
  }

  /**
   * Get number of connected clients for a user
   */
  getClientCount(userId: number): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.userId === userId) count++;
    }
    return count;
  }

  /**
   * Get total number of connected clients
   */
  getTotalClientCount(): number {
    return this.clients.size;
  }
}

export const wsManager = new WSManager();
