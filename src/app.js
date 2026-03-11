require("dotenv").config();

const path = require("path");
const express = require("express");
const layouts = require("express-ejs-layouts");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const helmet = require("helmet");

const webRoutes = require("./routes/web");
const apiRoutes = require("./routes/api");
const { requestId } = require("./middleware/requestId");
const { csrf } = require("./middleware/csrf");
const { authLimiter, apiLimiter } = require("./middleware/rateLimit");
const { auditLogger } = require("./middleware/audit");

const app = express();

app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(requestId());
app.use(auditLogger());

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET || "dev-secret"));
app.use(csrf());

app.use(["/login", "/register", "/api/auth/login"], authLimiter());
app.use("/api", apiLimiter());

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(layouts);
app.set("layout", "layout");

app.use(express.static(path.join(__dirname, "public")));

app.get("/healthz", (req, res) => {
  res.json({
    ok: true,
    node: process.version,
    env: process.env.NODE_ENV || "unknown",
    hasSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    hasCookieSecret: Boolean(process.env.COOKIE_SECRET),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  });
});

app.use("/", webRoutes);
app.use("/api", apiRoutes);

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  return res.status(404).render("pages/not-found", { title: "Not Found" }, (err, html) => {
    if (err) return res.status(404).send("Not found");
    return res.status(404).send(html);
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const requestId = req.id || null;
  const isApi = req.path.startsWith("/api/");
  const isDev = process.env.NODE_ENV !== "production";

  console.error("[LMS] Unhandled error", {
    requestId,
    path: req.path,
    method: req.method,
    name: err?.name,
    message: err?.message,
    stack: isDev ? err?.stack : undefined
  });

  if (isApi) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: "Invalid input", request_id: requestId, issues: err.issues });
    }
    return res.status(500).json({ error: "Server error", request_id: requestId });
  }
  return res.status(500).render("pages/error", { title: "Error", requestId }, (renderErr, html) => {
    if (renderErr) {
      console.error("[LMS] Failed to render error page", {
        requestId,
        name: renderErr?.name,
        message: renderErr?.message
      });
      return res
        .status(500)
        .type("text")
        .send(`Internal Server Error${requestId ? ` (request_id: ${requestId})` : ""}`);
    }
    return res.status(500).send(html);
  });
});

module.exports = app;
