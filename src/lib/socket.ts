import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === "undefined") throw new Error("Client only");
  if (!socket) {
    socket = io({ autoConnect: true, reconnection: true });
  }
  return socket;
}

export function resetSocket() {
  socket?.disconnect();
  socket = null;
}
