const express = require("express");
const { z } = require("zod");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { createSupabaseForReq } = require("../../services/supabase");

const router = express.Router();

const createBookSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  isbn: z.string().min(5).max(32),
  category_id: z.number().int().positive().optional(),
  stock_total: z.number().int().min(0).default(1)
});

router.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const categoryId = typeof req.query.category_id === "string" ? Number(req.query.category_id) : null;

    const supabase = createSupabaseForReq(req);
    let query = supabase.from("books").select("id,title,author,isbn,category_id,stock_total,stock_available,created_at");
    if (q) {
      query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,isbn.ilike.%${q}%`);
    }
    if (Number.isFinite(categoryId) && categoryId > 0) query = query.eq("category_id", categoryId);

    const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const payload = createBookSchema.parse(req.body);
    const supabase = createSupabaseForReq(req);
    const { data, error } = await supabase
      .from("books")
      .insert({
        title: payload.title,
        author: payload.author,
        isbn: payload.isbn,
        category_id: payload.category_id ?? null,
        stock_total: payload.stock_total,
        stock_available: payload.stock_total
      })
      .select("*")
      .single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
});

router.patch("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const schema = z
      .object({
        title: z.string().min(1).optional(),
        author: z.string().min(1).optional(),
        isbn: z.string().min(5).max(32).optional(),
        category_id: z.number().int().positive().nullable().optional(),
        stock_total: z.number().int().min(0).optional(),
        stock_available: z.number().int().min(0).optional()
      })
      .strict();

    const patch = schema.parse(req.body);
    const supabase = createSupabaseForReq(req);
    const { data, error } = await supabase.from("books").update(patch).eq("id", id).select("*").single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const supabase = createSupabaseForReq(req);
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

