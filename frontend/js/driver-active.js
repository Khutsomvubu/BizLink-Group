/* Active delivery — one job at a time, one big button per step, chat with the customer. */
(function () {
  const U = window.BizUI, D = window.BizDrv;
  const me = D.me();
  if (!me) return;
  const $ = id => document.getElementById(id);
  const STEPS = [
    ['ready', 'Head to the shop'], ['at_shop', 'At the shop'], ['picked_up', 'Order picked up'],
    ['on_trip', 'On the way to the customer'], ['arrived', 'Arrived at the customer'], ['delivered', 'Delivered']
  ];
  const QUICK = ['I’m at the shop', 'I’m on my way', 'I’ve arrived', 'Please come to the gate'];
  let draft = '', lastSig = '';

  const clock = ts => new Date(ts).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
  const callBtn = (label, phone) => phone
    ? `<a class="dr-btn" href="tel:${U.esc(String(phone).replace(/\s/g, ''))}">${'<svg class="ic ic-sm"><use href="#i-phone"/></svg>'}${label}</a>` : '';

  function timeline(state) {
    const idx = STEPS.findIndex(s => s[0] === state);
    return '<ol class="od-timeline da-timeline">' + STEPS.map((s, i) => {
      const cls = i < idx || state === 'delivered' ? 'done' : i === idx ? 'current' : '';
      return `<li class="od-step ${cls}"><span class="od-dot"><svg class="ic"><use href="#i-check"/></svg></span><div><div class="od-step-t" style="font-size:13px;font-weight:${cls ? 800 : 600};color:${cls ? 'var(--slate-900)' : 'var(--slate-400)'}">${U.esc(s[1])}</div></div></li>`;
    }).join('') + '</ol>';
  }

  function chat(o) {
    const msgs = (o.messages || []).map(m => `<div class="ch-msg ${m.from === 'driver' ? 'me' : 'driver'}">${U.esc(m.text)}<small>${clock(m.at)}</small></div>`).join('');
    return `<div class="da-card"><h2>Message ${U.esc((o.customerName || 'customer').split(' ')[0])}</h2>
      <div class="dc-log" id="dc-log">${msgs || '<div class="sub" style="font-size:12px;color:var(--slate-500)">No messages yet.</div>'}</div>
      <div class="dc-quick">${QUICK.map(q => `<button type="button" data-q="${U.esc(q)}">${U.esc(q)}</button>`).join('')}</div>
      <form class="dc-form" id="dc-form"><input id="dc-input" maxlength="300" placeholder="Type a message" autocomplete="off" value="${U.esc(draft)}"><button type="submit" class="bz-btn primary">Send</button></form></div>`;
  }

  function renderBatch(batch, force) {
    const orders = BizOrders.batchOrders(batch);
    if (!orders.length) return;
    const sig = batch.id + batch.status + batch.currentShopIndex + batch.currentDeliveryIndex
      + orders.map(order => order.state + (order.messages || []).length).join(',');
    if (!force && sig === lastSig) return;
    lastSig = sig;
    const input = $('dc-input'); if (input) draft = input.value;
    const shops = batch.shopStops.map((stop, index) => {
      const stopOrders = stop.orderNumbers.map(number => orders.find(order => order.number === number)).filter(Boolean);
      const complete = index < batch.currentShopIndex;
      const current = index === batch.currentShopIndex;
      const status = complete ? 'Handoff confirmed' : current
        ? batch.status === 'awaiting_shop' ? 'Waiting for shop to confirm handoff' : 'Current pickup stop'
        : 'Upcoming pickup';
      const list = stopOrders.flatMap(order => order.items.map(item =>
        `<li><b>${item.qty} ×</b><span>${U.esc(item.name)} · Order #${U.esc(order.number)}</span></li>`)).join('');
      return `<div class="da-card${current ? '' : ' dim'}"><h2>Pickup ${index + 1} of ${batch.shopStops.length} · ${U.esc(stop.name)}</h2>
        ${stopOrders.some(order => order.isDemo) ? '<div class="bo-note" role="note"><div><b>DEMO ONLY</b> — simulated order; do not collect as a real delivery.</div></div>' : ''}
        <div class="who">${U.esc(stop.address || 'Address not added')}</div><div class="sub">${U.esc(status)}</div>
        <ul class="bo-items" style="margin-top:8px">${list}</ul>${current && stop.phone ? `<div class="dr-actions">${callBtn('Call shop', stop.phone)}</div>` : ''}</div>`;
    }).join('');
    const isPickup = batch.status === 'to_shop';
    const isHandoff = batch.status === 'awaiting_shop';
    const currentDrop = batch.status === 'delivering' ? orders[batch.currentDeliveryIndex] : null;
    const demoOnly = orders.every(order => order.isDemo);
    const mixedDemo = !demoOnly && orders.some(order => order.isDemo);
    const dropoffs = orders.map((order, index) => {
      const complete = order.state === 'delivered';
      const current = currentDrop && order.number === currentDrop.number;
      return `<div class="da-card${current ? '' : ' dim'}"><h2>Drop-off ${index + 1} of ${orders.length} · #${U.esc(order.number)}</h2>
        ${order.isDemo ? '<div class="bo-note" role="note"><div><b>DEMO ONLY</b> — customer and address are simulated. Do not confirm a real drop-off.</div></div>' : ''}
        <div class="who">${U.esc(order.customerName || 'Customer')}</div><div class="sub">${U.esc(order.address || 'Address not added')}</div>
        <div class="sub">${complete ? 'Drop-off confirmed by driver' : current ? 'Current delivery · driver confirmation required' : 'Waiting for previous drop-off'}</div>
        <ul class="bo-items" style="margin-top:8px">${order.items.map(item => `<li><b>${item.qty} ×</b><span>${U.esc(item.name)}</span></li>`).join('')}</ul>
        ${current && order.phone ? `<div class="dr-actions">${callBtn('Call customer', order.phone)}</div>` : ''}
        ${current ? `<button type="button" class="bz-btn primary da-go" data-confirm-drop="${U.esc(order.number)}">Confirm customer drop-off</button>` : ''}</div>`;
    }).join('');
    $('da-pill').textContent = batch.status === 'delivering' ? 'Delivering batch' : isHandoff ? 'Shop handoff' : 'Pickup batch';
    $('da-pill').className = 'od-pill ' + (batch.status === 'delivering' ? 'out' : 'ready');
    $('da-body').innerHTML = `
      <div class="da-hero"><div><div class="l">${demoOnly ? 'DEMO · no commission' : mixedDemo ? 'Commission · DEMO excluded' : 'Batch commission'}</div><div class="v">${U.money(orders.reduce((sum, order) => sum + (order.isDemo ? 0 : order.payout || 0), 0))}</div></div>
        <div class="r">Batch <b>${U.esc(batch.id)}</b><br>${orders.length} orders · max ${BizOrders.MAX_BATCH_SIZE}</div></div>
      <div class="da-card"><h2>Pickup route</h2><div class="sub">${batch.shopStops.length} shop stop${batch.shopStops.length === 1 ? '' : 's'}</div></div>
      ${shops}
      ${isPickup ? `<button type="button" class="bz-btn primary da-go" id="da-batch-go">Confirm arrival at pickup</button>` : ''}
      ${isHandoff ? '<div class="da-hint">The shop must confirm the handoff before you can continue.</div>' : ''}
      <div class="da-card"><h2>Customer drop-offs</h2><div class="sub">${orders.length} customer drop-off${orders.length === 1 ? '' : 's'} · driver confirms each handoff separately</div></div>
      ${dropoffs}
      ${currentDrop ? chat(currentDrop) : ''}`;
    const log = $('dc-log'); if (log) log.scrollTop = log.scrollHeight;
    BizNav.refresh();
  }

  function render(force) {
    const batch = BizOrders.activeBatchFor(me.email);
    if (batch) {
      renderBatch(batch, force);
      return;
    }
    const o = BizOrders.activeFor(me.email);
    const pill = $('da-pill');
    if (!o) {
      pill.classList.add('hidden');
      $('da-body').innerHTML = `<div class="od-empty"><div class="od-empty-ic"><svg class="ic"><use href="#i-pin"/></svg></div><b>No active delivery</b>
        <p>Accept a delivery from your dashboard and it will show here.</p><a href="driver.html#jobs" class="bz-btn primary od-empty-btn">See available deliveries</a></div>`;
      lastSig = ''; BizNav.refresh(); return;
    }
    const sig = o.number + o.state + (o.messages || []).length;
    if (!force && sig === lastSig) return;       // don't redraw (and lose typing) when nothing changed
    lastSig = sig;
    const input = $('dc-input'); if (input) draft = input.value;

    const shop = D.shopInfo(o), next = BizOrders.driverNext(o);
    pill.textContent = (U.PILL[o.state] || [0, o.state])[1]; pill.className = 'od-pill ' + ((U.PILL[o.state] || ['placed'])[0]); 
    const early = o.state === 'ready' || o.state === 'at_shop';
    const hint = o.state === 'ready' && o.shopEtaAt ? 'Reach the shop by ' + clock(o.shopEtaAt)
      : o.state === 'at_shop' ? 'Check the items, then confirm pickup.' : o.state === 'arrived' ? 'Hand over the order, then confirm.' : '';
    $('da-body').innerHTML = `
      <div class="da-hero"><div><div class="l">Your commission</div><div class="v">${U.money(o.payout || 0)}</div></div>
        <div class="r">Order <b>#${U.esc(o.number)}</b><br>${o.km} km · ${o.items.reduce((s, i) => s + i.qty, 0)} item(s)</div></div>
      ${next ? `<button type="button" class="bz-btn primary da-go" id="da-go">${U.esc(next.label)}</button><div class="da-hint">${U.esc(hint)}</div>` : ''}
      <div class="da-card${early ? '' : ' dim'}"><h2>Pick up</h2><div class="who">${U.esc(shop.name)}</div>
        <div class="sub">${U.esc(shop.address || 'Address not added')}</div>
        <div class="dr-actions">${callBtn('Call shop', shop.phone)}</div></div>
      <div class="da-card${early ? ' dim' : ''}"><h2>Drop off</h2><div class="who">${U.esc(o.customerName || 'Customer')}</div>
        <div class="sub">${U.esc(o.address || o.dropArea || 'Address not added')}</div>
        <div class="dr-actions">${callBtn('Call customer', o.phone)}</div></div>
      <div class="da-card"><h2>Items to collect</h2><ul class="bo-items" style="margin-top:0">${o.items.map(i => `<li><b>${i.qty} ×</b><span>${U.esc(i.name)}</span></li>`).join('')}</ul></div>
      <div class="da-card"><h2>Progress</h2>${timeline(o.state)}</div>
      ${chat(o)}`;
    const log = $('dc-log'); if (log) log.scrollTop = log.scrollHeight;
    BizNav.refresh();
  }

  function send(text) {
    const batch = BizOrders.activeBatchFor(me.email);
    const orders = batch ? BizOrders.batchOrders(batch) : [];
    const o = batch && batch.status === 'delivering'
      ? orders[batch.currentDeliveryIndex]
      : batch ? null : BizOrders.activeFor(me.email);
    text = String(text || '').trim();
    if (!o || !text) return;
    BizOrders.addMessage(me.email, o.number, { from: 'driver', text });
    draft = '';
    render(true);
  }

  $('da-body').addEventListener('click', e => {
    const q = e.target.closest('[data-q]');
    if (q) { send(q.dataset.q); return; }
    const batch = BizOrders.activeBatchFor(me.email);
    if (batch && e.target.closest('#da-batch-go')) {
      const result = BizOrders.markBatchArrived(batch.id, me.email);
      if (!result.ok) U.toast(result.reason || 'This pickup has changed');
      render(true);
      return;
    }
    const delivered = e.target.closest('[data-confirm-drop]');
    if (batch && delivered) {
      const number = delivered.dataset.confirmDrop;
      const order = BizOrders.find(me.email, number);
      const completed = BizOrders.confirmBatchDelivery(batch.id, number, me.email);
      if (!completed) { U.toast('This delivery has changed — refreshed'); render(true); return; }
      render(true);
      U.toast('Order #' + number + ' delivery confirmed' + (order ? ' · ' + U.money(order.payout || 0) + ' commission added' : ''));
      return;
    }
    if (!e.target.closest('#da-go')) return;
    const o = BizOrders.activeFor(me.email);
    if (!o) return;
    const earned = o.payout || 0, num = o.number;
    const r = BizOrders.driverAdvance(num, me.email);
    if (!r.ok) { U.toast('This delivery has changed — refreshed'); render(true); return; }
    if (r.state === 'delivered') {
      render(true);
      const s = U.sheet('Delivery complete', `<div style="text-align:center;padding:6px 0 4px"><div class="od-empty-ic" style="margin:0 auto 10px;background:#d1fae5;color:#065f46"><svg class="ic"><use href="#i-check"/></svg></div>
        <div style="font-size:13px;color:var(--slate-600)">Order #${U.esc(num)} delivered</div>
        <div style="font-family:var(--font-display);font-weight:800;font-size:30px;margin:4px 0 2px">${U.money(earned)}</div>
        <div style="font-size:12px;color:var(--slate-500)">commission added to your earnings</div></div>
        <div class="bz-sheet-actions"><a class="bz-btn ghost od-empty-btn" style="margin:0;flex:1;text-decoration:none;text-align:center" href="driver-earnings.html">View earnings</a>
        <a class="bz-btn primary od-empty-btn" style="margin:0;flex:1;text-decoration:none;text-align:center" href="driver.html#jobs">More deliveries</a></div>`);
      return;
    }
    U.toast('Updated: ' + (STEPS.find(s => s[0] === r.state) || [0, r.state])[1]);
    render(true);
  });
  $('da-body').addEventListener('submit', e => { e.preventDefault(); send($('dc-input').value); });

  setInterval(() => render(false), 2500);
  window.addEventListener('storage', () => render(false));
  render(true);
})();
