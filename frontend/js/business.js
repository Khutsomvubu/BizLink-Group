/* Business dashboard — every number comes from real orders and products. */
(function () {
  const U = window.BizUI;
  const shop = U.me();
  if (!shop) return;
  const $ = id => document.getElementById(id);

  $('bd-shop').textContent = shop.name;
  $('bd-area').textContent = shop.area || 'Add your address in Profile';
  $('bd-month').textContent = new Date().toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
  $('bd-supplier-actions').classList.toggle('hidden', shop.businessType !== 'local-shop');

  function trend(cls, text) { return `<div class="t ${cls}">${text}</div>`; }

  function renderSwitch() {
    const open = BizShops.isOpen(shop.email);
    $('bd-open').setAttribute('aria-checked', open ? 'true' : 'false');
    $('bd-open-lbl').textContent = open ? 'Open' : 'Closed';
    $('bd-closed').classList.toggle('hidden', open);
  }

  function renderStats(s) {
    let sales;
    if (s.salesYesterday > 0) {
      const pct = Math.round(((s.salesToday - s.salesYesterday) / s.salesYesterday) * 100);
      sales = pct > 0 ? trend('up', `▲ ${pct}% vs yesterday`) : pct < 0 ? trend('down', `▼ ${Math.abs(pct)}% vs yesterday`) : trend('', 'Same as yesterday');
    } else {
      sales = s.salesToday > 0 ? trend('up', '▲ First sale today') : trend('', 'No sales yet today');
    }
    const orders = s.ordersToday === 0 ? trend('', 'None yet today')
      : trend(s.deliveredToday ? 'up' : '', `${s.deliveredToday} delivered`);
    const w = s.waiting.length;
    const waiting = trend(w ? 'warn' : '', w ? 'Tap to accept or decline' : 'All caught up');
    const out = s.low.filter(p => p.stock <= 0).length;
    const low = s.low.length === 0 ? trend('up', 'Stock looks good')
      : trend('warn', out ? `${out} sold out` : 'Running low');
    $('bd-stats').innerHTML = `
      <div class="bd-stat"><div class="l">Sales today</div><div class="v">${U.money(s.salesToday)}</div>${sales}</div>
      <div class="bd-stat"><div class="l">Orders today</div><div class="v">${s.ordersToday}</div>${orders}</div>
      <a class="bd-stat${w ? ' attn' : ''}" href="business-orders.html#new"><div class="l">Waiting for you</div><div class="v">${w}</div>${waiting}</a>
      <a class="bd-stat${s.low.length ? ' attn' : ''}" href="business-products.html#low"><div class="l">Low stock</div><div class="v">${s.low.length}</div>${low}</a>`;
    $('bell-dot').classList.toggle('hidden', w === 0);
  }

  function renderChart(s) {
    const max = Math.max.apply(null, s.days.map(d => d.total));
    const MAXPX = 82;
    const cols = s.days.map((d, i) => {
      const h = d.total > 0 ? Math.max(8, Math.round((d.total / max) * MAXPX)) : 4;
      const cls = d.total <= 0 ? 'zero' : i === s.best ? 'best' : '';
      return `<div class="bd-col" title="${U.esc(d.label)}: ${U.money(d.total)}">
        <div class="bd-amt${d.total <= 0 ? ' zero' : ''}">${U.rand0(d.total)}</div>
        <div class="bd-bar ${cls}" style="height:${h}px"></div>
        <div class="bd-day${i === 6 ? ' today' : ''}">${U.esc(d.label)}</div></div>`;
    }).join('');
    $('bd-chart').innerHTML = `
      <div class="bd-card-head"><h2>Sales, last 7 days</h2><span class="bd-total">${U.money(s.total7)} total</span></div>
      <div class="bd-bars">${cols}</div>
      ${s.total7 > 0 ? '' : '<div class="bd-chart-note">Bars fill in as you accept orders. Declined and cancelled orders don’t count.</div>'}`;
  }

  function renderNew(s) {
    const list = s.waiting.slice().sort((a, b) => a.placedAt - b.placedAt);   // oldest first
    $('bd-new-all').classList.toggle('hidden', list.length <= 2);
    $('bd-new').innerHTML = list.length
      ? list.slice(0, 2).map(o => U.orderCard(o, { fresh: true })).join('')
      : '<div class="bd-quiet"><b>No new orders</b>Orders from customers and local shops show up here when they check out.</div>';
  }

  function renderDemo() {
    const active = BizOrders.forShop(shop.email)
      .filter(o => o.isDemo && !['delivered', 'declined', 'cancelled'].includes(o.state))
      .sort((a, b) => b.placedAt - a.placedAt);
    $('bd-demo-section').classList.toggle('hidden', active.length === 0);
    $('bd-demo').innerHTML = active.map(o => U.orderCard(o)).join('');
  }

  function renderTop(s) {
    $('bd-top').innerHTML = s.top.length
      ? '<div class="bd-top">' + s.top.map((t, i) => `<div class="bd-toprow"><span class="bd-rank">${i + 1}</span>
          <div class="n">${U.esc(t.name)}<small>${t.qty} sold · last 7 days</small></div><div class="r">${U.money(t.revenue)}</div></div>`).join('') + '</div>'
      : '<div class="bd-quiet"><b>Nothing sold yet</b>Your best sellers appear here once orders are accepted.</div>';
  }

  function renderAlert(s) {
    if (!s.low.length) { $('bd-alert').innerHTML = ''; return; }
    const rows = s.low.slice(0, 3).map(p => `<li class="${p.stock <= 0 ? 'out' : ''}"><span>${U.esc(p.name)}</span><span>${p.stock <= 0 ? 'Sold out' : p.stock + ' left'}</span></li>`).join('');
    const more = s.low.length > 3 ? ` and ${s.low.length - 3} more` : '';
    $('bd-alert').innerHTML = `<div class="bd-alert"><div class="bd-alert-head"><svg class="ic"><use href="#i-alert"/></svg>${s.low.length} product${s.low.length === 1 ? ' needs' : 's need'} restocking</div>
      <ul>${rows}</ul><a href="business-products.html#low">Update stock${more}</a></div>`;
  }

  function render() {
    const s = U.stats(shop.email);
    renderSwitch(); renderStats(s); renderChart(s); renderNew(s); renderDemo(); renderTop(s); renderAlert(s);
    if (window.BizNav) BizNav.refresh();
  }

  function scheduleDemoCustomerOrder() {
    const dueKey = 'bizlink_demo_order_due_' + shop.email;
    const due = localStorage.getItem(dueKey);
    if (!due || shop.businessType !== 'local-shop') return;
    const token = Number(due);
    if (!Number.isFinite(token)) {
      U.toast('The scheduled demo order has an invalid start time.', 5000);
      localStorage.removeItem(dueKey);
      return;
    }
    setTimeout(() => {
      const session = BizSession.get();
      if (localStorage.getItem(dueKey) !== due || !session || session.email !== shop.email) return;
      const result = BizOrders.createDemoCustomerOrder(shop.email, due);
      if (!result.ok) {
        U.toast(result.reason, 5000);
        return;
      }
      localStorage.removeItem(dueKey);
      U.toast(result.alreadyCreated ? 'The scheduled demo order is already on your dashboard.' : 'A DEMO customer order has arrived.');
      render();
    }, Math.max(0, token - Date.now()));
  }

  $('bd-open').addEventListener('click', () => {
    const next = !BizShops.isOpen(shop.email);
    BizShops.setOpen(shop.email, next);
    U.toast(next ? 'You’re open — customers can order' : 'You’re closed — customers can’t order');
    render();
  });

  U.bindActions($('bd-new'), shop.email, render);
  U.watchNew(shop.email, o => { U.toast((o.isDemo ? 'New DEMO order #' : 'New order #') + o.number); render(); });
  window.addEventListener('storage', render);
  setInterval(render, 5000);
  render();
  scheduleDemoCustomerOrder();
})();
