const express = require("express");
const { z } = require("zod");
const { supabaseAnon } = require("../../services/supabase");

const router = express.Router();

function ensureSupabaseConfigured(res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    res.status(500).json({
      error: "Supabase belum dikonfigurasi. Pastikan SUPABASE_URL dan SUPABASE_ANON_KEY ada di .env."
    });
    return false;
  }
  return true;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

router.post("/login", async (req, res, next) => {
  try {
    if (!ensureSupabaseConfigured(res)) return;
    const { email, password } = loginSchema.parse(req.body);
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("[LMS] login error", { requestId: req.id, message: error.message, status: error.status });
      return res.status(401).json({ error: error.message, request_id: req.id });
    }

    const accessToken = data?.session?.access_token;
    const refreshToken = data?.session?.refresh_token;
    if (!accessToken) return res.status(500).json({ error: "No session returned", request_id: req.id });

    res.cookie("sb-access-token", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 1000
    });
    if (refreshToken) {
      res.cookie("sb-refresh-token", refreshToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
    }

    return res.json({ user: data.user, request_id: req.id });
  } catch (err) {
    return next(err);
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("sb-access-token");
  res.clearCookie("sb-refresh-token");
  res.json({ ok: true });
});

router.get("/me", async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token =
      (typeof header === "string" && header.toLowerCase().startsWith("bearer ")
        ? header.slice("bearer ".length).trim()
        : null) ||
      (req.cookies && req.cookies["sb-access-token"]) ||
      null;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Invalid token" });
    return res.json({ user: data.user });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
