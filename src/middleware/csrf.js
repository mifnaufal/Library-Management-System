const crypto = require("crypto");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isIgnoredPath(req) {
  return req.path.startsWith("/api/") || req.path.startsWith("/css/") || req.path.startsWith("/js/") || req.path.startsWith("/images/");
}

function readCookieFromHeader(req, name) {
  const header = req?.headers?.cookie;
  if (typeof header !== "string" || !header) return null;
  const parts = header.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (!part) continue;
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    if (k !== name) continue;
    const v = part.slice(idx + 1);
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return null;
}

function getCookie(req, name) {
  const fromParser = req?.cookies?.[name];
  if (typeof fromParser === "string" && fromParser) return fromParser;
  return readCookieFromHeader(req, name);
}

function toBuffer(str) {
  return Buffer.from(String(str || ""), "utf8");
}

function timingSafeEqual(a, b) {
  const aa = toBuffer(a);
  const bb = toBuffer(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function csrf() {
  return (req, res, next) => {
    if (isIgnoredPath(req)) return next();

    const cookieName = "csrf-token";
    let token = getCookie(req, cookieName);

    if (!token) {
      token = crypto.randomBytes(32).toString("hex");
      res.cookie(cookieName, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production"
      });
    }

    res.locals.csrfToken = token;

    if (SAFE_METHODS.has(req.method)) return next();

    const provided =
      (req.body && (req.body._csrf || req.body.csrf_token)) ||
      req.headers["x-csrf-token"] ||
      req.headers["x-xsrf-token"] ||
      null;

    if (!provided || !timingSafeEqual(provided, token)) {
      return res.status(403).render("pages/forbidden", { title: "Forbidden" });
    }

    return next();
  };
}

module.exports = { csrf };
