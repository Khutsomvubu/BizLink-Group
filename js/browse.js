/* browse.html — search, category, filter, sort, favourites + cart (UI lives in the HTML) */
(function () {
  const session = BizSession.get();
  if (!session || !session.email) {
    location.replace('signin.html');
    return;
  }
  let user = (window.BizAuth && BizAuth.getUser(session.email)) || session;
  const isLocalShop = session.accountType === 'business' && user.businessType === 'local-shop';
  if (session.accountType !== 'customer' && !isLocalShop) {
    location.replace(BizSession.homeFor(session.accountType));
    return;
  }

  const $ = id => document.getElementById(id);
  const grid = $('product-grid');
  let cards = [];

  /* ---------- helpers ---------- */
  const money = n => 'R' + Number(n).toFixed(2);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
  }
  function openSheet(id) { $(id).classList.remove('hidden'); }
  function closeSheet(id) { $(id).classList.add('hidden'); }

  /* ---------- storage ---------- */
  const CART_KEY = isLocalShop ? 'bizlink_supplier_cart_' + session.email : 'bizlink_cart';
  const FAV_KEY = 'bizlink_favs_' + session.email;
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let cart = load(CART_KEY, []);
  let favs = load(FAV_KEY, []);

  function visibleProducts() {
    const products = BizProducts.all();
    const matchingProducts = products.filter(p => {
      const seller = window.BizAuth && BizAuth.getUser(p.shopEmail);
      const demoSeller = window.BizAuth && BizAuth.DEMO_SHOPS.find(shop => shop.email === p.shopEmail);
      const sellerType = (seller && seller.businessType) || (demoSeller && demoSeller.businessType);
      return sellerType === (isLocalShop ? 'supplier' : 'local-shop');
    });
    if (!window.BizLocation) return matchingProducts;
    return BizLocation.sortByNearby(matchingProducts, user, product => {
      const seller = window.BizAuth && BizAuth.getUser(product.shopEmail);
      return seller || window.BizAuth.DEMO_SHOPS.find(shop => shop.email === product.shopEmail);
    });
  }

  /* ---------- render the shared product list ---------- */
  function cardHTML(p) {
    const t = BizProducts.tile(p);
    const seller = (window.BizAuth && BizAuth.getUser(p.shopEmail))
      || (window.BizAuth && BizAuth.DEMO_SHOPS.find(shop => shop.email === p.shopEmail))
      || {};
    const open = BizShops.isOpen(p.shopEmail);
    const state = BizProducts.stockState(p);
    const buyable = open && state !== 'out';
    const label = !open ? 'Shop closed' : BizProducts.stockText(p);
    const cls = !open || state === 'out' ? 'out' : state === 'low' ? 'low' : '';
    const rating = p.ratings > 0
      ? `<svg class="ic"><use href="#i-star"/></svg><b>${Number(p.rating).toFixed(1)}</b><span>(${p.ratings})</span>`
      : '<b style="color:#047857">New</b>';
    const nearby = window.BizLocation && BizLocation.areaRank(user.address, seller.address) === 0
        ? 'Same suburb'
        : window.BizLocation && BizLocation.areaRank(user.address, seller.address) === 1
          ? 'Same town'
          : '';
    const visual = p.image
      ? `<div class="bz-media-tile"><img src="media/${esc(p.image)}" alt="${esc(p.name)}" /><button type="button" class="bz-fav" aria-pressed="${favs.includes(p.id) ? 'true' : 'false'}" aria-label="Save ${esc(p.name)}"><svg class="ic"><use href="#i-heart"/></svg></button></div>`
      : `<div class="bz-tile" style="--c1:${esc(t.c1)};--c2:${esc(t.c2)}${buyable ? '' : ';opacity:.55'}">
          <span class="bz-shape ${esc(t.shape)}"></span>
          <span class="bz-brand">${esc(t.brand)}</span>
          <span class="bz-sub">${esc(t.sub)}</span>
          <span class="bz-size">${esc(t.size)}</span>
          <button type="button" class="bz-fav" aria-pressed="${favs.includes(p.id) ? 'true' : 'false'}" aria-label="Save ${esc(p.name)}"><svg class="ic"><use href="#i-heart"/></svg></button>
        </div>`;
    return `
            <article class="bz-card product-card" data-id="${esc(p.id)}" data-name="${esc(p.name)}" data-vendor="${esc(p.vendor)}" data-category="${esc(p.category)}" data-price="${p.price}" data-rating="${p.rating || 0}" data-stock="${buyable ? state : 'out'}">
              ${visual}
              <h3 class="bz-name">${esc(p.name)}</h3>
              <p class="bz-vendor">${esc(p.vendor)}</p>
              ${nearby ? `<p class="bz-nearby">${esc(nearby)}</p>` : ''}
              <div class="bz-rating">${rating}</div>
              <div class="bz-foot">
                <div><div class="bz-price">${money(p.price)}</div><div class="bz-stock ${cls}">${esc(label)}</div></div>
                <button type="button" class="add-cart bz-add"${buyable ? '' : ' disabled'}><svg class="ic"><use href="#i-cart"/></svg><span>${isLocalShop ? 'Order' : 'Add'}</span></button>
              </div>
            </article>`;
  }
  function renderProducts() {
    grid.innerHTML = visibleProducts().map(cardHTML).join('\n');
    cards = Array.from(grid.querySelectorAll('.product-card'));
    cards.forEach((c, i) => { c.dataset.order = i; });
    $('browse-empty-title').textContent = isLocalShop ? 'No supplier products found' : 'No products found';
    $('browse-empty-message').textContent = isLocalShop
      ? 'Suppliers will appear here when they add products.'
      : 'Try a different search or clear your filters.';
    $('browse-title').textContent = isLocalShop ? 'Browse suppliers' : 'Browse products';
    $('browse-tagline').textContent = isLocalShop ? 'Order stock from suppliers.' : 'Local business. Connected.';
    $('browse-nearby-status').textContent = 'Products are sorted by matching suburb and town from saved addresses.';
  }

  /* ---------- filter / sort / search state ---------- */
  const state = { cat: 'All', q: '', sort: 'recommended', inStock: false, minRating: 0, maxPrice: 0 };

  function applyAll() {
    const q = state.q.toLowerCase().trim();
    let shown = 0;
    cards.forEach(card => {
      const d = card.dataset;
      const ok =
        (state.cat === 'All' || d.category === state.cat) &&
        (!q || d.name.toLowerCase().includes(q) || d.vendor.toLowerCase().includes(q)) &&
        (!state.inStock || d.stock !== 'out') &&
        (parseFloat(d.rating) >= state.minRating) &&
        (!state.maxPrice || parseFloat(d.price) < state.maxPrice);
      card.hidden = !ok;
      if (ok) shown++;
    });

    const by = {
      recommended: (a, b) => a.dataset.order - b.dataset.order,
      'price-asc': (a, b) => a.dataset.price - b.dataset.price,
      'price-desc': (a, b) => b.dataset.price - a.dataset.price,
      rating: (a, b) => b.dataset.rating - a.dataset.rating,
      name: (a, b) => a.dataset.name.localeCompare(b.dataset.name)
    }[state.sort];
    cards.slice().sort(by).forEach(c => grid.appendChild(c));

    $('empty-state').classList.toggle('hidden', shown > 0);
    $('filter-btn').classList.toggle('on', state.inStock || state.minRating > 0 || state.maxPrice > 0);
    $('sort-btn').classList.toggle('on', state.sort !== 'recommended');
  }

  /* categories + search */
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.cat = btn.dataset.cat;
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b === btn));
      applyAll();
    });
  });
  $('search-input').addEventListener('input', e => { state.q = e.target.value; applyAll(); });

  /* sheets: generic close */
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeSheet(b.dataset.close)));
  document.querySelectorAll('.bz-sheet-wrap').forEach(w => w.addEventListener('click', e => { if (e.target === w) w.classList.add('hidden'); }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.bz-sheet-wrap').forEach(w => w.classList.add('hidden'));
  });

  /* filter sheet */
  function pickOne(groupId, key) {
    $(groupId).addEventListener('click', e => {
      const b = e.target.closest('.bz-opt');
      if (!b) return;
      $(groupId).querySelectorAll('.bz-opt').forEach(x => x.classList.toggle('active', x === b));
      state[key] = parseFloat(b.dataset.v);
    });
  }
  pickOne('f-rating', 'minRating');
  pickOne('f-price', 'maxPrice');
  $('f-stock').addEventListener('change', e => { state.inStock = e.target.checked; });

  function syncFilterUI() {
    $('f-stock').checked = state.inStock;
    [['f-rating', state.minRating], ['f-price', state.maxPrice]].forEach(([id, val]) => {
      $(id).querySelectorAll('.bz-opt').forEach(o => o.classList.toggle('active', parseFloat(o.dataset.v) === val));
    });
  }
  function resetFilters() {
    state.inStock = false; state.minRating = 0; state.maxPrice = 0;
    syncFilterUI();
  }
  $('filter-btn').addEventListener('click', () => openSheet('filter-sheet'));
  $('f-apply').addEventListener('click', () => { closeSheet('filter-sheet'); applyAll(); });
  $('f-reset').addEventListener('click', () => { resetFilters(); applyAll(); });
  $('clear-filters').addEventListener('click', () => {
    resetFilters();
    state.q = ''; $('search-input').value = '';
    state.cat = 'All';
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === 'All'));
    applyAll();
  });

  /* sort sheet */
  $('sort-btn').addEventListener('click', () => openSheet('sort-sheet'));
  $('sort-list').addEventListener('click', e => {
    const b = e.target.closest('[data-sort]');
    if (!b) return;
    state.sort = b.dataset.sort;
    $('sort-list').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    closeSheet('sort-sheet');
    applyAll();
  });

  /* ---------- favourites ---------- */
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.bz-fav');
    if (!btn) return;
    const id = btn.closest('.product-card').dataset.id;
    const nowOn = !favs.includes(id);
    favs = nowOn ? favs.concat(id) : favs.filter(x => x !== id);
    save(FAV_KEY, favs);
    btn.setAttribute('aria-pressed', nowOn ? 'true' : 'false');
    toast(nowOn ? 'Saved to favourites' : 'Removed from favourites');
  });

  /* ---------- notifications ---------- */
  $('bell-btn').addEventListener('click', () => {
    $('bell-dot').classList.add('hidden');
    const live = BizOrders.list(session.email).find(o => BizOrders.status(o).active);
    toast(live ? 'Order #' + live.number + ': ' + BizOrders.status(live).label : 'No new notifications');
  });

  /* ---------- cart ---------- */
  function cartTotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }

  function renderCart() {
    const list = $('cart-list');
    const empty = !cart.length;
    $('cart-footer').classList.toggle('hidden', empty);
    if (empty) {
      list.innerHTML = `<p style="text-align:center;color:#94a3b8;font-size:13px;padding:24px 0">${isLocalShop ? 'Your supplier cart is empty. Tap Order on a product to start.' : 'Your cart is empty. Tap Add on a product to start.'}</p>`;
      return;
    }
    list.innerHTML = cart.map(i => `
      <div class="bz-cart-item">
        <div><div class="t">${esc(i.name)}</div><div class="s">${money(i.price)} each</div></div>
        <div class="bz-qty">
          <button type="button" data-dec="${esc(i.id)}" aria-label="Remove one">−</button>
          <span>${i.qty}</span>
          <button type="button" data-inc="${esc(i.id)}" aria-label="Add one">+</button>
        </div>
      </div>`).join('');
    $('cart-total').textContent = money(cartTotal());

    const addr = user.address || '';
    const shopsInCart = new Set(cart.map(i => { const p = BizProducts.get(i.id); return p ? p.shopEmail : ''; })).size;
    $('deliver-to').innerHTML = (addr
      ? '<b>Deliver to</b>' + esc(addr)
      : '<b>No delivery address yet</b><a href="profile.html" class="bz-link">Add it on your profile</a>')
      + (shopsInCart > 1 ? '<br><span style="font-size:11px;color:#64748b">Items from ' + shopsInCart + ' shops are sent as ' + shopsInCart + ' separate orders.</span>' : '');
  }

  function cartChanged() {
    save(CART_KEY, cart);
    BizNav.refresh();
    renderProducts();
    applyAll();
  }

  function openCart() { renderCart(); openSheet('cart-panel'); }
  $('header-cart').addEventListener('click', openCart);
  const bottomNav = document.querySelector('nav.bottom-nav');
  if (bottomNav) bottomNav.addEventListener('click', e => {
    const navCart = e.target.closest('#nav-cart');
    if (!navCart) return;
    e.preventDefault();
    openCart();
  });
  $('cart-close').addEventListener('click', () => closeSheet('cart-panel'));

  grid.addEventListener('click', e => {
    const btn = e.target.closest('.add-cart');
    if (!btn || btn.disabled) return;
    const card = btn.closest('.product-card');
    if (card.dataset.stock === 'out') return;
    const id = card.dataset.id;
    const p = BizProducts.get(id);
    const existing = cart.find(i => i.id === id);
    if (p && !BizProducts.available(p, (existing ? existing.qty : 0) + 1)) {
      toast(BizShops.isOpen(p.shopEmail) ? 'No more ' + p.name + ' in stock' : p.vendor + ' is closed right now');
      return;
    }
    if (existing) existing.qty += 1;
    else cart.push({ id, name: card.dataset.name, price: parseFloat(card.dataset.price), qty: 1 });
    cartChanged();
    const label = btn.querySelector('span');
    label.textContent = 'Added';
    btn.classList.add('done');
    setTimeout(() => { label.textContent = isLocalShop ? 'Order' : 'Add'; btn.classList.remove('done'); }, 900);
  });

  $('cart-list').addEventListener('click', e => {
    const inc = e.target.closest('[data-inc]');
    const dec = e.target.closest('[data-dec]');
    if (inc) {
      const item = cart.find(i => i.id === inc.dataset.inc);
      const p = item && BizProducts.get(item.id);
      if (item && p && !BizProducts.available(p, item.qty + 1)) { toast('Only ' + p.stock + ' of ' + p.name + ' in stock'); return; }
      if (item) item.qty += 1;
    } else if (dec) {
      const id = dec.dataset.dec;
      cart = cart.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i).filter(i => i.qty > 0);
    } else return;
    cartChanged();
    renderCart();
  });

  $('checkout-btn').addEventListener('click', () => {
    if (!cart.length) return;
    const user = (window.BizAuth && BizAuth.getUser(session.email)) || session;
    if (!user.address) {
      closeSheet('cart-panel');
      toast('Add your delivery address first');
      setTimeout(() => { location.href = 'profile.html'; }, 1300);
      return;
    }
    const res = BizOrders.createMany(session.email, cart, {
      name: user.name,
      businessName: user.businessName,
      accountType: session.accountType,
      businessType: user.businessType,
      address: user.address,
      phone: user.phone
    });
    if (res.error) {
      toast(res.error);
      renderProducts(); applyAll();
      return;
    }
    cart = [];
    cartChanged();
    closeSheet('cart-panel');
    const first = res.orders[0];
    toast(isLocalShop
      ? (res.orders.length > 1 ? res.orders.length + ' supplier orders placed' : 'Supplier order #' + first.number + ' placed!')
      : (res.orders.length > 1 ? res.orders.length + ' orders placed (one per shop)' : 'Order #' + first.number + ' placed!'));
    const ordersPage = isLocalShop ? 'business-purchases.html' : 'orders.html';
    setTimeout(() => { location.href = ordersPage + '#' + first.number; }, 1000);
  });

  /* ---------- init ---------- */
  renderProducts();
  applyAll();
  // A shop changed stock or opened/closed in another tab → refresh the list.
  window.addEventListener('storage', e => {
    if (e.key === 'bizlink_products' || e.key === 'bizlink_shops') { renderProducts(); applyAll(); }
  });
  BizNav.refresh();
  if (location.hash === '#cart') openCart();
})();
