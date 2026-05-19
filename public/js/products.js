const WA_PHONE = "919629655289";

function waLink(productName) {
  const msg =
    "Hi Sri Velva Naturals, I would like to order: " +
    productName +
    ". Please share delivery and payment details.";
  return "https://wa.me/" + WA_PHONE + "?text=" + encodeURIComponent(msg);
}

function renderProductCard(p) {
  const imageUrl = window.getProductImageUrl ? window.getProductImageUrl(p) : `/images/${encodeURIComponent(p.image_path || "Logo.jpeg")}`;
  const card = document.createElement("div");
  card.className = "productCard card fadeIn";
  card.innerHTML = `
    <div class="productImage">
      <img src="${imageUrl}" alt="${p.name}" onerror="this.onerror=null;this.src='/images/Logo.jpeg';" />
    </div>
    <div class="productMeta">
      <h4>${p.name}</h4>
      <div class="price">₹ ${p.price}</div>
    </div>
    <p class="productDesc">${p.description || ""}</p>
    <div class="productActions">
      <button class="btn btn-primary" type="button" data-add="${p.id}">Add to Cart</button>
      <a class="btn btn-gold" href="${waLink(p.name)}" target="_blank" rel="noopener">Order via WhatsApp</a>
    </div>
  `;

  card.querySelector("[data-add]").addEventListener("click", () => {
    addToCart(p.id, 1);
    renderCartBadge();
    const btn = card.querySelector("[data-add]");
    const old = btn.textContent;
    btn.textContent = "Added";
    setTimeout(() => (btn.textContent = old), 1200);
  });

  return card;
}

async function loadProducts(category) {
  const grid = document.getElementById("productsGrid");
  if (!grid) return;
  grid.innerHTML = `<div class="muted">Loading...</div>`;

  try {
    const url = category
      ? `/api/products?category=${encodeURIComponent(category)}`
      : `/api/products`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const products = data.products || [];

    grid.innerHTML = "";
    if (!products.length) {
      grid.innerHTML = `<div class="muted">No products found.</div>`;
      return;
    }

    // Keep order premium: oils/skin/hair naturally grouped by DB seed.
    products.forEach((p) => grid.appendChild(renderProductCard(p)));
  } catch (err) {
    const msg = err && err.message ? err.message : "Unknown error";
    grid.innerHTML = `<div class="muted" style="color:#9B1C1C; font-weight:800;">Failed to load products: ${msg}. Please refresh.</div>`;
    // Help debugging (open browser console)
    console.error("loadProducts failed:", err);
  }
}

function setActiveFilterButtons(activeCategory) {
  const buttons = document.querySelectorAll("[data-filter]");
  buttons.forEach((b) => {
    const cat = b.getAttribute("data-filter");
    b.setAttribute("aria-pressed", String(cat === (activeCategory || "")));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const initialCat = params.get("category") || "";
  if (initialCat) setActiveFilterButtons(initialCat);

  const btns = document.querySelectorAll("[data-filter]");
  btns.forEach((b) => {
    b.addEventListener("click", () => {
      const cat = b.getAttribute("data-filter") || "";
      setActiveFilterButtons(cat);
      loadProducts(cat || "");

      // Update URL for shareable deep link
      const url = new URL(window.location.href);
      if (cat) url.searchParams.set("category", cat);
      else url.searchParams.delete("category");
      window.history.replaceState({}, "", url.toString());
    });
  });

  loadProducts(initialCat || "");
});

