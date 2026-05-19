const express = require("express");

const VALID_CATEGORIES = new Set(["oils", "skin", "hair"]);

module.exports = function productsRouter({ store, upload, adminGate }) {
  const router = express.Router();

  // Public: list products (active only)
  router.get("/", (req, res) => {
    const category = req.query.category ? String(req.query.category).toLowerCase() : "";
    const includeInactive = String(req.query.includeInactive || "false") === "true";

    const safeCategory = category && VALID_CATEGORIES.has(category) ? category : "";
    const activeOnly = !includeInactive;
    const products = store.listProducts({ category: safeCategory || null, activeOnly });
    res.json({ products });
  });

  router.get("/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const product = store.getActiveProductById(id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ product });
  });

  // Admin: create product
  router.post(
    "/",
    adminGate || ((req, res, next) => next()),
    upload.single("image"),
    (req, res) => {
      const body = req.body || {};
      const category = String(body.category || "").toLowerCase();
      if (!VALID_CATEGORIES.has(category)) return res.status(400).json({ error: "Invalid category" });

      const price = Number(body.price);
      if (!Number.isFinite(price) || price <= 0) return res.status(400).json({ error: "Invalid price" });

      const image_path = req.file ? req.file.filename : body.image_path || null;

      const id = store.createProduct({
        name: body.name,
        category,
        description: body.description,
        price,
        image_path,
      });

      res.status(201).json({ id });
    }
  );

  // Admin: update product
  router.put(
    "/:id",
    adminGate || ((req, res, next) => next()),
    upload.single("image"),
    (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

      const body = req.body || {};
      const category = String(body.category || "").toLowerCase();
      if (body.category && !VALID_CATEGORIES.has(category)) return res.status(400).json({ error: "Invalid category" });

      const price = body.price !== undefined ? Number(body.price) : null;
      if (price !== null && (!Number.isFinite(price) || price <= 0)) return res.status(400).json({ error: "Invalid price" });

      const image_path = req.file ? req.file.filename : body.image_path;

      store.updateProduct(id, {
        name: body.name,
        category: body.category || undefined,
        description: body.description,
        price: price !== null ? price : undefined,
        image_path: image_path,
      });

      res.json({ ok: true });
    }
  );

  // Admin: soft delete (is_active = 0)
  router.delete(
    "/:id",
    adminGate || ((req, res, next) => next()),
    (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
      store.softDeleteProduct(id);
      res.json({ ok: true });
    }
  );

  return router;
};

