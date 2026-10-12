/* Shared bottom-nav helper.
   - Pages with <nav class="bottom-nav" data-role-nav data-active="…"> get the nav
     for the signed-in role (customer / business / driver) drawn for them.
   - Keeps the Cart, Orders and job badges in sync on every page. */
(function () {
  const ic = (n, badge) => `<span class="nav-ic"><svg class="ic"><use href="#i-${n}"/></svg>${badge ? `<span class="nav-badge hidden" ${badge}>0</span>` : ''}</span>`;
  const item = (key, href, icon, label, badge, id) =>
    `<a href="${href}" class="nav-item" data-nav="${key}"${id ? ` id="${id}"` : ''}>${ic(icon, badge)}<span class="nav-lbl">${label}</span></a>`;

  const NAVS = {
    customer: [
      ['home', 'browse.html', 'home', 'Home'],
      ['browse', 'browse.html', 'search', 'Browse'],
      ['orders', 'orders.html', 'orders', 'Orders', 'data-orders-badge'],
      ['cart', 'browse.html#cart', 'cart', 'Cart', 'data-cart-badge', 'nav-cart'],
      ['profile', 'profile.html', 'user', 'Profile']
    ],
    business: [
      ['dashboard', 'business.html', 'home', 'Dashboard'],
      ['orders', 'business-orders.html', 'orders', 'Orders', 'data-shop-badge'],
      ['products', 'business-products.html', 'box', 'Products'],
      ['profile', 'profile.html', 'user', 'Profile']
    ],
    delivery: [
      ['jobs', 'driver.html', 'bike', 'Jobs', 'data-jobs-badge'],
      ['active', 'driver-active.html', 'pin', 'Active', 'data-active-badge'],
      ['earnings', 'driver-earnings.html', 'wallet', 'Earnings'],
      ['profile', 'profile.html', 'user', 'Profile']
    ]
  };

  function session() { try { return JSON.parse(localStorage.getItem('bizlink_session')); } catch (e) { return null; } }
  function role() { const s = session(); return s && NAVS[s.accountType] ? s.accountType : 'customer'; }

  function render() {
    const nav = document.querySelector('nav.bottom-nav[data-role-nav]');
    if (!nav) return;
    const active = nav.dataset.active;
    nav.innerHTML = NAVS[role()].map(i => item(i[0], i[1], i[2], i[3], i[4], i[5])).join('');
    nav.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.nav === active));
  }

  function cartCount() {
    try {
      return (JSON.parse(localStorage.getItem('bizlink_cart')) || []).reduce((s, i) => s + (i.qty || 0), 0);
    } catch (e) { return 0; }
  }
  function activeOrders() {
    try {
      const s = JSON.parse(localStorage.getItem('bizlink_session'));
      return s && s.email && window.BizOrders ? BizOrders.activeCount(s.email) : 0;
    } catch (e) { return 0; }
  }
  function setBadges(selector, n) {
    document.querySelectorAll(selector).forEach(b => {
      b.textContent = n > 99 ? '99+' : n;
      b.classList.toggle('hidden', n === 0);
    });
  }
  function shopNew() {
    const s = session();
    return s && s.accountType === 'business' && window.BizOrders ? BizOrders.forShop(s.email).filter(o => o.state === 'placed' && !o.cancelledAt).length : 0;
  }
  function openJobs() {
    const s = session();
    return s && s.accountType === 'delivery' && window.BizOrders && BizOrders.isOnline(s.email) ? BizOrders.openJobs().length : 0;
  }
  function driverActive() {
    const s = session();
    return s && s.accountType === 'delivery' && window.BizOrders && BizOrders.activeFor(s.email) ? 1 : 0;
  }
  function refresh() {
    setBadges('[data-cart-badge]', cartCount());
    setBadges('[data-orders-badge]', activeOrders());
    setBadges('[data-shop-badge]', shopNew());
    setBadges('[data-jobs-badge]', openJobs());
    setBadges('[data-active-badge]', driverActive());
  }
  window.BizNav = { refresh, render, count: cartCount };
  document.addEventListener('DOMContentLoaded', () => { render(); refresh(); });
  window.addEventListener('storage', refresh);
  setInterval(refresh, 4000);   // orders move through stages while you browse
})();
