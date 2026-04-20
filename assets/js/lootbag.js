const LOOTBAG_KEY = 'bigogwayne_lootbag_v1';

function getLootBag() {
  try {
    return JSON.parse(localStorage.getItem(LOOTBAG_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLootBag(items) {
  localStorage.setItem(LOOTBAG_KEY, JSON.stringify(items));
}

function formatMoney(value) {
  return `$${Number(value).toFixed(2)}`;
}

function getSelectedOptionText(groupLabel) {
  const groups = Array.from(document.querySelectorAll('.product-option-group'));
  const group = groups.find(g => {
    const label = g.querySelector('.product-option-label');
    return label && label.textContent.trim().toLowerCase() === groupLabel.toLowerCase();
  });

  if (!group) return '';
  const active = group.querySelector('.product-chip.active');
  return active ? active.textContent.trim() : '';
}

function getQtyValue() {
  const qtyEl = document.getElementById('qtyValue');
  return qtyEl ? Number(qtyEl.textContent.trim()) || 1 : 1;
}

function updateCartCount() {
  const cart = getLootBag();
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('.cart-dot').forEach(el => {
    el.textContent = count;
  });
}

function renderLootBag() {
  const itemsEl = document.getElementById('lootbagItems');
  const subtotalEl = document.getElementById('lootbagSubtotal');
  if (!itemsEl || !subtotalEl) return;

  const cart = getLootBag();

  if (!cart.length) {
    itemsEl.innerHTML = `<div class="lootbag-empty">Your loot bag is empty.</div>`;
    subtotalEl.textContent = '$0.00';
    updateCartCount();
    return;
  }

  let subtotal = 0;

  itemsEl.innerHTML = cart.map(item => {
    subtotal += item.price * item.quantity;

    return `
      <div class="lootbag-item">
        <div class="lootbag-item-media">
          <img src="${item.image}" alt="${item.name}">
        </div>
        <div class="lootbag-item-info">
          <div class="lootbag-item-name">${item.name}</div>
          <div class="lootbag-item-meta">
            ${item.collection ? `${item.collection}<br>` : ''}
            ${item.color ? `Color: ${item.color}<br>` : ''}
            ${item.size ? `Size: ${item.size}` : ''}
          </div>
          <div class="lootbag-item-price">${formatMoney(item.price)}</div>
          <div class="lootbag-item-actions">
            <div class="lootbag-qty">
              <button type="button" onclick="changeLootBagQty('${item.key}', -1)">−</button>
              <span>${item.quantity}</span>
              <button type="button" onclick="changeLootBagQty('${item.key}', 1)">+</button>
            </div>
            <button class="lootbag-remove" type="button" onclick="removeFromLootBag('${item.key}')">
              Remove
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  subtotalEl.textContent = formatMoney(subtotal);
  updateCartCount();
}

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

function addCurrentProductToLootBag() {
  const body = document.body;
  const productId = body.dataset.productId;
  const name = body.dataset.productName;
  const price = Number(body.dataset.productPrice || 0);
  const image = body.dataset.productImage || '';
  const url = body.dataset.productUrl || '';
  const collection = body.dataset.productCollection || '';
  const color = getSelectedOptionText('Color');
  const size = getSelectedOptionText('Size');
  const quantity = getQtyValue();

  if (!productId || !name || !price) return;

  const key = `${productId}__${color || 'none'}__${size || 'none'}`;
  const cart = getLootBag();
  const existing = cart.find(item => item.key === key);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      key, productId, name, price, image, url, collection, color, size, quantity
    });
  }

  saveLootBag(cart);
  openLootBag();
}

function changeLootBagQty(key, delta) {
  const cart = getLootBag();
  const item = cart.find(i => i.key === key);
  if (!item) return;
  item.quantity += delta;
  saveLootBag(cart.filter(i => i.quantity > 0));
  renderLootBag();
}

function removeFromLootBag(key) {
  saveLootBag(getLootBag().filter(item => item.key !== key));
  renderLootBag();
}

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    updateCartCount();
    renderLootBag();

    document.querySelectorAll('.cart-btn').forEach(btn => {
      btn.addEventListener('click', openLootBag);
    });

    document.getElementById('lootbagClose')?.addEventListener('click', closeLootBag);
    document.getElementById('lootbagBackdrop')?.addEventListener('click', closeLootBag);
    document.getElementById('addToLootBagBtn')?.addEventListener('click', addCurrentProductToLootBag);
    document.getElementById('lootbagCheckoutBtn')?.addEventListener('click', () => {
      alert('Next step: connect this button to Stripe Checkout.');
    });
  }, 0);
});