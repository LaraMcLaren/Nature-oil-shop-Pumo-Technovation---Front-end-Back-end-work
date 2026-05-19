const express = require("express");

module.exports = function ordersRouter({ store }) {
  const router = express.Router();

  router.post("/", (req, res) => {
    try {
      const { customerName, phone, address, items } = req.body || {};
      const order = store.createOrder({ customerName, phone, address, items });
      res.status(201).json({ order });
    } catch (err) {
      res.status(400).json({ error: err.message || "Failed to create order" });
    }
  });

  router.get("/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const order = store.getOrderById(id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ order });
  });

  router.get("/:id/invoice", (req, res) => {
    // JSON-first: frontend renders and prints using @media print.
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const order = store.getOrderById(id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ order });
  });

  return router;
};

