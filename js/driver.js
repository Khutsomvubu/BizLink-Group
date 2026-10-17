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

  function jobCard(batch) {
    const orders = batch.orders;
    const stops = Array.from(new Map(orders.map(order => {
      const shop = D.shopInfo(order);
      return [order.shopEmail, shop];
    })).values());
    const first = orders[0];
    const demoOnly = orders.every(order => order.isDemo);
    const mixedDemo = !demoOnly && orders.some(order => order.isDemo);
    const n = U.esc(batch.orderNumbers.join(','));
    const itemCount = orders.reduce((sum, order) => sum + order.items.reduce((count, item) => count + item.qty, 0), 0);
    return `<article class="bo-card dj-card">
      <div class="od-top"><div><div class="od-num">Delivery batch · ${orders.length} order${orders.length === 1 ? '' : 's'}${orders.some(order => order.isDemo) ? ' · DEMO' : ''}</div><div class="od-date">Ready ${U.esc(U.ago((first.times && first.times.ready) || first.placedAt))}</div></div>
        <div class="dj-pay">${U.money(batch.payout)}<small>${demoOnly ? 'DEMO · no commission' : mixedDemo ? 'DEMO excluded from payout' : 'Batch commission'}</small></div></div>
      ${orders.some(order => order.isDemo) ? '<div class="bo-note" role="note"><div><b>DEMO ONLY</b> — simulated orders and false delivery details; do not collect or confirm a real delivery.</div></div>' : ''}
      <div class="dj-route">
        ${stops.map((shop, index) => {
          const pickArea = shop.address.split(',').map(x => x.trim()).filter(Boolean).slice(1, 3).join(', ') || shop.address;
          return `<div class="dj-stop"><span class="dj-dot"></span><div><b>Pick up ${index + 1}</b>${U.esc(shop.name)}${pickArea ? ' · ' + U.esc(pickArea) : ''}</div></div>`;
        }).join('')}
        <div class="dj-stop to"><span class="dj-dot"></span><div><b>Drop off</b>${U.esc(batch.destinationArea || first.dropArea || 'Nearby customer addresses')}</div></div>
      </div>
      <div class="dj-meta"><span>${stops.length} pickup stop${stops.length === 1 ? '' : 's'}</span><span>${plural(itemCount, 'item')}</span></div>
      <div class="bo-actions"><button type="button" class="bz-btn primary" data-take-batch="${n}">Accept batch</button></div>
    </article>`;
  }

  function render() {
    const online = BizOrders.isOnline(me.email);
    const st = D.stats(me.email);
    const active = BizOrders.activeFor(me.email);
    const activeBatch = BizOrders.activeBatchFor(me.email);
    const activeBatchOrders = activeBatch ? BizOrders.batchOrders(activeBatch) : [];
    const jobs = BizOrders.availableBatches(me.email);

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
      ? `<a class="dj-banner" href="driver-active.html"><div><b>${activeBatch ? 'Batch in progress · ' + activeBatch.orderNumbers.length + ' orders' : 'Delivery in progress · #' + U.esc(active.number)}</b><span>${activeBatch ? (activeBatch.status === 'awaiting_shop' ? 'Waiting for shop handoff' : activeBatch.status === 'delivering' ? 'Confirming customer handoffs' : 'Picking up from shops') + ' · ' + U.money(activeBatchOrders.reduce((sum, order) => sum + (order.payout || 0), 0)) + (activeBatchOrders.every(order => order.isDemo) ? ' · DEMO, no commission' : activeBatchOrders.some(order => order.isDemo) ? ' · DEMO excluded' : ' commission') : U.esc(U.PILL[active.state] ? active.state === 'ready' ? 'Head to the shop' : U.PILL[active.state][1] : active.state) + ' · ' + U.money(active.payout || 0) + (active.isDemo ? ' · DEMO, no commission' : ' commission')}</span></div><em>Continue ›</em></a>`
      : '';

    $('dv-jobcount').textContent = online && !active && jobs.length ? jobs.length + ' open' : '';
    let html;
    if (!online) html = '<div class="bd-quiet"><b>You’re offline</b>Switch to Online above to see deliveries from nearby shops.</div>';
    else if (active) html = '<div class="bd-quiet"><b>Finish your current delivery first</b>New deliveries unlock as soon as this one is marked Delivered.</div>';
    else if (!jobs.length) html = '<div class="bd-quiet"><b>No delivery batches right now</b>When nearby orders are ready for pickup, they’ll show here grouped by destination.</div>';
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
    const b = e.target.closest('[data-take-batch]');
    if (!b) return;
    const r = BizOrders.acceptBatch(b.dataset.takeBatch.split(','), me.email);
    if (r.ok) { location.href = 'driver-active.html'; return; }
    U.toast(r.reason || 'Could not take this delivery');
    render();
  });

  // tell the driver when a new delivery appears while they're online
  let seen = new Set(BizOrders.availableBatches(me.email).map(batch => batch.orderNumbers.join(',')));
  setInterval(() => {
    const now = BizOrders.availableBatches(me.email);
    if (BizOrders.isOnline(me.email) && !BizOrders.activeFor(me.email)) now.forEach(batch => {
      if (!seen.has(batch.orderNumbers.join(','))) U.toast((batch.orders.some(order => order.isDemo) ? 'New DEMO delivery batch · ' : 'New delivery batch · ') + U.money(batch.payout));
    });
    seen = new Set(now.map(batch => batch.orderNumbers.join(',')));
    render();
  }, 3000);
  window.addEventListener('storage', render);
  render();
})();
