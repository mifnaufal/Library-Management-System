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
  const showErrorDetails = isDev || process.env.SHOW_ERROR_DETAILS === "1";

  const originalErr = err;
  const normalizedErr = (() => {
    if (err instanceof Error) return err;
    if (typeof err === "string") return new Error(err);
    if (err && typeof err === "object") {
      const message =
        (typeof err.message === "string" && err.message) ||
        (typeof err.error_description === "string" && err.error_description) ||
        (typeof err.error === "string" && err.error) ||
        "Unknown error";
      const e = new Error(message);
      e.name = (typeof err.name === "string" && err.name) || "NonErrorThrown";
      e.details = err;
      return e;
    }
    return new Error("Unknown error");
  })();

  console.error("[LMS] Unhandled error", {
    requestId,
    path: req.path,
    method: req.method,
    name: normalizedErr?.name,
    message: normalizedErr?.message,
    details: normalizedErr?.details,
    stack: showErrorDetails ? normalizedErr?.stack : undefined
  });

  if (isApi) {
    if (originalErr?.name === "ZodError") {
      return res
        .status(400)
        .json({ error: "Invalid input", request_id: requestId, issues: originalErr.issues, message: originalErr.message });
    }
    return res.status(500).json({ error: "Server error", request_id: requestId });
  }
  return res.status(500).render(
    "pages/error",
    { title: "Error", requestId, message: showErrorDetails ? normalizedErr?.message : null },
    (renderErr, html) => {
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
    }
  );
});

module.exports = app;
