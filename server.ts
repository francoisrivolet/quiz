import "dotenv/config";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketServer } from "socket.io";
import { setupSocketHandlers } from "./src/lib/socket-server";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const parsedUrl = parse(req.url!, true);
    await handle(req, res, parsedUrl);
  });

  const io = new SocketServer(httpServer, {
    cors: { origin: "*" },
  });

  setupSocketHandlers(io);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
