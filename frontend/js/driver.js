/* Driver dashboard — vehicle, commission made, online switch, available deliveries. */
(function () {
  const U = window.BizUI, D = window.BizDrv;
  const me = D.me();
  if (!me) return;
  const $ = id => document.getElementById(id);

  $('bd-month').textContent = new Date().toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
  $('dv-name').textContent = me.name;
  $('dv-vehicle').textContent = me.vehicle;
  $('dv-vsub').textContent = me.bike ? 'No number plate needed' : (me.plate ? 'Registered number plate' : 'Add your plate in Profile');
  if (me.plate) { $('dv-plate').textContent = me.plate; $('dv-plate').classList.remove('hidden'); }

  const stat = (l, v, t, cls) => `<div class="bd-stat"><div class="l">${l}</div><div class="v">${v}</div><div class="t ${cls || ''}">${t}</div></div>`;
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  function jobCard(o) {
    const shop = D.shopInfo(o);
    const pickArea = shop.address.split(',').map(x => x.trim()).filter(Boolean).slice(1, 3).join(', ') || shop.address;
    const n = U.esc(o.number);
    return `<article class="bo-card dj-card">
      <div class="od-top"><div><div class="od-num">#${n}</div><div class="od-date">Ready ${U.esc(U.ago((o.times && o.times.ready) || o.placedAt))}</div></div>
        <div class="dj-pay">${U.money(o.payout || 0)}<small>Commission</small></div></div>
      <div class="dj-route">
        <div class="dj-stop"><span class="dj-dot"></span><div><b>Pick up</b>${U.esc(shop.name)}${pickArea ? ' · ' + U.esc(pickArea) : ''}</div></div>
        <div class="dj-stop to"><span class="dj-dot"></span><div><b>Drop off</b>${U.esc(o.dropArea || 'Customer address')}</div></div>
      </div>
      <div class="dj-meta"><span>${o.km} km</span><span>${plural(o.items.reduce((s, i) => s + i.qty, 0), 'item')}</span></div>
      <div class="bo-actions"><button type="button" class="bz-btn primary" data-take="${n}">Accept delivery</button></div>
    </article>`;
  }

  function render() {
    const online = BizOrders.isOnline(me.email);
    const st = D.stats(me.email);
    const active = BizOrders.activeFor(me.email);
    const jobs = BizOrders.openJobs();

    $('dv-online').setAttribute('aria-checked', online ? 'true' : 'false');
    $('dv-online-lbl').textContent = online ? 'Online' : 'Offline';
    $('dv-sub').textContent = online ? 'Online · taking deliveries' : 'Offline · not taking deliveries';

    $('dv-stats').innerHTML =
      stat('Commission today', U.money(st.today), st.todayCount ? '▲ ' + plural(st.todayCount, 'delivery').replace('deliverys', 'deliveries') : 'No deliveries yet', st.todayCount ? 'up' : '') +
      stat('This week', U.money(st.week), plural(st.weekCount, 'delivery').replace('deliverys', 'deliveries')) +
      stat('Deliveries done', st.allCount, st.todayCount + ' today') +
      stat('Total commission', U.money(st.all), 'All time');

    $('dv-chart').innerHTML = `<div class="bd-card-head"><h2>Commission, last 7 days</h2><span class="bd-total">${U.money(st.week)} total</span></div>${D.bars(st.days, st.best)}` +
      (st.week > 0 ? '' : '<div class="bd-chart-note">Commission appears here after each delivery is completed.</div>');

    $('dv-active').innerHTML = active
      ? `<a class="dj-banner" href="driver-active.html"><div><b>Delivery in progress · #${U.esc(active.number)}</b><span>${U.esc(U.PILL[active.state] ? active.state === 'ready' ? 'Head to the shop' : U.PILL[active.state][1] : active.state)} · ${U.money(active.payout || 0)} commission</span></div><em>Continue ›</em></a>`
      : '';

    $('dv-jobcount').textContent = online && !active && jobs.length ? jobs.length + ' open' : '';
    let html;
    if (!online) html = '<div class="bd-quiet"><b>You’re offline</b>Switch to Online above to see deliveries from nearby shops.</div>';
    else if (active) html = '<div class="bd-quiet"><b>Finish your current delivery first</b>New deliveries unlock as soon as this one is marked Delivered.</div>';
    else if (!jobs.length) html = '<div class="bd-quiet"><b>No deliveries right now</b>When a shop finishes packing an order, it shows up here.</div>';
    else html = jobs.map(jobCard).join('');
    $('dv-jobs').innerHTML = html;
    $('bell-dot').classList.toggle('hidden', !(online && !active && jobs.length));
    BizNav.refresh();
  }

  $('dv-online').addEventListener('click', () => {
    const next = !BizOrders.isOnline(me.email);
    BizOrders.setOnline(me.email, next);
    U.toast(next ? 'You’re online — deliveries will show here' : 'You’re offline');
    render();
  });

  $('dv-jobs').addEventListener('click', e => {
    const b = e.target.closest('[data-take]');
    if (!b) return;
    const r = BizOrders.driverAccept(b.dataset.take, me.email);
    if (r.ok) { location.href = 'driver-active.html'; return; }
    U.toast(r.reason || 'Could not take this delivery');
    render();
  });

  // tell the driver when a new delivery appears while they're online
  let seen = new Set(BizOrders.openJobs().map(o => o.number));
  setInterval(() => {
    const now = BizOrders.openJobs();
    if (BizOrders.isOnline(me.email) && !BizOrders.activeFor(me.email)) now.forEach(o => { if (!seen.has(o.number)) U.toast('New delivery · ' + U.money(o.payout || 0)); });
    seen = new Set(now.map(o => o.number));
    render();
  }, 3000);
  window.addEventListener('storage', render);
  render();
})();
