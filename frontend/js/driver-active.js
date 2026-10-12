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

  function render(force) {
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
    const o = BizOrders.activeFor(me.email);
    text = String(text || '').trim();
    if (!o || !text) return;
    BizOrders.addMessage(me.email, o.number, { from: 'driver', text });
    draft = '';
    render(true);
  }

  $('da-body').addEventListener('click', e => {
    const q = e.target.closest('[data-q]');
    if (q) { send(q.dataset.q); return; }
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
