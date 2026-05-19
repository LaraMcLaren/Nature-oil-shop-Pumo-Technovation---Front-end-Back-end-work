function statusMsg(text) {
  const el = document.getElementById("adminStatus");
  if (el) el.textContent = text;
}

function fmtINR(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("en-IN");
}

function safeText(s) {
  return String(s ?? "");
}

async function fetchProductsForAdmin() {
  const res = await fetch("/api/products?includeInactive=true");
  const data = await res.json();
  return data.products || [];
}

function setFormFromProduct(p) {
  document.getElementById("productId").value = String(p.id);
  document.getElementById("pName").value = safeText(p.name);
  document.getElementById("pCategory").value = safeText(p.category);
  document.getElementById("pPrice").value = safeText(p.price);
  document.getElementById("pDesc").value = safeText(p.description);
}

function clearForm() {
  document.getElementById("productId").value = "";
  document.getElementById("pName").value = "";
  document.getElementById("pCategory").value = "oils";
  document.getElementById("pPrice").value = "";
  document.getElementById("pDesc").value = "";
  document.getElementById("pImage").value = "";
}

function renderProductsTable(products) {
  const tbody = document.querySelector("#productsTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  products.forEach((p) => {
    const imageUrl = window.getProductImageUrl ? window.getProductImageUrl(p) : `/images/${encodeURIComponent(p.image_path || "Logo.jpeg")}`;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="width:92px;">
        <img src="${imageUrl}" alt="${p.name}" onerror="this.onerror=null;this.src='/images/Logo.jpeg';" style="width:78px;height:64px;object-fit:contain;border-radius:12px;border:1px solid rgba(47,93,58,.10);" />
      </td>
      <td style="max-width:260px;">
        <div style="font-weight:800;">${safeText(p.name)}</div>
        <div class="muted" style="margin-top:3px;">${p.is_active ? "Active" : "Hidden"}</div>
      </td>
      <td>${safeText(p.category)}</td>
      <td>₹ ${safeText(p.price)}</td>
      <td style="white-space:nowrap;">
        <button class="btn" type="button" data-edit="${p.id}" style="padding:10px 12px; margin-right:6px;">Edit</button>
        <button class="btn btn-ghost" type="button" data-del="${p.id}" style="padding:10px 12px;">Delete</button>
      </td>
    `;

    tr.querySelector(`[data-edit="${p.id}"]`).addEventListener("click", () => {
      setFormFromProduct(p);
      statusMsg("Editing selected product.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    tr.querySelector(`[data-del="${p.id}"]`).addEventListener("click", async () => {
      if (!confirm(`Delete "${p.name}"?`)) return;
      statusMsg("Deleting...");
      const resp = await fetch(`/api/products/${p.id}`, { method: "DELETE" });
      if (!resp.ok) {
        statusMsg("Delete failed.");
        return;
      }
      statusMsg("Deleted. Refreshing products...");
      await initProducts();
      clearForm();
      statusMsg("");
    });

    tbody.appendChild(tr);
  });
}

async function initProducts() {
  const products = await fetchProductsForAdmin();
  renderProductsTable(products);
}

function getFormPayloadFromDom() {
  const productId = document.getElementById("productId").value;
  const name = document.getElementById("pName").value;
  const category = document.getElementById("pCategory").value;
  const price = document.getElementById("pPrice").value;
  const description = document.getElementById("pDesc").value;
  const file = document.getElementById("pImage").files?.[0] || null;
  return { productId, name, category, price, description, file };
}

function validateCreate({ name, category, price, file }) {
  if (!safeText(name)) return "Enter product name.";
  if (!category) return "Choose a category.";
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return "Enter a valid price.";
  if (!file) return "Upload product image.";
  return "";
}

document.addEventListener("DOMContentLoaded", () => {
  const btnCreate = document.getElementById("btnCreate");
  const btnUpdate = document.getElementById("btnUpdate");
  const btnDelete = document.getElementById("btnDelete");

  btnCreate.addEventListener("click", async () => {
    const payload = getFormPayloadFromDom();
    const err = validateCreate(payload);
    if (err) return statusMsg(err);

    statusMsg("Creating product...");
    const form = new FormData();
    form.append("name", payload.name);
    form.append("category", payload.category);
    form.append("price", payload.price);
    form.append("description", payload.description || "");
    form.append("image", payload.file);

    const resp = await fetch("/api/products", { method: "POST", body: form });
    if (!resp.ok) {
      statusMsg("Create failed.");
      return;
    }
    statusMsg("Created. Refreshing...");
    await initProducts();
    clearForm();
    statusMsg("");
  });

  btnUpdate.addEventListener("click", async () => {
    const payload = getFormPayloadFromDom();
    const id = payload.productId;
    if (!id) return statusMsg("Select a product to edit first.");
    if (!safeText(payload.name)) return statusMsg("Enter product name.");
    const p = Number(payload.price);
    if (!Number.isFinite(p) || p <= 0) return statusMsg("Enter a valid price.");

    statusMsg("Updating product...");
    const form = new FormData();
    form.append("name", payload.name);
    form.append("category", payload.category);
    form.append("price", payload.price);
    form.append("description", payload.description || "");
    if (payload.file) form.append("image", payload.file);

    const resp = await fetch(`/api/products/${id}`, { method: "PUT", body: form });
    if (!resp.ok) {
      statusMsg("Update failed.");
      return;
    }
    statusMsg("Updated. Refreshing...");
    await initProducts();
    statusMsg("");
  });

  btnDelete.addEventListener("click", async () => {
    const payload = getFormPayloadFromDom();
    const id = payload.productId;
    if (!id) return statusMsg("Select a product to delete first.");
    const name = payload.name || "this product";
    if (!confirm(`Delete "${name}"?`)) return;

    statusMsg("Deleting...");
    const resp = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!resp.ok) {
      statusMsg("Delete failed.");
      return;
    }
    statusMsg("Deleted. Refreshing...");
    await initProducts();
    clearForm();
    statusMsg("");
  });
});

function populateReportControls() {
  const yearSel = document.getElementById("rYear");
  const monthSel = document.getElementById("rMonth");
  if (!yearSel || !monthSel) return;

  const now = new Date();
  const currentYear = now.getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  yearSel.innerHTML = "";
  years.forEach((y) => {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    yearSel.appendChild(opt);
  });
  yearSel.value = String(currentYear);

  const months = [];
  for (let i = 1; i <= 12; i++) months.push(i);
  monthSel.innerHTML = "";
  months.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = String(m);
    opt.textContent = m < 10 ? `0${m}` : String(m);
    monthSel.appendChild(opt);
  });
  monthSel.value = String(now.getMonth() + 1);
}

function renderBreakdown(report) {
  const box = document.getElementById("breakdownBox");
  if (!box) return;
  const breakdown = report.breakdownByCategory || [];
  if (!breakdown.length) {
    box.textContent = "No data yet.";
    return;
  }

  box.innerHTML = breakdown
    .map(
      (x) =>
        `<div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:8px;">
          <div><strong>${x.category}</strong></div>
          <div class="muted">Qty: ${x.totalQuantity} | Revenue: ₹ ${fmtINR(x.totalRevenue)}</div>
        </div>`
    )
    .join("");
}

async function fetchMonthlyReport() {
  const year = document.getElementById("rYear").value;
  const month = document.getElementById("rMonth").value;

  document.getElementById("repTotalOrders").textContent = "0";
  document.getElementById("repTotalRevenue").textContent = "0";
  document.getElementById("repAvg").textContent = "0";

  const res = await fetch(`/api/reports/monthly?year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`);
  const data = await res.json();
  const report = data.report || {};

  const totalOrders = Number(report.totalOrders || 0);
  const totalRevenue = Number(report.totalRevenue || 0);
  const avg = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  document.getElementById("repTotalOrders").textContent = String(totalOrders);
  document.getElementById("repTotalRevenue").textContent = `₹ ${fmtINR(totalRevenue)}`;
  document.getElementById("repAvg").textContent = `₹ ${fmtINR(avg)}`;

  const tbody = document.querySelector("#ordersTable tbody");
  if (tbody) {
    tbody.innerHTML = "";
    const orders = report.orders || [];
    orders.forEach((o) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${o.id}</td>
        <td class="muted">${new Date(o.order_date).toLocaleString()}</td>
        <td>${safeText(o.customer_name)}</td>
        <td><strong>₹ ${fmtINR(o.total_amount)}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderBreakdown(report);
}

document.addEventListener("DOMContentLoaded", () => {
  populateReportControls();
  document.getElementById("btnFetchReport")?.addEventListener("click", () => {
    fetchMonthlyReport().catch(() => statusMsg("Report fetch failed."));
  });

  initProducts().catch(() => statusMsg("Failed to load products."));
});

