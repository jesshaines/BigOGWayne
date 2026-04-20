const LOOTBAG_KEY = 'bigogwayne_lootbag_v1';

function getLootBag() {
  try {
    return JSON.parse(localStorage.getItem(LOOTBAG_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLootBag(cart) {
  localStorage.setItem(LOOTBAG_KEY, JSON.stringify(cart));
}

function updateCartCount() {
  const cart = getLootBag();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  document.querySelectorAll('.cart-dot').forEach(el => {
    el.textContent = count;
  });
}

function openLootBag() {
  const drawer = document.getElementById('lootbagDrawer');
  if (!drawer) return;
  drawer.classList.add('open');
  renderLootBag();
}

function closeLootBag() {
  const drawer = document.getElementById('lootbagDrawer');
  if (!drawer) return;
  drawer.classList.remove('open');
}

function renderLootBag() {
  const cart = getLootBag();
  const container = document.getElementById('lootbagItems');
  const subtotalEl = document.getElementById('lootbagSubtotal');

  if (!container) return;

  if (!cart.length) {
    container.innerHTML = "<p>Your bag is empty</p>";
    if (subtotalEl) subtotalEl.textContent = "$0.00";
    updateCartCount();
    return;
  }

  let subtotal = 0;

  container.innerHTML = cart.map((item, index) => {
    subtotal += item.price * item.quantity;

    return `
      <div class="lootbag-item">
        <img src="${item.image}" />

        <div class="lootbag-info">
          <div class="lootbag-name">${item.name}</div>
          <div class="lootbag-meta">
            ${item.color ? `Color: ${item.color}<br>` : ''}
            ${item.size ? `Size: ${item.size}` : ''}
          </div>

          <div class="lootbag-controls">
            <button class="qty-minus" data-index="${index}">-</button>
            <span>${item.quantity}</span>
            <button class="qty-plus" data-index="${index}">+</button>
          </div>
        </div>

        <div class="lootbag-price">$${item.price}</div>

        <button class="lootbag-remove" data-index="${index}">✕</button>
      </div>
    `;
  }).join("");

  if (subtotalEl) {
    subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  }

  attachCartEvents();
  updateCartCount();
}
function attachCartEvents() {
  const cart = getLootBag();

  // ➕ Increase qty
  document.querySelectorAll('.qty-plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = btn.dataset.index;
      cart[i].quantity += 1;
      saveLootBag(cart);
      renderLootBag();
    });
  });

  // ➖ Decrease qty
  document.querySelectorAll('.qty-minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = btn.dataset.index;
      cart[i].quantity -= 1;

      if (cart[i].quantity <= 0) {
        cart.splice(i, 1);
      }

      saveLootBag(cart);
      renderLootBag();
    });
  });

  // 🗑 Remove item
  document.querySelectorAll('.lootbag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = btn.dataset.index;
      cart.splice(i, 1);
      saveLootBag(cart);
      renderLootBag();
    });
  });
}

/* 🔥 THIS is what your product page will call */
window.addToCartFromProductPage = function () {
  const body = document.body;

  const productId = body.dataset.productId;
  const name = body.dataset.productName;
  const price = Number(body.dataset.productPrice || 0);

  const image =
    document.getElementById('mainProductImage')?.src ||
    body.dataset.productImage ||
    '';

  const url = body.dataset.productUrl || '';
  const collection = body.dataset.productCollection || '';

  const color =
  document.querySelector('.product-option-group:nth-of-type(1) .product-chip.active')?.textContent || '';

const size =
  document.querySelector('.product-option-group:nth-of-type(2) .product-chip.active')?.textContent || '';

const quantity =
  parseInt(document.getElementById('qtyValue')?.textContent || '1', 10);

  const key = `${productId}__${color || 'none'}__${size || 'none'}`;

  const cart = getLootBag();
  const existing = cart.find(item => item.key === key);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      key,
      productId,
      name,
      price,
      image,
      url,
      collection,
      color,
      size,
      quantity
    });
  }

 saveLootBag(cart);
setTimeout(() => {
  openLootBag();
}, 0);
};

document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();

  document.querySelectorAll('.cart-btn').forEach(btn => {
    btn.addEventListener('click', openLootBag);
  });

  document.getElementById('lootbagClose')?.addEventListener('click', closeLootBag);
  document.getElementById('lootbagBackdrop')?.addEventListener('click', closeLootBag);
});
document.getElementById('lootbagCheckoutBtn')?.addEventListener('click', () => {
  window.location.href = "/checkout.html";
});
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll('.checkout-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = "/checkout.html";
    });
  });
});