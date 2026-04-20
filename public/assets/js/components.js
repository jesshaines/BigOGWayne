document.addEventListener('DOMContentLoaded', () => {
  const headerTarget = document.getElementById('site-header');
  const lootbagTarget = document.getElementById('site-lootbag');

  if (headerTarget) {
    headerTarget.innerHTML = `
      <header class="header">
        <div class="header-inner">
          <a href="/" class="header-logo" aria-label="Big OG Wayne — Home">
            <img src="assets/images/logo.png" alt="Big OG Wayne — Lilliwaup's Finest">
          </a>

          <nav class="nav" aria-label="Main navigation">
            <a href="/shop" class="nav-link">Shop</a>
            <a href="/collections" class="nav-link">Collections</a>
            <a href="/about" class="nav-link">About</a>
          </nav>

          <div class="header-actions">
            <a href="/order-lookup" class="header-action">Orders</a>
            <button class="cart-btn" type="button" aria-label="Open cart">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="1.75"
                   stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
                <line x1="3" x2="21" y1="6" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
              <span class="cart-dot">0</span>
            </button>

            <button class="hamburger-btn" aria-label="Toggle menu">
              <span></span><span></span><span></span>
            </button>
          </div>
        </div>
      </header>
    `;
  }

  if (lootbagTarget) {
    lootbagTarget.innerHTML = `
      <aside class="lootbag-drawer" id="lootbagDrawer" aria-hidden="true">
        <div class="lootbag-backdrop" id="lootbagBackdrop"></div>

        <div class="lootbag-panel">
          <div class="lootbag-header">
            <h2 class="lootbag-title">Loot Bag</h2>
            <button class="lootbag-close" id="lootbagClose" type="button">✕</button>
          </div>

          <div class="lootbag-body" id="lootbagItems"></div>

          <div class="lootbag-footer">
            <div class="lootbag-total-row">
              <span>Subtotal</span>
              <strong id="lootbagSubtotal">$0.00</strong>
            </div>

            <button class="lootbag-checkout-btn" id="lootbagCheckoutBtn" type="button">
              Checkout
            </button>
          </div>
        </div>
      </aside>
    `;
  }
});