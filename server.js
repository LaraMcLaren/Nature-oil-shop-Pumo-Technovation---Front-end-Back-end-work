const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const initSqlJs = require("sql.js");
const { createStore } = require("./db/store");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const DB_FILE = path.join(__dirname, "db", "app.sqlite");

const app = express();

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

// Static frontend
app.use(express.static(path.join(__dirname, "public")));
// Serve provided product images (and any future uploads) from the existing Images folder
app.use("/images", express.static(path.join(__dirname, "Images")));

// Healthcheck
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Multer for admin product image uploads (stored in the existing Images folder)
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, path.join(__dirname, "Images"));
  },
  filename: function (_req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const base = path.basename(file.originalname || "upload", ext).replace(/[^a-z0-9\-_ ]/gi, "");
    const safeBase = base.trim().replace(/\s+/g, " ");
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  },
});
const upload = multer({ storage });

function makeAdminGate() {
  // Optional basic gate. If ADMIN_TOKEN is set, requests must provide ?token=... or header x-admin-token.
  // For initial setup, leaving ADMIN_TOKEN unset keeps it open (admin.html still exists).
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return null;
  return function gate(req, res, next) {
    const token = req.query.token || req.headers["x-admin-token"];
    if (token !== adminToken) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}
const adminGate = makeAdminGate();

async function start() {
  // Initialize sql.js (pure JS; no Visual Studio required)
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, "node_modules", "sql.js", "dist", file),
  });

  const store = await createStore({
    SQL,
    dbFile: DB_FILE,
    migrationsSqlPath: path.join(__dirname, "db", "migrations.sql"),
    seedSqlPath: path.join(__dirname, "db", "seed.sql"),
  });

  // Attach API routers
  const productsRouter = require("./routes/products");
  const ordersRouter = require("./routes/orders");
  const reportsRouter = require("./routes/reports");

  app.use(
    "/api/products",
    productsRouter({ store, upload, adminGate })
  );
  app.use(
    "/api/orders",
    ordersRouter({ store })
  );
  app.use(
    "/api/reports",
    reportsRouter({ store })
  );

  app.listen(PORT, () => {
    console.log(`Sri Velva server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});

