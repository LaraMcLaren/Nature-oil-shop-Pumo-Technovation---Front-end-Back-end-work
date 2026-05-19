const express = require("express");

module.exports = function reportsRouter({ store }) {
  const router = express.Router();

  router.get("/monthly", (req, res) => {
    const now = new Date();
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: "Invalid year" });
    }
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: "Invalid month" });
    }

    const report = store.monthlyReport({ year, month });
    res.json({ report });
  });

  return router;
};

