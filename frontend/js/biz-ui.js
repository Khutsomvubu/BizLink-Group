/* ============================================================
   BizLink — business-side shared helpers
   (guard, money/time formatting, stats from REAL orders + products,
    order cards, sheets, toast, new-order watcher)
   Needs: session.js, auth.js, products-store.js, orders-store.js
   ============================================================ */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const money = n => 'R' + Number(n).toFixed(2);
  const rand0 = n => 'R' + Math.round(Number(n));
  const sod = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };

  /* An order counts as money once the shop has accepted it, and never if declined / cancelled. */
  const isLive = o => o.state !== 'declined' && o.state !== 'cancelled' && !o.cancelledAt;
  const isSale = o => isLive(o) && o.state !== 'placed' && !o.isDemo;

  const PILL = {
    placed: ['placed', 'New'], accepted: ['accepted', 'Accepted'], preparing: ['preparing', 'Preparing'],
    ready: ['ready', 'Ready'], at_shop: ['ready', 'Driver here'], picked_up: ['out', 'Picked up'],
    on_trip: ['out', 'On the way'], arrived: ['out', 'At customer'], delivered: ['delivered', 'Delivered'],
    declined: ['declined', 'Declined'], cancelled: ['cancelled', 'Cancelled']
  };

  function ago(ts) {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return m + ' min ago';
    const d = new Date(ts);
    const t = d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
    return sod(ts) === sod(Date.now()) ? 'Today, ' + t : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) + ', ' + t;
  }

  /** Guard + the signed-in shop's details. Returns null (and redirects) if not a business. */
  function me() {
    const s = BizSession.requireRole('business');
    if (!s) return null;
    const u = (window.BizAuth && BizAuth.getUser(s.email)) || s;
    const parts = String(u.address || '').split(',').map(x => x.trim()).filter(Boolean);
    return {
      email: s.email,
      name: u.businessName || s.businessName || 'Your shop',
      businessType: u.businessType || s.businessType || 'local-shop',
      area: parts.slice(1, 3).join(', ') || parts[0] || ''
    };
  }

  function driverName(o) {
    if (!o.driverEmail) return '';
    const u = window.BizAuth && BizAuth.getUser(o.driverEmail);
    return (u && u.name) || 'A driver';
  }

  /** Everything the dashboard shows, from real orders and products. */
  function stats(email) {
    const orders = BizOrders.forShop(email);
    const t0 = sod(Date.now());
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(t0); d.setDate(d.getDate() - i);
      days.push({ start: d.getTime(), total: 0, label: i === 0 ? 'Today' : d.toLocaleDateString('en-ZA', { weekday: 'short' }) });
    }
    const first = days[0].start;
    const top = {};
    orders.filter(isSale).forEach(o => {
      const day = days.find(d => d.start === sod(o.placedAt));
      if (!day) return;
      day.total += o.total;
      o.items.forEach(i => {
        const t = top[i.name] = top[i.name] || { name: i.name, qty: 0, revenue: 0 };
        t.qty += i.qty; t.revenue += i.price * i.qty;
      });
    });
    const today = orders.filter(o => isLive(o) && !o.isDemo && sod(o.placedAt) === t0);
    const total7 = days.reduce((s, d) => s + d.total, 0);
    let best = -1;
    days.forEach((d, i) => { if (d.total > 0 && (best < 0 || d.total >= days[best].total)) best = i; });
    const products = BizProducts.byShop(email);
    return {
      days, best, total7,
      salesToday: days[6].total,
      salesYesterday: days[5].total,
      ordersToday: today.length,
      deliveredToday: today.filter(o => o.state === 'delivered').length,
      waiting: orders.filter(o => o.state === 'placed' && !o.cancelledAt),
      top: Object.keys(top).map(k => top[k]).sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 3),
      low: products.filter(p => p.stock <= BizProducts.LOW).sort((a, b) => a.stock - b.stock),
      productCount: products.length,
      since: first
    };
  }

  /* ---------- order card ---------- */
  function orderCard(o, opts) {
    const pill = PILL[o.state] || ['placed', o.state];
    const items = o.items.map(i => `<li><b>${i.qty} ×</b><span>${esc(i.name)}</span></li>`).join('');
    const buyer = o.buyerType === 'business'
      ? 'Local shop: ' + (o.customerName || 'Local shop')
      : (o.customerName || 'Customer');
    const who = [buyer, o.dropArea].filter(Boolean).join(' · ');
    let foot = '';
    const n = esc(o.number);
    if (o.state === 'placed') {
      foot = o.autoPrepare
        ? '<div class="bo-note teal"><div>Automatic order processing: confirmation and preparation are simulated.</div></div>'
        : `<div class="bo-actions">
        <button type="button" class="bz-btn primary" data-act="accept" data-num="${n}">Accept order</button>
        <button type="button" class="bz-btn decline" data-act="decline" data-num="${n}">Decline</button></div>`;
    } else if (o.state === 'accepted') {
      foot = o.autoPrepare
        ? '<div class="bo-note teal"><div>Accepted automatically. Preparation will begin shortly.</div></div>'
        : `<div class="bo-actions"><button type="button" class="bz-btn primary" data-act="prepare" data-num="${n}">Start preparing</button></div>`;
    } else if (o.state === 'preparing') {
      foot = o.autoPrepare
        ? '<div class="bo-note teal"><div>Being prepared automatically. It will soon be ready for pickup.</div></div>'
        : `<div class="bo-actions"><button type="button" class="bz-btn primary" data-act="ready" data-num="${n}">Mark as ready</button></div>`;
    } else if (o.state === 'ready') {
      foot = `<div class="bo-note teal"><svg class="ic"><use href="#i-bike"/></svg><div>${o.driverEmail ? `<b>${esc(driverName(o))}</b> is coming to collect this.` : 'Packed and waiting for a driver to take it.'}</div></div>`;
    } else if (o.state === 'at_shop') {
      const awaitingHandoff = BizOrders.batchAwaitingShop(o.number, o.shopEmail);
      const batch = o.batchId && BizOrders.batchForOrder(o.number);
      const handoffNumber = batch && batch.shopStops[batch.currentShopIndex]
        ? batch.shopStops[batch.currentShopIndex].orderNumbers[0]
        : o.number;
      foot = awaitingHandoff
        ? `<div class="bo-actions"><button type="button" class="bz-btn primary" data-act="handoff" data-batch="${esc(o.batchId)}">Confirm batch handoff to driver</button></div>`
        : o.batchId
          ? `<div class="bo-note teal"><svg class="ic"><use href="#i-bike"/></svg><div>This order is part of a pickup batch. Confirm handoff for this shop’s orders using order #${esc(handoffNumber)}.</div></div>`
        : `<div class="bo-note teal"><svg class="ic"><use href="#i-bike"/></svg><div><b>${esc(driverName(o))}</b> is at your shop. Prepare the order for handoff.</div></div>`;
    } else if (o.state === 'declined') {
      foot = `<div class="bo-note"><svg class="ic"><use href="#i-close"/></svg><div>You declined this order. Stock was put back.</div></div>`;
    } else if (o.state === 'cancelled') {
      foot = `<div class="bo-note"><svg class="ic"><use href="#i-close"/></svg><div>The customer cancelled this order. Stock was put back.</div></div>`;
    }
    return `<article class="bo-card${o.state === 'placed' && opts && opts.fresh ? ' fresh' : ''}" data-card="${n}">
      <div class="od-top">
        <div><div class="od-num">Order #${n}${o.isDemo ? ' · DEMO' : ''}</div><div class="od-date">${esc(ago(o.placedAt))}</div></div>
        <span class="od-pill ${pill[0]}">${esc(pill[1])}</span>
      </div>
      ${o.isDemo ? '<div class="bo-note" role="note"><div><b>DEMO ONLY</b> — simulated customer/order details; do not pack or dispatch as a real sale.</div></div>' : ''}
      <div class="bo-cust"><svg class="ic"><use href="#i-pin"/></svg><span>${esc(who)}</span></div>
      <ul class="bo-items">${items}</ul>
      <div class="bo-total"><span>${o.items.reduce((s, i) => s + i.qty, 0)} item(s)</span><b>${money(o.total)}</b></div>
      ${foot}
    </article>`;
  }

  /** Wire Accept / Decline / Start preparing / Mark ready buttons inside root. */
  function bindActions(root, email, after) {
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b || !root.contains(b)) return;
      const num = b.dataset.num, act = b.dataset.act;
      if (act === 'handoff') {
        toast(BizOrders.confirmShopHandoff(b.dataset.batch, email)
          ? 'Handoff confirmed — the driver can continue'
          : 'This handoff has changed — refreshed');
        after();
        return;
      }
      if (act === 'decline') {
        confirmSheet({
          title: 'Decline order #' + num + '?',
          text: 'The customer will see it as cancelled and the items go back into your stock.',
          yes: 'Decline order', danger: true,
          onYes() { toast(BizOrders.shopDecline(num, email) ? 'Order #' + num + ' declined' : 'This order can no longer be declined'); after(); }
        });
        return;
      }
      const run = { accept: 'shopAccept', prepare: 'shopStartPreparing', ready: 'shopReady' }[act];
      const msg = { accept: 'accepted', prepare: 'is being prepared', ready: 'is ready for a driver' }[act];
      if (!run) return;
      toast(BizOrders[run](num, email) ? 'Order #' + num + ' ' + msg : 'This order has changed — refreshed');
      after();
    });
  }

  /* ---------- toast + sheets ---------- */
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2400);
  }

  function sheet(title, bodyHtml) {
    const wrap = document.createElement('div');
    wrap.className = 'bz-sheet-wrap';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', title);
    wrap.innerHTML = `<div class="bz-sheet"><div class="bz-sheet-grab"></div>
      <div class="bz-sheet-head"><h2>${esc(title)}</h2><button type="button" class="bz-iconbtn" data-x aria-label="Close"><svg class="ic"><use href="#i-close"/></svg></button></div>
      <div data-body>${bodyHtml}</div></div>`;
    (document.querySelector('.screen') || document.body).appendChild(wrap);
    const onKey = e => { if (e.key === 'Escape') close(); };
    function close() { document.removeEventListener('keydown', onKey); wrap.remove(); }
    wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-x]')) close(); });
    document.addEventListener('keydown', onKey);
    return { el: wrap, body: wrap.querySelector('[data-body]'), close };
  }

  function confirmSheet(o) {
    const s = sheet(o.title, `<p style="font-size:13px;color:var(--slate-600);line-height:1.5">${esc(o.text)}</p>
      <div class="bz-sheet-actions"><button type="button" class="bz-btn ghost" data-no>Keep it</button>
      <button type="button" class="bz-btn ${o.danger ? 'danger' : 'primary'}" data-yes>${esc(o.yes)}</button></div>`);
    s.body.querySelector('[data-no]').onclick = s.close;
    s.body.querySelector('[data-yes]').onclick = () => { s.close(); o.onYes(); };
    return s;
  }

  /** Calls onNew(order) when an order arrives for this shop while the page is open. */
  function watchNew(email, onNew) {
    const seen = new Set(BizOrders.forShop(email).map(o => o.number));
    setInterval(() => {
      BizOrders.forShop(email).forEach(o => {
        if (!seen.has(o.number)) { seen.add(o.number); if (o.state === 'placed') onNew(o); }
      });
    }, 3000);
  }

  window.BizUI = { esc, money, rand0, sod, isLive, isSale, PILL, ago, me, stats, orderCard, bindActions, toast, sheet, confirmSheet, watchNew };
})();
