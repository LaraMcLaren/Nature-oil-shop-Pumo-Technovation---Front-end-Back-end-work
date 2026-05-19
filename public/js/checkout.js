function money(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  return `₹ ${num.toLocaleString("en-IN")}`;
}

function lineMoney(unit, qty) {
  return money(Number(unit) * Number(qty));
}

function upsertQuantityInCart(productId, qty) {
  const q = Number(qty);
  const safe = Number.isFinite(q) && q > 0 ? q : 1;
  upsertCartItem(productId, safe);
}

function renderOrderSummary({ productsById, cart }) {
  const empty = document.getElementById("summaryEmpty");
  const box = document.getElementById("summaryBox");
  const itemsEl = document.getElementById("summaryItems");
  const totalEl = document.getElementById("summaryTotal");
  const errorEl = document.getElementById("checkoutError");

  if (!itemsEl || !totalEl || !box) return;
  errorEl && (errorEl.textContent = "");

  if (!cart.length) {
    if (empty) empty.style.display = "block";
    box.style.display = "none";
    itemsEl.innerHTML = "";
    totalEl.textContent = money(0);
    return;
  }

  empty && (empty.style.display = "none");
  box.style.display = "block";
  itemsEl.innerHTML = "";

  let total = 0;
  cart.forEach((it) => {
    const p = productsById[it.productId];
    if (!p) return;
    const imageUrl = window.getProductImageUrl ? window.getProductImageUrl(p) : `/images/${encodeURIComponent(p.image_path || "Logo.jpeg")}`;

    const qty = Number(it.quantity);
    const lineTotal = Number(p.price) * qty;
    total += lineTotal;

    const row = document.createElement("div");
    row.className = "card";
    row.style.padding = "12px";
    row.style.marginBottom = "12px";
    row.innerHTML = `
      <div style="display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap;">
        <img src="${imageUrl}" alt="${p.name}" onerror="this.onerror=null;this.src='/images/Logo.jpeg';" style="width:86px;height:70px;object-fit:contain;border-radius:14px;border:1px solid rgba(47,93,58,.10); background: rgba(247,241,232,.8);" />
        <div style="flex:1; min-width:220px;">
          <div style="font-weight:900;">${p.name}</div>
          <div class="muted" style="margin-top:4px;">Unit: ${money(p.price)}</div>
          <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-top:10px;">
            <div class="muted" style="font-weight:800;">Qty</div>
            <input type="number" min="1" value="${qty}" style="width:110px; padding:10px 12px; border-radius:14px; border:1px solid rgba(47,93,58,.18); background: rgba(255,255,255,.85); outline:none;" data-qty="${p.id}" />
            <div class="muted" style="font-weight:900;">Line: ${money(lineTotal)}</div>
          </div>
        </div>
      </div>
    `;

    row.querySelector(`[data-qty="${p.id}"]`).addEventListener("change", (e) => {
      upsertQuantityInCart(p.id, e.target.value);
      renderSummaryNow();
    });

    itemsEl.appendChild(row);
  });

  totalEl.textContent = money(total);
}

async function renderSummaryNow() {
  const cart = getCart();
  const productsRes = await fetch("/api/products");
  const data = await productsRes.json();
  const products = data.products || [];
  const productsById = {};
  products.forEach((p) => (productsById[p.id] = p));

  renderOrderSummary({ productsById, cart });
}

document.addEventListener("DOMContentLoaded", () => {
  const btnClear = document.getElementById("btnClearCart");
  const btnPlace = document.getElementById("btnPlaceOrder");
  const errorEl = document.getElementById("checkoutError");

  btnClear?.addEventListener("click", () => {
    if (!confirm("Clear cart?")) return;
    clearCart();
    renderSummaryNow().catch(() => {});
    renderCartBadge();
  });

  btnPlace?.addEventListener("click", async () => {
    errorEl && (errorEl.textContent = "");

    const cart = getCart();
    if (!cart.length) {
      errorEl.textContent = "Your cart is empty.";
      return;
    }

    const customerName = document.getElementById("cName").value.trim();
    const phone = document.getElementById("cPhone").value.trim();
    const address = document.getElementById("cAddress").value.trim();

    if (!customerName) {
      errorEl.textContent = "Enter your name.";
      return;
    }
    if (!phone) {
      errorEl.textContent = "Enter your phone number.";
      return;
    }
    if (!address) {
      errorEl.textContent = "Enter your address.";
      return;
    }

    const payload = {
      customerName,
      phone,
      address,
      items: cart.map((x) => ({ productId: x.productId, quantity: x.quantity })),
    };

    btnPlace.disabled = true;
    btnPlace.textContent = "Placing...";

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Order failed");

      const order = data.order;
      clearCart();
      renderCartBadge();
      window.location.href = `confirmation.html?orderId=${encodeURIComponent(order.id)}`;
    } catch (err) {
      errorEl.textContent = err.message || "Order failed. Please try again.";
      btnPlace.disabled = false;
      btnPlace.textContent = "Place Order";
    }
  });

  renderSummaryNow().catch(() => {
    if (errorEl) errorEl.textContent = "Failed to load products for your cart.";
  });
});

