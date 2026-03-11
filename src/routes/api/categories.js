const express = require("express");
const { z } = require("zod");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { createSupabaseForReq } = require("../../services/supabase");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const supabase = createSupabaseForReq(req);
    const { data, error } = await supabase.from("categories").select("id,name,created_at").order("name");
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

const categorySchema = z.object({ name: z.string().min(1).max(80) });

router.post("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { name } = categorySchema.parse(req.body);
    const supabase = createSupabaseForReq(req);
    const { data, error } = await supabase.from("categories").insert({ name }).select("*").single();
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
    const { name } = categorySchema.parse(req.body);
    const supabase = createSupabaseForReq(req);
    const { data, error } = await supabase.from("categories").update({ name }).eq("id", id).select("*").single();
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
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

