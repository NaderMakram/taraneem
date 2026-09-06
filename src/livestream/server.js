const http = require("http");
const fs = require("fs");
const path = require("path");

const CONTENT_TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".ttf": "font/ttf", ".otf": "font/otf" };

function createLivestreamServer({ state, assetRoot = __dirname, fontPath, onClientsChanged = () => {} }) {
  let server = null;
  const clients = new Set();
  const sockets = new Set();
  let unsubscribe = null;
  const routes = new Map([
    ["/", path.join(assetRoot, "output.html")],
    ["/output.css", path.join(assetRoot, "output.css")],
    ["/scene.js", path.join(assetRoot, "scene.js")],
    ["/fonts/times.ttf", fontPath || path.join(__dirname, "..", "fonts", "times-new-roman-bold.ttf")],
    ["/fonts/traditional.ttf", path.join(__dirname, "..", "fonts", "Traditional-Arabic.ttf")],
    ["/fonts/plex.ttf", path.join(__dirname, "..", "fonts", "IBMPlexSansArabic-SemiBold.ttf")],
    ["/fonts/din.ttf", path.join(__dirname, "..", "fonts", "DINNextLTArabic-Bold-3.ttf")],
    ["/fonts/adobe.otf", path.join(__dirname, "..", "fonts", "adobe-arabic-bold.otf")],
  ]);
  const sendSnapshot = (response, snapshot = state.getSnapshot()) => {
    if (!response.destroyed) response.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
  };
  function handle(request, response) {
    const host = String(request.headers.host || "").toLowerCase();
    if (!/^((127\.0\.0\.1)|(localhost))(?:\:\d+)?$/.test(host)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      return response.end("Forbidden");
    }
    let url;
    try { url = new URL(request.url, `http://${host}`); } catch (_error) {
      response.writeHead(400); return response.end();
    }
    if (request.method !== "GET") { response.writeHead(405, { Allow: "GET" }); return response.end(); }
    if (url.pathname === "/events") {
      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
        "X-Content-Type-Options": "nosniff",
      });
      response.write("retry: 1000\n\n");
      clients.add(response);
      sendSnapshot(response);
      onClientsChanged(clients.size);
      request.on("close", () => { clients.delete(response); onClientsChanged(clients.size); });
      return;
    }
    const filePath = routes.get(url.pathname);
    if (!filePath) { response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return response.end("Not found"); }
    fs.readFile(filePath, (error, data) => {
      if (error) { response.writeHead(404); return response.end(); }
      response.writeHead(200, {
        "Content-Type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; connect-src 'self'; img-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      });
      response.end(data);
    });
  }
  return {
    async start(port) {
      if (server?.listening) {
        const address = server.address();
        if (address?.port === port) return address;
        await this.stop();
      }
      server = http.createServer(handle);
      server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
      server.on("clientError", (_error, socket) => socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"));
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", () => { server.removeListener("error", reject); resolve(); });
      });
      unsubscribe = state.subscribe(snapshot => {
        for (const client of clients) sendSnapshot(client, snapshot);
      });
      return server.address();
    },
    async stop() {
      unsubscribe?.(); unsubscribe = null;
      for (const client of clients) client.end();
      clients.clear();
      if (!server) return;
      const current = server; server = null;
      const closed = new Promise(resolve => current.close(() => resolve()));
      for (const socket of sockets) socket.destroy();
      sockets.clear();
      await closed;
    },
    getClientCount: () => clients.size,
    isRunning: () => Boolean(server?.listening),
  };
}

module.exports = { createLivestreamServer };
