const fs = require("fs");
const path = require("path");

function fileExists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function rowsFromStatement(stmt) {
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

async function createStore({ SQL, dbFile, migrationsSqlPath, seedSqlPath }) {
  const dbDir = path.dirname(dbFile);
  fs.mkdirSync(dbDir, { recursive: true });

  const migrationsSql = fs.readFileSync(migrationsSqlPath, "utf8");
  const seedSql = fs.readFileSync(seedSqlPath, "utf8");

  // Load existing DB or create new DB.
  const db = fileExists(dbFile)
    ? new SQL.Database(fs.readFileSync(dbFile))
    : new SQL.Database();

  // Ensure schema exists.
  db.run("PRAGMA foreign_keys = ON;");
  db.exec(migrationsSql);

  // Seed only if products is empty.
  const seedCheck = db.exec("SELECT COUNT(*) AS cnt FROM products;");
  const seedCount = seedCheck?.[0]?.values?.[0]?.[0] ?? 0;
  if (seedCount === 0) db.exec(seedSql);

  function persist() {
    const exported = db.export();
    fs.writeFileSync(dbFile, Buffer.from(exported));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function listProducts({ category, activeOnly }) {
    const where = [];
    const params = {};
    if (activeOnly) where.push("is_active = 1");
    if (category) {
      where.push("category = $category");
      params.$category = category;
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const sql = `
      SELECT id, name, category, description, price, image_path, is_active, created_at, updated_at
      FROM products
      ${whereSql}
      ORDER BY id DESC
    `;
    const stmt = db.prepare(sql);
    stmt.bind(params);
    return rowsFromStatement(stmt);
  }

  function createProduct({ name, category, description, price, image_path }) {
    const stmt = db.prepare(`
      INSERT INTO products (name, category, description, price, image_path, is_active, created_at, updated_at)
      VALUES ($name, $category, $description, $price, $image_path, 1, $created_at, $updated_at)
    `);
    stmt.bind({
      $name: name.trim(),
      $category,
      $description: description || "",
      $price: Number(price),
      $image_path: image_path || null,
      $created_at: nowIso(),
      $updated_at: nowIso(),
    });
    stmt.step();
    stmt.free();
    persist();

    const idRes = db.exec("SELECT last_insert_rowid() AS id;");
    return idRes?.[0]?.values?.[0]?.[0];
  }

  function updateProduct(id, { name, category, description, price, image_path }) {
    const stmt = db.prepare(`
      UPDATE products
      SET name = COALESCE($name, name),
          category = COALESCE($category, category),
          description = COALESCE($description, description),
          price = COALESCE($price, price),
          image_path = COALESCE($image_path, image_path),
          updated_at = $updated_at
      WHERE id = $id
    `);
    stmt.bind({
      $id: Number(id),
      $name: name === undefined ? null : String(name).trim(),
      $category: category === undefined ? null : category,
      $description: description === undefined ? null : String(description),
      $price: price === undefined ? null : Number(price),
      $image_path: image_path === undefined ? null : image_path,
      $updated_at: nowIso(),
    });
    stmt.step();
    stmt.free();
    persist();
  }

  function softDeleteProduct(id) {
    const stmt = db.prepare(`
      UPDATE products
      SET is_active = 0,
          updated_at = $updated_at
      WHERE id = $id
    `);
    stmt.bind({ $id: Number(id), $updated_at: nowIso() });
    stmt.step();
    stmt.free();
    persist();
  }

  function getActiveProductById(id) {
    const stmt = db.prepare(`
      SELECT id, name, category, description, price, image_path
      FROM products
      WHERE id = $id AND is_active = 1
      LIMIT 1
    `);
    stmt.bind({ $id: Number(id) });
    const rows = rowsFromStatement(stmt);
    return rows[0] || null;
  }

  function createOrder({ customerName, phone, address, items }) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error("No items in order");
    }

    const safeCustomerName = String(customerName || "").trim();
    const safePhone = String(phone || "").trim();
    const safeAddress = String(address || "").trim();

    if (!safeCustomerName) throw new Error("Name is required");
    if (!safePhone) throw new Error("Phone is required");

    db.run("BEGIN;");
    try {
      const orderItems = [];
      let total = 0;

      for (const it of items) {
        const product = getActiveProductById(it.productId);
        if (!product) throw new Error(`Product not found or inactive: ${it.productId}`);

        const qty = Number(it.quantity);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error("Invalid quantity");

        const lineTotal = product.price * qty;
        total += lineTotal;
        orderItems.push({
          productId: product.id,
          quantity: qty,
          unit_price: product.price,
          line_total: lineTotal,
        });
      }

      const payment_status = "PAID";
      const orderDate = nowIso();
      const stmtOrder = db.prepare(`
        INSERT INTO orders (customer_name, phone, address, total_amount, payment_status, order_date, created_at)
        VALUES ($customer_name, $phone, $address, $total_amount, $payment_status, $order_date, $created_at)
      `);
      stmtOrder.bind({
        $customer_name: safeCustomerName,
        $phone: safePhone,
        $address: safeAddress,
        $total_amount: total,
        $payment_status: payment_status,
        $order_date: orderDate,
        $created_at: orderDate,
      });
      stmtOrder.step();
      stmtOrder.free();

      const idRes = db.exec("SELECT last_insert_rowid() AS id;");
      const orderId = idRes?.[0]?.values?.[0]?.[0];

      const stmtItem = db.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
        VALUES ($order_id, $product_id, $quantity, $unit_price, $line_total)
      `);

      for (const oi of orderItems) {
        stmtItem.bind({
          $order_id: orderId,
          $product_id: oi.productId,
          $quantity: oi.quantity,
          $unit_price: oi.unit_price,
          $line_total: oi.line_total,
        });
        stmtItem.step();
        stmtItem.reset && stmtItem.reset();
      }
      stmtItem.free();

      db.run("COMMIT;");
      persist();

      return getOrderById(orderId);
    } catch (e) {
      db.run("ROLLBACK;");
      throw e;
    }
  }

  function getOrderById(orderId) {
    const stmtOrder = db.prepare(`
      SELECT id, customer_name, phone, address, total_amount, payment_status, order_date
      FROM orders
      WHERE id = $id
      LIMIT 1
    `);
    stmtOrder.bind({ $id: Number(orderId) });
    const orderRows = rowsFromStatement(stmtOrder);
    const order = orderRows[0];
    if (!order) return null;

    const stmtItems = db.prepare(`
      SELECT
        oi.product_id,
        p.name AS product_name,
        p.category,
        p.image_path,
        oi.quantity,
        oi.unit_price,
        oi.line_total
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = $order_id
      ORDER BY oi.id ASC
    `);
    stmtItems.bind({ $order_id: Number(orderId) });
    const items = rowsFromStatement(stmtItems);

    return { ...order, items };
  }

  function monthlyReport({ year, month }) {
    // Expect year: YYYY, month: 01-12
    const y = String(year);
    const m = String(month).padStart(2, "0");

    const totalsStmt = db.prepare(`
      SELECT
        COUNT(*) AS totalOrders,
        COALESCE(SUM(total_amount), 0) AS totalRevenue
      FROM orders
      WHERE strftime('%Y', order_date) = $year
        AND strftime('%m', order_date) = $month
    `);
    totalsStmt.bind({ $year: y, $month: m });
    const totalsRows = rowsFromStatement(totalsStmt);
    const totals = totalsRows[0] || { totalOrders: 0, totalRevenue: 0 };

    const ordersStmt = db.prepare(`
      SELECT id, customer_name, phone, address, total_amount, payment_status, order_date
      FROM orders
      WHERE strftime('%Y', order_date) = $year
        AND strftime('%m', order_date) = $month
      ORDER BY order_date DESC
    `);
    ordersStmt.bind({ $year: y, $month: m });
    const orders = rowsFromStatement(ordersStmt);

    const categoryStmt = db.prepare(`
      SELECT
        p.category AS category,
        COALESCE(SUM(oi.quantity), 0) AS totalQuantity,
        COALESCE(SUM(oi.line_total), 0) AS totalRevenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE strftime('%Y', o.order_date) = $year
        AND strftime('%m', o.order_date) = $month
      GROUP BY p.category
      ORDER BY totalRevenue DESC
    `);
    categoryStmt.bind({ $year: y, $month: m });
    const breakdownByCategory = rowsFromStatement(categoryStmt);

    const topProductsStmt = db.prepare(`
      SELECT
        p.id AS productId,
        p.name AS productName,
        p.category AS category,
        COALESCE(SUM(oi.quantity), 0) AS totalQuantity,
        COALESCE(SUM(oi.line_total), 0) AS totalRevenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      WHERE strftime('%Y', o.order_date) = $year
        AND strftime('%m', o.order_date) = $month
      GROUP BY oi.product_id
      ORDER BY totalRevenue DESC
      LIMIT 8
    `);
    topProductsStmt.bind({ $year: y, $month: m });
    const topProducts = rowsFromStatement(topProductsStmt);

    return {
      year: Number(y),
      month: Number(m),
      totalOrders: Number(totals.totalOrders || 0),
      totalRevenue: Number(totals.totalRevenue || 0),
      breakdownByCategory,
      topProducts,
      orders,
    };
  }

  return {
    listProducts,
    createProduct,
    updateProduct,
    softDeleteProduct,
    createOrder,
    getActiveProductById,
    getOrderById,
    monthlyReport,
  };
}

module.exports = { createStore };

