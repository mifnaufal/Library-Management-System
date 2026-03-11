const express = require("express");
const { z } = require("zod");
const { requireAuth, requireRole } = require("../../middleware/auth");
const { createSupabaseForReq } = require("../../services/supabase");

const router = express.Router();

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const supabase = createSupabaseForReq(req);
    const { data, error } = await supabase
      .from("transactions")
      .select("id,book_id,member_id,checked_out_at,due_at,checked_in_at,fine_amount,books(title,author)")
      .order("checked_out_at", { ascending: false })
      .limit(100);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.get("/", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const supabase = createSupabaseForReq(req);
    const { data, error } = await supabase
      .from("transactions")
      .select("id,book_id,member_id,checked_out_at,due_at,checked_in_at,fine_amount,books(title,author),users(email)")
      .order("checked_out_at", { ascending: false })
      .limit(200);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

const checkoutSchema = z.object({
  book_id: z.number().int().positive(),
  loan_days: z.number().int().min(1).max(60).optional()
});

router.post("/checkout", requireAuth, requireRole("member"), async (req, res, next) => {
  try {
    const { book_id, loan_days } = checkoutSchema.parse(req.body);
    const supabase = createSupabaseForReq(req);
    const { data, error } = await supabase.rpc("checkout_book", {
      p_book_id: book_id,
      p_member_id: req.user.id,
      p_loan_days: loan_days ?? 14
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
});

const checkinSchema = z.object({
  transaction_id: z.number().int().positive()
});

router.post("/checkin", requireAuth, async (req, res, next) => {
  try {
    const { transaction_id } = checkinSchema.parse(req.body);
    const supabase = createSupabaseForReq(req);
    const { data, error } = await supabase.rpc("checkin_book", {
      p_transaction_id: transaction_id
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
