const LOOTBAG_KEY = 'bigogwayne_lootbag_v1';

/* =========================================================
   STORAGE
========================================================= */

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

/* =========================================================
   HELPERS
========================================================= */

function formatMoney(value) {
  return `$${Number(value).toFixed(2)}`;
}

function getCheckoutErrorMessage(data = {}) {
  return data.message || data.error || 'Checkout failed.';
}

function updateCartCount() {
  const cart = getLootBag();

  const count = cart.reduce((sum, item) => {
    return sum + item.quantity;
  }, 0);

  document.querySelectorAll('.cart-dot').forEach(el => {
    el.textContent = count;
  });
}

function getSelectedOptionText(groupLabel) {
  const groups = Array.from(
    document.querySelectorAll('.product-option-group')
  );

  const group = groups.find(g => {
    const label = g.querySelector('.product-option-label');

    return (
      label &&
      label.textContent.trim().toLowerCase() ===
        groupLabel.toLowerCase()
    );
  });

  if (!group) return '';

  const active = group.querySelector('.product-chip.active');

  return active ? active.textContent.trim() : '';
}

function getQtyValue() {
  const qtyEl = document.getElementById('qtyValue');

  return qtyEl
    ? Number(qtyEl.textContent.trim()) || 1
    : 1;
}

/* =========================================================
   DRAWER
========================================================= */

function openLootBag() {
  const drawer = document.getElementById('lootbagDrawer');

  if (!drawer) return;

  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');

  renderLootBag();
}

function closeLootBag() {
  const drawer = document.getElementById('lootbagDrawer');

  if (!drawer) return;

  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
}

/* =========================================================
   CART ACTIONS
========================================================= */

function addCurrentProductToLootBag() {
  const body = document.body;

  const productId = body.dataset.productId;
  const variantId = body.dataset.variantId;
  const name = body.dataset.productName;

  const price = Number(body.dataset.productPrice || 0);

  const image =
    document.getElementById('mainProductImage')?.src || '';

  const collection =
    body.dataset.productCollection || '';

  const color = getSelectedOptionText('Color');
  const size = getSelectedOptionText('Size');

  const quantity = getQtyValue();

  if (!productId || !variantId || !name || !price) {
    console.error('Missing product data');
    return;
  }

  const key = `${variantId}`;

  const cart = getLootBag();

  const existing = cart.find(item => item.key === key);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      key,
      productId,
      variantId,
      name,
      price,
      image,
      collection,
      color,
      size,
      quantity
    });
  }

  saveLootBag(cart);

  renderLootBag();
  updateCartCount();
  openLootBag();

  console.log('UPDATED CART:', cart);
}

function changeLootBagQty(key, delta) {
  const cart = getLootBag();

  const item = cart.find(i => i.key === key);

  if (!item) return;

  item.quantity += delta;

  const updated = cart.filter(i => i.quantity > 0);

  saveLootBag(updated);

  renderLootBag();
}

function removeFromLootBag(key) {
  const updated = getLootBag().filter(
    item => item.key !== key
  );

  saveLootBag(updated);

  renderLootBag();
}

/* =========================================================
   RENDER CART
========================================================= */

function renderLootBag() {
  const cart = getLootBag();

  const itemsEl = document.getElementById('lootbagItems');
  const subtotalEl = document.getElementById('lootbagSubtotal');

  if (!itemsEl || !subtotalEl) return;

  if (!cart.length) {
    itemsEl.innerHTML = `
      <div class="lootbag-empty">
        Your loot bag is empty.
      </div>
    `;

    subtotalEl.textContent = '$0.00';

    updateCartCount();

    return;
  }

  let subtotal = 0;

  itemsEl.innerHTML = cart.map(item => {

    subtotal += item.price * item.quantity;
    const itemMeta = [
      item.color ? `Color: ${item.color}` : '',
      item.size ? `Size: ${item.size}` : ''
    ].filter(Boolean).join('<br>');

    return `
      <div class="lootbag-item">

        <div class="lootbag-item-media">
          <img src="${item.image}" alt="${item.name}">
        </div>

        <div class="lootbag-item-info">

         <div class="lootbag-item-name">${item.name}</div>

          <div class="lootbag-item-meta">
            ${itemMeta}
          </div>

          <div class="lootbag-item-price">${formatMoney(item.price)}</div>

          <div class="lootbag-item-actions">
  <div class="lootbag-qty">
    <button type="button" onclick="changeLootBagQty('${item.key}', -1)">−</button>
    <span>${item.quantity}</span>
    <button type="button" onclick="changeLootBagQty('${item.key}', 1)">+</button>
  </div>

  <button
    class="lootbag-remove"
    type="button"
    onclick="removeFromLootBag('${item.key}')">
    Remove
  </button>
</div>

          </div>
        </div>
      </div>
    `;
  }).join('');

  subtotalEl.textContent = formatMoney(subtotal);

  updateCartCount();
}

/* =========================================================
   CHECKOUT
========================================================= */

async function goToCheckout() {
  const cart = getLootBag();

  if (!cart.length) {
    alert('Your loot bag is empty.');
    return;
  }

  window.location.href = '/checkout.html';
}

/* =========================================================
   INIT
========================================================= */

document.addEventListener('DOMContentLoaded', () => {

  updateCartCount();

  renderLootBag();

  /* Open cart */
  document.querySelectorAll('.cart-btn').forEach(btn => {
    btn.addEventListener('click', openLootBag);
  });

  /* Close cart */
  document
    .getElementById('lootbagClose')
    ?.addEventListener('click', closeLootBag);

  document
    .getElementById('lootbagBackdrop')
    ?.addEventListener('click', closeLootBag);

  /* Add to cart */
  document
    .getElementById('addToLootBagBtn')
    ?.addEventListener('click', addCurrentProductToLootBag);

  /* Checkout */
  document
    .getElementById('lootbagCheckoutBtn')
    ?.addEventListener('click', goToCheckout);

});
