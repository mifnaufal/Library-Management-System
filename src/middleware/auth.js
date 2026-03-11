const { supabaseAnon, createSupabaseForToken } = require("../services/supabase");

function getAccessToken(req) {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.toLowerCase().startsWith("bearer ")) {
    return header.slice("bearer ".length).trim();
  }
  if (req.cookies && typeof req.cookies["sb-access-token"] === "string") return req.cookies["sb-access-token"];
  return null;
}

function getRefreshToken(req) {
  if (req.cookies && typeof req.cookies["sb-refresh-token"] === "string") return req.cookies["sb-refresh-token"];
  return null;
}

function setAuthCookies(res, session) {
  const accessToken = session?.access_token;
  const refreshToken = session?.refresh_token;
  if (!accessToken) return;

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
}

function clearAuthCookies(res) {
  res.clearCookie("sb-access-token");
  res.clearCookie("sb-refresh-token");
}

async function refreshSessionIfPossible(req, res) {
  const refreshToken = getRefreshToken(req);
  if (!refreshToken) return null;

  const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data?.session?.access_token) {
    clearAuthCookies(res);
    return null;
  }

  setAuthCookies(res, data.session);
  return data.session.access_token;
}

async function getUserWithRefresh(req, res) {
  const token = getAccessToken(req);

  if (token) {
    const { data, error } = await supabaseAnon.auth.getUser(token);
    if (!error && data?.user) return { user: data.user, accessToken: token };
  }

  const refreshed = await refreshSessionIfPossible(req, res);
  if (!refreshed) return null;

  const { data, error } = await supabaseAnon.auth.getUser(refreshed);
  if (error || !data?.user) return null;
  return { user: data.user, accessToken: refreshed };
}

async function optionalAuth(req, res, next) {
  try {
    const result = await getUserWithRefresh(req, res);
    if (!result) return next();

    req.user = result.user;
    req.supabase = createSupabaseForToken(result.accessToken);
    res.locals.currentUser = { id: result.user.id, email: result.user.email };

    const { data: profile } = await req.supabase.from("users").select("role").eq("id", result.user.id).maybeSingle();
    if (profile?.role) res.locals.currentRole = profile.role;
    return next();
  } catch (err) {
    return next(err);
  }
}

async function requireAuth(req, res, next) {
  try {
    const result = await getUserWithRefresh(req, res);
    if (!result) return res.status(401).json({ error: "Unauthorized" });

    req.user = result.user;
    req.supabase = createSupabaseForToken(result.accessToken);
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireRole(role) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      // Defense-in-depth: check role from DB under the user's JWT + RLS.
      const supabase = req.supabase || createSupabaseForToken(getAccessToken(req));
      const { data, error } = await supabase.from("users").select("role").eq("id", req.user.id).single();
      if (error) return res.status(403).json({ error: "Forbidden" });
      if (data?.role !== role) return res.status(403).json({ error: "Forbidden" });

      res.locals.currentRole = data.role;
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

function requireWebAuth(req, res, next) {
  if (req.user) return next();
  return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl || "/")}`);
}

function requireWebRole(role) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl || "/")}`);

      if (!res.locals.currentRole) {
        const token = getAccessToken(req);
        const supabase = req.supabase || (token ? createSupabaseForToken(token) : null);
        if (!supabase) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl || "/")}`);

        const { data, error } = await supabase.from("users").select("role").eq("id", req.user.id).single();
        if (error || !data?.role) return res.status(403).render("pages/forbidden", { title: "Forbidden" });
        res.locals.currentRole = data.role;
      }

      if (res.locals.currentRole !== role) {
        return res.status(403).render("pages/forbidden", { title: "Forbidden" });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { optionalAuth, requireAuth, requireRole, requireWebAuth, requireWebRole };
