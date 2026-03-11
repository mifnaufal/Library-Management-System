const http = require("http");
const app = require("./app");

const server = http.createServer(app);

function startListening(initialPort) {
  const basePort = Number(initialPort || 3000);
  const isProd = process.env.NODE_ENV === "production";
  const maxTries = isProd ? 1 : 20;

  let attempt = 0;
  function tryListen(port) {
    attempt += 1;
    server.once("error", (err) => {
      if (err && err.code === "EADDRINUSE" && attempt < maxTries) {
        const nextPort = port + 1;
        console.warn(`[LMS pid=${process.pid}] Port ${port} is in use; trying ${nextPort}...`);
        return tryListen(nextPort);
      }

      if (err && err.code === "EADDRINUSE") {
        console.error(`[LMS pid=${process.pid}] Port ${port} is already in use.`);
        console.error(`[LMS] Fix: stop the other process or set PORT to a different value (e.g. PORT=3001) in .env.`);
        process.exit(1);
      }
      throw err;
    });

    server.listen(port, () => {
      console.log(`[LMS pid=${process.pid}] listening on http://localhost:${port}`);
    });
  }

  tryListen(basePort);
}

startListening(process.env.PORT);
