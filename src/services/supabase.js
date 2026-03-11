const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("[LMS] Missing SUPABASE_URL or SUPABASE_ANON_KEY. Set them in environment variables (.env/Vercel).");
}

const supabaseAnon =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

function getBearerTokenFromHeader(req) {
  const header = req?.headers?.authorization;
  if (typeof header !== "string") return null;
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  return header.slice("bearer ".length).trim();
}

function createSupabaseForToken(accessToken) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured (missing SUPABASE_URL/SUPABASE_ANON_KEY).");
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function createSupabaseForReq(req) {
  if (req.supabase) return req.supabase;
  if (!supabaseAnon) {
    throw new Error("Supabase is not configured (missing SUPABASE_URL/SUPABASE_ANON_KEY).");
  }
  const headerToken = getBearerTokenFromHeader(req);
  const cookieToken =
    (req.cookies && typeof req.cookies["sb-access-token"] === "string" && req.cookies["sb-access-token"]) || null;
  const token = headerToken || cookieToken;
  return token ? createSupabaseForToken(token) : supabaseAnon;
}

module.exports = { supabaseAnon, createSupabaseForToken, createSupabaseForReq };
