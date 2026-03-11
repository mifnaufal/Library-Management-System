const express = require("express");
const { z } = require("zod");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { createSupabaseForReq } = require("../../services/supabase");
const { getMonthRangeUtc } = require("../../utils/dates");

const router = express.Router();

router.get("/analytics/top-books", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { from, to } = getMonthRangeUtc(new Date());
    const supabase = createSupabaseForReq(req);
    const { data, error } = await supabase.rpc("top_borrowed_books", {
      p_from: from,
      p_to: to,
      p_limit: 5
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ range: { from, to }, data });
  } catch (err) {
    return next(err);
  }
});

router.patch("/users/:id/role", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { role } = z.object({ role: z.enum(["admin", "member"]) }).parse(req.body);
    const supabase = createSupabaseForReq(req);
    const { data, error } = await supabase.from("users").update({ role }).eq("id", req.params.id).select("*").single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
