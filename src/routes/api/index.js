const express = require("express");

const authRoutes = require("./auth");
const categoriesRoutes = require("./categories");
const booksRoutes = require("./books");
const transactionsRoutes = require("./transactions");
const adminRoutes = require("./admin");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/categories", categoriesRoutes);
router.use("/books", booksRoutes);
router.use("/transactions", transactionsRoutes);
router.use("/admin", adminRoutes);

module.exports = router;
