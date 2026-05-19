function getCart() {
  try {
    const raw = localStorage.getItem("sv_cart_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && Number.isFinite(Number(x.productId)) && Number.isFinite(Number(x.quantity)))
      .map((x) => ({ productId: Number(x.productId), quantity: Number(x.quantity) }));
  } catch {
    return [];
  }
}

function setCart(cart) {
  localStorage.setItem("sv_cart_v1", JSON.stringify(cart));
}

function cartCount() {
  return getCart().reduce((sum, it) => sum + it.quantity, 0);
}

function upsertCartItem(productId, quantity) {
  const q = Number(quantity);
  if (!Number.isFinite(q) || q <= 0) return;
  const pid = Number(productId);
  const cart = getCart();
  const idx = cart.findIndex((x) => x.productId === pid);
  if (idx >= 0) cart[idx].quantity = q;
  else cart.push({ productId: pid, quantity: q });
  setCart(cart);
}

function addToCart(productId, addQty) {
  const addQ = Number(addQty);
  if (!Number.isFinite(addQ) || addQ <= 0) return;
  const pid = Number(productId);
  const cart = getCart();
  const idx = cart.findIndex((x) => x.productId === pid);
  if (idx >= 0) cart[idx].quantity += addQ;
  else cart.push({ productId: pid, quantity: addQ });
  setCart(cart);
}

function clearCart() {
  localStorage.removeItem("sv_cart_v1");
}

function getFallbackImageByCategory(category) {
  const cat = String(category || "").toLowerCase();
  if (cat === "oils") return "/images/2-3%20bottle.jpeg";
  if (cat === "skin") return "/images/Face%20oil.jpeg";
  if (cat === "hair") return "/images/Hair%20oil.jpeg";
  return "/images/Logo.jpeg";
}

function getProductImageUrl(product) {
  const name = String(product?.image_path || "").trim();
  if (!name) return getFallbackImageByCategory(product?.category);
  return `/images/${encodeURIComponent(name)}`;
}

function renderCartBadge() {
  const el = document.querySelector("[data-cart-count]");
  if (!el) return;
  el.textContent = String(cartCount());
}

function wireMobileNav() {
  const hamburger = document.querySelector("[data-hamburger]");
  const menu = document.querySelector("[data-mobile-menu]");
  if (!hamburger || !menu) return;

  hamburger.addEventListener("click", () => {
    const isOpen = menu.classList.contains("isOpen");
    menu.classList.toggle("isOpen", !isOpen);
  });

  menu.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => menu.classList.remove("isOpen"));
  });
}

function wireFadeIn() {
  const nodes = document.querySelectorAll(".fadeIn");
  if (!nodes.length) return;

  const obs = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.classList.add("isVisible");
      }
    },
    { threshold: 0.12 }
  );

  nodes.forEach((n) => obs.observe(n));
}

document.addEventListener("DOMContentLoaded", () => {
  renderCartBadge();
  wireMobileNav();
  wireFadeIn();
});

window.getProductImageUrl = getProductImageUrl;

