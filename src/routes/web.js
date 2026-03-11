const express = require("express");
const { z } = require("zod");
const { optionalAuth, requireWebRole } = require("../middleware/auth");
const { supabaseAnon, createSupabaseForReq } = require("../services/supabase");
const { getMonthRangeUtc } = require("../utils/dates");

const router = express.Router();

router.use(optionalAuth);

router.get("/login", (req, res) => {
  if (req.user) return res.redirect("/");
  const notice = req.query.registered ? "Akun berhasil dibuat. Silakan login." : null;
  const next = typeof req.query.next === "string" ? req.query.next : "/";
  res.render("pages/login", { title: "Login", notice, error: null, next });
});

router.get("/register", (req, res) => {
  if (req.user) return res.redirect("/");
  res.render("pages/register", { title: "Register", error: null });
});

function setAuthCookiesFromSession(res, session) {
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

const registerSchema = z.object({
  full_name: z.string().min(1).max(120).optional().or(z.literal("")),
  email: z.string().email(),
  password: z.string().min(8)
});

router.post("/register", async (req, res, next) => {
  try {
    if (!supabaseAnon) return next(new Error("Supabase is not configured (missing SUPABASE_URL/SUPABASE_ANON_KEY)."));
    const parsed = registerSchema.parse(req.body);
    const fullName = parsed.full_name && parsed.full_name.trim() ? parsed.full_name.trim() : undefined;

    const { error } = await supabaseAnon.auth.signUp({
      email: parsed.email,
      password: parsed.password,
      options: { data: fullName ? { full_name: fullName } : undefined }
    });

    if (error) {
      return res.status(400).render("pages/register", { title: "Register", error: error.message });
    }

    return res.redirect("/login?registered=1");
  } catch (err) {
    return next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  next: z.string().optional()
});

router.post("/login", async (req, res, next) => {
  try {
    if (!supabaseAnon) return next(new Error("Supabase is not configured (missing SUPABASE_URL/SUPABASE_ANON_KEY)."));
    const { email, password, next: nextParam } = loginSchema.parse(req.body);
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error) {
      return res
        .status(401)
        .render("pages/login", { title: "Login", notice: null, error: error.message, next: nextParam || "/" });
    }
    setAuthCookiesFromSession(res, data.session);
    const nextUrl = typeof nextParam === "string" && nextParam.startsWith("/") ? nextParam : "/";
    return res.redirect(nextUrl);
  } catch (err) {
    return next(err);
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("sb-access-token");
  res.clearCookie("sb-refresh-token");
  return res.redirect("/login");
});

router.get("/", async (req, res, next) => {
  try {
    const supabase = createSupabaseForReq(req);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const categoryId = typeof req.query.category_id === "string" ? Number(req.query.category_id) : null;
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const pageSize = 12;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data: categories, error: categoriesError } = await supabase
      .from("categories")
      .select("id,name")
      .order("name");
    if (categoriesError) return next(categoriesError);

    let booksQuery = supabase
      .from("books")
      .select("id,title,author,isbn,category_id,stock_total,stock_available,categories(name)", { count: "exact" });
    if (q) booksQuery = booksQuery.or(`title.ilike.%${q}%,author.ilike.%${q}%,isbn.ilike.%${q}%`);
    if (Number.isFinite(categoryId) && categoryId > 0) booksQuery = booksQuery.eq("category_id", categoryId);

    const { data: books, error: booksError, count } = await booksQuery
      .order("created_at", { ascending: false })
      .range(from, to);
    if (booksError) return next(booksError);

    const total = Number(count || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return res.render("pages/home", {
      title: "Catalog",
      categories: categories || [],
      books: books || [],
      q,
      category_id: Number.isFinite(categoryId) ? categoryId : "",
      page,
      totalPages,
      total
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/member/dashboard", requireWebRole("member"), async (req, res, next) => {
  try {
    const supabase = req.supabase || createSupabaseForReq(req);
    const { data, error } = await supabase
      .from("transactions")
      .select("id,checked_out_at,due_at,checked_in_at,fine_amount,books(id,title,author,isbn)")
      .order("checked_out_at", { ascending: false })
      .limit(200);
    if (error) return next(error);

    const active = (data || []).filter((t) => !t.checked_in_at);
    const history = (data || []).filter((t) => t.checked_in_at);

    return res.render("pages/member-dashboard", {
      title: "My Loans",
      active,
      history,
      error: typeof req.query.error === "string" ? req.query.error : null
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/member/checkout", requireWebRole("member"), async (req, res, next) => {
  try {
    const schema = z.object({ book_id: z.coerce.number().int().positive(), loan_days: z.coerce.number().int().min(1).max(60).optional() });
    const { book_id, loan_days } = schema.parse(req.body);

    const supabase = req.supabase || createSupabaseForReq(req);
    const { error } = await supabase.rpc("checkout_book", {
      p_book_id: book_id,
      p_member_id: req.user.id,
      p_loan_days: loan_days ?? 14
    });
    if (error) return res.redirect(`/member/dashboard?error=${encodeURIComponent(error.message)}`);
    return res.redirect("/member/dashboard");
  } catch (err) {
    return next(err);
  }
});

router.post("/member/checkin", requireWebRole("member"), async (req, res, next) => {
  try {
    const schema = z.object({ transaction_id: z.coerce.number().int().positive() });
    const { transaction_id } = schema.parse(req.body);

    const supabase = req.supabase || createSupabaseForReq(req);
    const { error } = await supabase.rpc("checkin_book", { p_transaction_id: transaction_id });
    if (error) return res.redirect(`/member/dashboard?error=${encodeURIComponent(error.message)}`);
    return res.redirect("/member/dashboard");
  } catch (err) {
    return next(err);
  }
});

router.get("/admin/dashboard", requireWebRole("admin"), async (req, res, next) => {
  try {
    const supabase = req.supabase || createSupabaseForReq(req);
    const { from, to } = getMonthRangeUtc(new Date());

    const [{ count: booksCount, error: booksCountError }, { count: usersCount, error: usersCountError }] =
      await Promise.all([
        supabase.from("books").select("id", { count: "exact", head: true }),
        supabase.from("users").select("id", { count: "exact", head: true }).eq("role", "member")
      ]);
    if (booksCountError) return next(booksCountError);
    if (usersCountError) return next(usersCountError);

    const { count: txMonthCount, error: txMonthError } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .gte("checked_out_at", from)
      .lt("checked_out_at", to);
    if (txMonthError) return next(txMonthError);

    const { data: topBooks, error: topBooksError } = await supabase.rpc("top_borrowed_books", {
      p_from: from,
      p_to: to,
      p_limit: 5
    });
    if (topBooksError) return next(topBooksError);

    return res.render("pages/admin/dashboard", {
      title: "Admin Dashboard",
      stats: {
        total_books: Number(booksCount || 0),
        total_members: Number(usersCount || 0),
        tx_this_month: Number(txMonthCount || 0)
      },
      range: { from, to },
      topBooks: topBooks || []
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/admin/books", requireWebRole("admin"), async (req, res, next) => {
  try {
    const supabase = req.supabase || createSupabaseForReq(req);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    let query = supabase
      .from("books")
      .select("id,title,author,isbn,stock_total,stock_available,category_id,categories(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,isbn.ilike.%${q}%`);

    const [{ data: books, error: booksError }, { data: categories, error: categoriesError }] = await Promise.all([
      query,
      supabase.from("categories").select("id,name").order("name")
    ]);
    if (booksError) return next(booksError);
    if (categoriesError) return next(categoriesError);

    return res.render("pages/admin/books", {
      title: "Manage Books",
      books: books || [],
      categories: categories || [],
      q
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/admin/books/new", requireWebRole("admin"), async (req, res, next) => {
  try {
    const supabase = req.supabase || createSupabaseForReq(req);
    const { data: categories, error } = await supabase.from("categories").select("id,name").order("name");
    if (error) return next(error);
    return res.render("pages/admin/book-form", {
      title: "Add Book",
      mode: "new",
      book: null,
      categories: categories || [],
      error: null
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/admin/books/new", requireWebRole("admin"), async (req, res, next) => {
  try {
    const schema = z.object({
      title: z.string().min(1),
      author: z.string().min(1),
      isbn: z.string().min(5).max(32),
      category_id: z.coerce.number().int().positive().optional().or(z.literal("")),
      stock_total: z.coerce.number().int().min(0).default(1)
    });
    const payload = schema.parse(req.body);
    const categoryId = payload.category_id === "" ? null : payload.category_id ?? null;

    const supabase = req.supabase || createSupabaseForReq(req);
    const { error } = await supabase.from("books").insert({
      title: payload.title,
      author: payload.author,
      isbn: payload.isbn,
      category_id: categoryId,
      stock_total: payload.stock_total,
      stock_available: payload.stock_total
    });
    if (error) throw error;
    return res.redirect("/admin/books");
  } catch (err) {
    try {
      const supabase = req.supabase || createSupabaseForReq(req);
      const { data: categories } = await supabase.from("categories").select("id,name").order("name");
      return res.status(400).render("pages/admin/book-form", {
        title: "Add Book",
        mode: "new",
        book: req.body,
        categories: categories || [],
        error: err.message || "Failed to add book"
      });
    } catch (e) {
      return next(err);
    }
  }
});

router.get("/admin/books/:id/edit", requireWebRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).render("pages/error", { title: "Error" });
    const supabase = req.supabase || createSupabaseForReq(req);
    const [{ data: book, error: bookError }, { data: categories, error: categoriesError }] = await Promise.all([
      supabase.from("books").select("*").eq("id", id).single(),
      supabase.from("categories").select("id,name").order("name")
    ]);
    if (bookError) return next(bookError);
    if (categoriesError) return next(categoriesError);
    return res.render("pages/admin/book-form", {
      title: "Edit Book",
      mode: "edit",
      book,
      categories: categories || [],
      error: typeof req.query.error === "string" ? req.query.error : null
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/admin/books/:id/edit", requireWebRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).render("pages/error", { title: "Error" });
    const schema = z.object({
      title: z.string().min(1),
      author: z.string().min(1),
      isbn: z.string().min(5).max(32),
      category_id: z.coerce.number().int().positive().optional().or(z.literal("")),
      stock_total: z.coerce.number().int().min(0),
      stock_available: z.coerce.number().int().min(0)
    });
    const payload = schema.parse(req.body);
    const categoryId = payload.category_id === "" ? null : payload.category_id ?? null;
    if (payload.stock_available > payload.stock_total) {
      return res.redirect(`/admin/books/${id}/edit?error=${encodeURIComponent("stock_available cannot exceed stock_total")}`);
    }

    const supabase = req.supabase || createSupabaseForReq(req);
    const { error } = await supabase
      .from("books")
      .update({
        title: payload.title,
        author: payload.author,
        isbn: payload.isbn,
        category_id: categoryId,
        stock_total: payload.stock_total,
        stock_available: payload.stock_available
      })
      .eq("id", id);
    if (error) throw error;
    return res.redirect("/admin/books");
  } catch (err) {
    return next(err);
  }
});

router.post("/admin/books/:id/delete", requireWebRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).render("pages/error", { title: "Error" });
    const supabase = req.supabase || createSupabaseForReq(req);
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) throw error;
    return res.redirect("/admin/books");
  } catch (err) {
    return next(err);
  }
});

router.get("/admin/categories", requireWebRole("admin"), async (req, res, next) => {
  try {
    const supabase = req.supabase || createSupabaseForReq(req);
    const { data: categories, error } = await supabase.from("categories").select("id,name,created_at").order("name");
    if (error) return next(error);
    return res.render("pages/admin/categories", {
      title: "Manage Categories",
      categories: categories || [],
      error: typeof req.query.error === "string" ? req.query.error : null
    });
  } catch (err) {
    return next(err);
  }
});

router.post("/admin/categories", requireWebRole("admin"), async (req, res, next) => {
  try {
    const schema = z.object({ name: z.string().min(1).max(80) });
    const { name } = schema.parse(req.body);
    const supabase = req.supabase || createSupabaseForReq(req);
    const { error } = await supabase.from("categories").insert({ name });
    if (error) return res.redirect(`/admin/categories?error=${encodeURIComponent(error.message)}`);
    return res.redirect("/admin/categories");
  } catch (err) {
    return next(err);
  }
});

router.post("/admin/categories/:id/delete", requireWebRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).render("pages/error", { title: "Error" });
    const supabase = req.supabase || createSupabaseForReq(req);
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return res.redirect(`/admin/categories?error=${encodeURIComponent(error.message)}`);
    return res.redirect("/admin/categories");
  } catch (err) {
    return next(err);
  }
});

router.get("/admin/transactions", requireWebRole("admin"), async (req, res, next) => {
  try {
    const supabase = req.supabase || createSupabaseForReq(req);
    const { data, error } = await supabase
      .from("transactions")
      .select("id,checked_out_at,due_at,checked_in_at,fine_amount,books(title,author,isbn),users(email)")
      .order("checked_out_at", { ascending: false })
      .limit(300);
    if (error) return next(error);
    return res.render("pages/admin/transactions", { title: "Transactions", transactions: data || [] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
