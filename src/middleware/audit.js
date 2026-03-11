const { supabaseAdmin } = require("../services/supabaseAdmin");

function getIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.ip;
}

function auditLogger() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", async () => {
      try {
        if (req.path.startsWith("/css/") || req.path.startsWith("/js/") || req.path.startsWith("/images/")) return;
        if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;

        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        const actorId = req.user?.id || null;
        const actorEmail = req.user?.email || null;
        const actorRole = res.locals.currentRole || null;
        const requestId = req.id || null;

        const entry = {
          created_at: new Date().toISOString(),
          request_id: requestId,
          actor_id: actorId,
          actor_email: actorEmail,
          actor_role: actorRole,
          method: req.method,
          path: req.originalUrl || req.path,
          status_code: res.statusCode,
          ip: getIp(req),
          user_agent: String(req.headers["user-agent"] || "").slice(0, 300),
          duration_ms: Math.round(durationMs)
        };

        console.info("[LMS] audit", entry);

        if (supabaseAdmin) {
          await supabaseAdmin.from("audit_logs").insert(entry);
        }
      } catch (err) {
        console.warn("[LMS] audit logger failed", err?.message || err);
      }
    });

    next();
  };
}

module.exports = { auditLogger };

