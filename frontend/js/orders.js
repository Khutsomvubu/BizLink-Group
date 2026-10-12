/* orders.html — orders list, live tracking, driver call/chat, and complaints */
(function () {
  const session = BizSession.requireRole('customer');
  if (!session) return;

  const $ = id => document.getElementById(id);
  const money = n => 'R' + Number(n).toFixed(2);
  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const email = session.email;
  const ICON = n => `<svg class="ic"><use href="#i-${n}"/></svg>`;

  let tab = 'active';
  let openNumber = null;       // order shown in the tracking sheet
  let confirmCancel = false;   // two-step cancel
  let confirmTimer;
  let lastSig = '';
  const lastStatus = {};       // number → status key
  const announced = {};        // number → { soon, late } so each alert fires once
  let chatNumber = null, typing = false;
  let helpNumber = null, helpReason = '';
  let routeLen = 0;

  $('track-sheet').firstElementChild.classList.add('od-sheet-tall');

  /* ---------- formatting ---------- */
  const withSeconds = BizOrders.DEMO;   // demo speed → show seconds
  function clock(ts) {
    return new Date(ts).toLocaleTimeString('en-ZA', withSeconds
      ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
      : { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  function dateLabel(ts) {
    const d = new Date(ts), now = new Date();
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86400000);
    const t = d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (diff === 0) return 'Today, ' + t;
    if (diff === 1) return 'Yesterday, ' + t;
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) + ', ' + t;
  }
  const summary = o => (o.items[0] ? o.items[0].name : 'Order') + (o.items.length > 1 ? ' +' + (o.items.length - 1) + ' more' : '');
  const itemCount = o => o.items.reduce((s, i) => s + i.qty, 0);
  const initials = name => String(name).split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const firstName = name => String(name).split(/\s+/)[0];

  function arrivalText(L) {
    if (BizOrders.DEMO && L.secondsLeft != null) return L.secondsLeft <= 3 ? 'Arriving any moment' : 'Arriving in ' + L.secondsLeft + ' sec';
    return L.minutesLeft <= 1 ? 'Arriving any moment' : 'Arriving in ' + L.minutesLeft + ' min';
  }
  function distanceText(L, driver) {
    return (L.km < 0.1 ? 'Almost at your door' : L.km.toFixed(1) + ' km away') + ' · ' + firstName(driver.name) + ' is on the way';
  }

  let toastTimer;
  function toast(msg, ms) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 2600);
  }

  /** Phones dial directly; on desktop we show the number instead. */
  function dial(phone, who) {
    const digits = String(phone).replace(/[^\d+]/g, '');
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
    if (mobile) location.href = 'tel:' + digits;
    else toast('Call ' + who + ' on ' + phone, 5000);
  }

  /* ---------- drawn map ---------- */
  const ROUTE = 'M40 160 L40 110 L130 110 L130 60 L230 60 L230 110 L300 110';
  function mapSVG(ini) {
    const xs = [[0, 34], [46, 124], [136, 224], [236, 294], [306, 340]];
    const ys = [[0, 54], [66, 104], [116, 154], [166, 190]];
    let blocks = '';
    ys.forEach((y, j) => xs.forEach((x, i) => {
      const fill = (i === 2 && j === 1) ? '#d3ebd8' : ((i + j) % 2 ? '#e6edf5' : '#dde6f0');
      blocks += `<rect x="${x[0]}" y="${y[0]}" width="${x[1] - x[0]}" height="${y[1] - y[0]}" rx="5" fill="${fill}"/>`;
    }));
    const label = 'font-size="9" font-weight="800" fill="#334155" stroke="#fff" stroke-width="3" paint-order="stroke" text-anchor="middle" font-family="DM Sans, sans-serif"';
    return `<svg viewBox="0 0 340 190" role="img" aria-label="Map showing your driver on the way to you">
      <rect width="340" height="190" fill="#fff"/>${blocks}
      <path id="rt-path" d="${ROUTE}" fill="none" stroke="#c3cfe2" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path id="rt-done" d="${ROUTE}" fill="none" stroke="#002b66" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <g transform="translate(40 160)"><circle r="10" fill="#f59e0b" stroke="#fff" stroke-width="2"/><rect x="-4" y="-4" width="8" height="8" rx="1.5" fill="#fff"/><text y="25" ${label}>Shop</text></g>
      <g transform="translate(300 110)"><circle r="10" fill="#002b66" stroke="#fff" stroke-width="2"/><path d="M-5 1 L0 -5 L5 1 V5 H-5Z" fill="#fff"/><text y="-16" ${label}>You</text></g>
      <g id="rt-driver" transform="translate(40 160)"><circle class="lv-halo" r="16" fill="#f59e0b" opacity=".4"/><circle r="11" fill="#002b66" stroke="#fff" stroke-width="2.5"/><text y="3" font-size="8.5" font-weight="800" fill="#fff" text-anchor="middle" font-family="DM Sans, sans-serif">${esc(ini)}</text></g>
    </svg>`;
  }

  /* ---------- list ---------- */
  function renderList() {
    const all = BizOrders.list(email);
    const act = all.filter(o => BizOrders.status(o).active);
    const past = all.filter(o => !BizOrders.status(o).active);
    $('count-active').textContent = act.length;
    $('count-past').textContent = past.length;

    const shown = tab === 'active' ? act : past;
    $('orders-list').innerHTML = shown.map(o => {
      const s = BizOrders.status(o);
      const bar = s.active
        ? `<div class="od-bar" role="progressbar" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${s.idx}"><i style="width:${Math.max(8, (s.idx / 4) * 100)}%"></i></div>`
        : '';
      let hint = '';
      if (s.active) hint = s.idx === 3
        ? ` · <span class="od-live-hint" data-live-num="${esc(o.number)}">${arrivalText(BizOrders.live(o))}</span>`
        : ' · <span class="od-track-hint">Track order</span>';
      return `
        <button type="button" class="od-card" data-num="${esc(o.number)}">
          <div class="od-top">
            <div><div class="od-num">Order #${esc(o.number)}</div><div class="od-date">${dateLabel(o.placedAt)}</div></div>
            <span class="od-pill ${s.key}">${s.label}</span>
          </div>
          <div class="od-items">${esc(summary(o))}</div>
          ${bar}
          <div class="od-bottom">
            <span>${itemCount(o)} ${itemCount(o) === 1 ? 'item' : 'items'}${hint}</span>
            <b>${money(o.total)}</b>
          </div>
        </button>`;
    }).join('');

    $('orders-empty').classList.toggle('hidden', shown.length > 0);
    if (!shown.length) {
      const none = all.length === 0;
      $('empty-title').textContent = none ? 'No orders yet' : (tab === 'active' ? 'No active orders' : 'No past orders yet');
      $('empty-text').textContent = none
        ? 'When you place an order, you can follow it here.'
        : (tab === 'active' ? 'Your delivered and cancelled orders are under Past.' : 'Delivered and cancelled orders will show up here.');
      $('empty-cta').classList.toggle('hidden', !none && tab === 'past');
    }
  }

  /* ---------- tracking sheet ---------- */
  const vehLine = d => [d.vehicle, d.plate].filter(Boolean).join(' · ');

  function liveBlock(o, s) {
    if (!s.active) return '';
    if (s.idx < 3) {
      return `<div class="lv-soon">${ICON('pin')}<span>Your driver will appear on the map once your order is on its way. Estimated delivery <b>${clock(BizOrders.etaTime(o))}</b>.</span></div>`;
    }
    const driver = BizOrders.driver(o);
    const late = BizOrders.isLate(o)
      ? `<div class="lv-late">${ICON('bell')}<div><b>Running late</b>Your driver hit heavy traffic. New arrival time: ${clock(BizOrders.actualEnd(o))}.<br><button type="button" class="od-help-btn" data-help="late">Get help</button></div></div>`
      : '';
    return `<div class="lv">${late}
      <div class="lv-eta"><div class="lv-min" id="lv-min"></div><div class="lv-sub" id="lv-sub"></div></div>
      <div class="lv-map">${mapSVG(initials(driver.name))}</div></div>`;
  }

  function driverCard(o, s) {
    if (!s.active || s.idx < 2) return '';
    if (!BizOrders.AUTOPILOT && !o.driverEmail) return `<div class="lv-soon">${ICON('bike')}<span>Your order is packed. We’re waiting for a driver to collect it.</span></div>`;
    const d = BizOrders.driver(o);
    return `<div class="dr-card">
      <div class="dr-top">
        <span class="dr-avatar">${esc(initials(d.name))}</span>
        <div><div class="dr-name">${esc(d.name)}</div>
        <div class="dr-meta">${d.rating ? ICON('star') + ' ' + d.rating + ' · ' : ''}${esc(vehLine(d))}</div></div>
      </div>
      <div class="dr-actions">
        <button type="button" class="dr-btn" data-call-driver>${ICON('phone')}Call</button>
        <button type="button" class="dr-btn primary" data-chat>${ICON('mail')}Message</button>
      </div></div>`;
  }

  function helpBlock(o, s) {
    if (s.cancelled) return '';
    const cmp = (o.complaints || []).map(c =>
      `<div>${ICON('check')}<span><b>${esc(c.ref)}</b> received · ${esc(c.reason)}</span></div>`).join('');
    const title = s.active ? 'Taking too long or something wrong?' : 'Something wrong with this order?';
    return `<div class="od-help"><b>${title}</b><p>Call our team or tell us what happened.</p>
      <div class="od-help-row">
        <button type="button" class="od-help-btn" data-call-support>Call support</button>
        <button type="button" class="od-help-btn" data-help="report">Report a problem</button>
      </div>${cmp ? `<div class="od-cmp">${cmp}</div>` : ''}</div>`;
  }

  function renderSheet() {
    const o = openNumber && BizOrders.find(email, openNumber);
    if (!o) return;
    const s = BizOrders.status(o);
    $('track-title').textContent = 'Order #' + o.number;

    let steps;
    if (s.cancelled) {
      steps = `
        <li class="od-step done"><span class="od-dot">${ICON('check')}</span><div><div class="t">Order placed</div><div class="d">We received your order.</div></div><span class="tm">${clock(o.placedAt)}</span></li>
        <li class="od-step cancelled"><span class="od-dot">${ICON('close')}</span><div><div class="t">Cancelled</div><div class="d">You cancelled this order.</div></div><span class="tm">${clock(o.cancelledAt)}</span></li>`;
    } else {
      steps = BizOrders.STAGES.map((st, i) => {
        const done = i < s.idx || s.delivered;
        const current = i === s.idx && !s.delivered;
        const time = (done || current) ? clock(BizOrders.stageTime(o, i)) : '';
        return `<li class="od-step ${done ? 'done' : current ? 'current' : ''}"${current ? ' aria-current="step"' : ''}>
          <span class="od-dot">${ICON('check')}</span>
          <div><div class="t">${st.label}</div><div class="d">${st.desc}</div></div>
          <span class="tm">${time}</span></li>`;
      }).join('');
    }

    let eta = '';
    if (s.delivered) eta = `<div class="od-eta done">Delivered by ${esc(BizOrders.driver(o).name)}<b>${clock(BizOrders.actualEnd(o))}</b></div>`;
    else if (s.cancelled) eta = `<div class="od-eta cancelled">This order was cancelled and you were not charged.</div>`;

    const lines = o.items.map(i => `<div class="od-line"><span>${i.qty} × ${esc(i.name)}</span><span>${money(i.price * i.qty)}</span></div>`).join('');

    let actions = '';
    if (BizOrders.canCancel(o)) {
      actions = `<div class="bz-sheet-actions"><button type="button" id="cancel-order" class="bz-btn danger${confirmCancel ? ' confirm' : ''}">${confirmCancel ? 'Tap again to cancel' : 'Cancel order'}</button></div>`;
    } else if (!s.active) {
      actions = `<div class="bz-sheet-actions"><button type="button" id="reorder" class="bz-btn primary">Order again</button></div>`;
    }

    $('track-body').innerHTML = `
      <div class="od-sheet-top"><span class="od-date">Placed ${dateLabel(o.placedAt)}</span><span class="od-pill ${s.key}">${s.label}</span></div>
      ${eta}${liveBlock(o, s)}${driverCard(o, s)}
      <ol class="od-timeline">${steps}</ol>
      <div class="od-block"><h3>Items</h3>${lines}<div class="od-line total"><span>Total</span><span>${money(o.total)}</span></div></div>
      <div class="od-block"><h3>Delivery address</h3>
        <div class="od-addr">${o.address ? esc(o.address) : 'No address saved'}${o.phone ? '<small>' + esc(o.phone) + '</small>' : ''}</div></div>
      ${helpBlock(o, s)}
      ${actions}`;
    routeLen = 0;
    liveTick();
  }

  function openSheet(number) {
    openNumber = number;
    confirmCancel = false;
    renderSheet();
    $('track-sheet').classList.remove('hidden');
  }
  function closeSheet() {
    $('track-sheet').classList.add('hidden');
    openNumber = null;
    confirmCancel = false;
    clearTimeout(confirmTimer);
  }

  /* ---------- per-second live updates (no re-render, so nothing flickers) ---------- */
  function liveTick() {
    document.querySelectorAll('[data-live-num]').forEach(el => {
      const o = BizOrders.find(email, el.dataset.liveNum);
      if (o) el.textContent = arrivalText(BizOrders.live(o));
    });

    const o = openNumber && BizOrders.find(email, openNumber);
    if (!o || !$('lv-min')) return;
    const s = BizOrders.status(o);
    if (!s.active || s.idx !== 3) return;

    const L = BizOrders.live(o), d = BizOrders.driver(o);
    $('lv-min').textContent = arrivalText(L);
    $('lv-sub').textContent = distanceText(L, d);

    const path = $('rt-path');
    if (!path) return;
    if (!routeLen) routeLen = path.getTotalLength();
    const done = $('rt-done');
    done.style.strokeDasharray = routeLen;
    done.style.strokeDashoffset = routeLen * (1 - L.p);
    const pt = path.getPointAtLength(routeLen * L.p);
    $('rt-driver').setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
  }

  /* ---------- driver chat ---------- */
  const QUICK = ['I’m at the gate', 'Please call me', 'Which entrance should I use?', 'How far are you?'];

  function renderChat() {
    const o = chatNumber && BizOrders.find(email, chatNumber);
    if (!o) return;
    const s = BizOrders.status(o);
    const d = BizOrders.driver(o);
    const msgs = o.messages || [];
    let html = `<div class="ch-note">Message ${esc(firstName(d.name))} about this delivery. ${d.real ? '' : 'Replies are simulated in this demo.'}</div>`;
    html += msgs.map(m => `<div class="ch-msg ${m.from === 'me' ? 'me' : 'driver'}">${esc(m.text)}<small>${new Date(m.at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false })}</small></div>`).join('');
    if (typing) html += `<div class="ch-typing">${esc(firstName(d.name))} is typing…</div>`;
    if (!s.active) html += `<div class="ch-closed">This delivery has ended, so chat is closed.</div>`;
    const log = $('chat-log');
    log.innerHTML = html;
    log.scrollTop = log.scrollHeight;
    $('chat-form').classList.toggle('hidden', !s.active);
    $('chat-quick').classList.toggle('hidden', !s.active);
  }

  function openChat() {
    const o = BizOrders.find(email, openNumber);
    if (!o) return;
    const d = BizOrders.driver(o);
    chatNumber = o.number;
    typing = false;
    $('chat-avatar').textContent = initials(d.name);
    $('chat-name').textContent = d.name;
    $('chat-sub').textContent = vehLine(d);
    $('chat-quick').innerHTML = QUICK.map(q => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('');
    renderChat();
    $('chat-sheet').classList.remove('hidden');
    $('chat-input').focus();
  }
  function closeChat() { $('chat-sheet').classList.add('hidden'); chatNumber = null; typing = false; }

  function replyFor(text, o) {
    const t = text.toLowerCase();
    const s = BizOrders.status(o);
    if (/how far|where are you|how long|eta|when/.test(t)) {
      return s.idx === 3 ? 'I’m about ' + Math.max(1, BizOrders.live(o).minutesLeft) + ' min away.' : 'I’m collecting your order now, I’ll head out soon.';
    }
    if (/gate/.test(t)) return 'Okay, I’ll wait at the gate.';
    if (/call/.test(t)) return 'Sure, I’ll call you when I’m close.';
    if (/entrance|door|which|where should/.test(t)) return 'I’ll use the main entrance unless you tell me otherwise.';
    if (/thank/.test(t)) return 'You’re welcome!';
    return 'Got it, thanks!';
  }

  function sendMessage(text) {
    text = String(text || '').trim();
    const o = chatNumber && BizOrders.find(email, chatNumber);
    if (!text || !o || !BizOrders.status(o).active) return;
    BizOrders.addMessage(email, o.number, { from: 'me', text });
    if (o.driverEmail) { renderChat(); return; }   // a real driver answers from their own screen
    typing = true;
    renderChat();
    const num = o.number;
    setTimeout(() => {
      typing = false;
      const cur = BizOrders.find(email, num);
      if (cur && BizOrders.status(cur).active) {
        BizOrders.addMessage(email, num, { from: 'driver', text: replyFor(text, cur) });
        if (chatNumber === num) renderChat();
        else toast(firstName(BizOrders.driver(cur).name) + ' replied to your message');
      } else if (chatNumber === num) renderChat();
    }, 1500 + Math.random() * 1200);
  }

  $('chat-form').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('chat-input').value;
    $('chat-input').value = '';
    sendMessage(v);
  });
  $('chat-quick').addEventListener('click', e => {
    const b = e.target.closest('[data-q]');
    if (b) sendMessage(b.dataset.q);
  });
  $('chat-close').addEventListener('click', closeChat);

  /* ---------- help / complaints ---------- */
  function setReason(v) {
    helpReason = v || '';
    $('help-reasons').querySelectorAll('.bz-opt').forEach(b => {
      const on = b.dataset.v === helpReason;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    $('help-err').classList.add('hidden');
  }
  function openHelp(preselect) {
    helpNumber = openNumber;
    $('help-title').textContent = 'Help with order #' + helpNumber;
    $('help-phone').textContent = BizOrders.SUPPORT_PHONE;
    $('help-main').classList.remove('hidden');
    $('help-done').classList.add('hidden');
    $('help-note').value = '';
    setReason(preselect || '');
    $('help-sheet').classList.remove('hidden');
  }
  function closeHelp() { $('help-sheet').classList.add('hidden'); helpNumber = null; }

  $('help-reasons').addEventListener('click', e => {
    const b = e.target.closest('.bz-opt');
    if (b) setReason(b.dataset.v);
  });
  $('help-call').addEventListener('click', () => dial(BizOrders.SUPPORT_PHONE, 'BizLink support'));
  $('help-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!helpReason) { $('help-err').classList.remove('hidden'); return; }
    const c = BizOrders.addComplaint(email, helpNumber, { reason: helpReason, note: $('help-note').value.trim() });
    if (!c) return;
    const o = BizOrders.find(email, helpNumber);
    $('help-ref').textContent = 'Complaint ' + c.ref + ' received';
    $('help-contact').textContent = (o && o.phone) || 'your registered number';
    $('help-main').classList.add('hidden');
    $('help-done').classList.remove('hidden');
  });
  $('help-ok').addEventListener('click', () => { closeHelp(); renderSheet(); });
  $('help-close').addEventListener('click', () => { closeHelp(); renderSheet(); });

  /* ---------- sheet + list wiring ---------- */
  $('track-close').addEventListener('click', closeSheet);
  [['track-sheet', closeSheet], ['chat-sheet', closeChat], ['help-sheet', () => { closeHelp(); renderSheet(); }]].forEach(([id, fn]) => {
    $(id).addEventListener('click', e => { if (e.target.id === id) fn(); });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!$('help-sheet').classList.contains('hidden')) { closeHelp(); renderSheet(); }
    else if (!$('chat-sheet').classList.contains('hidden')) closeChat();
    else closeSheet();
  });

  $('orders-list').addEventListener('click', e => {
    const card = e.target.closest('.od-card');
    if (card) openSheet(card.dataset.num);
  });

  $('track-body').addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-call-driver]')) {
      const d = BizOrders.driver(BizOrders.find(email, openNumber));
      dial(d.phone, d.name);
      return;
    }
    if (t.closest('[data-chat]')) { openChat(); return; }
    if (t.closest('[data-call-support]')) { dial(BizOrders.SUPPORT_PHONE, 'BizLink support'); return; }
    const h = t.closest('[data-help]');
    if (h) { openHelp(h.dataset.help === 'late' ? 'Taking too long' : ''); return; }

    if (t.closest('#cancel-order')) {
      if (!confirmCancel) {
        confirmCancel = true;
        clearTimeout(confirmTimer);
        confirmTimer = setTimeout(() => { confirmCancel = false; renderSheet(); }, 4000);
        renderSheet();
        return;
      }
      if (BizOrders.cancel(email, openNumber)) toast('Order #' + openNumber + ' cancelled');
      else toast('Too late to cancel — the order is already being prepared');
      confirmCancel = false;
      sync(true);
      return;
    }
    if (t.closest('#reorder')) {
      const o = BizOrders.find(email, openNumber);
      if (!o) return;
      let cart = [];
      try { cart = JSON.parse(localStorage.getItem('bizlink_cart')) || []; } catch (err) {}
      o.items.forEach(i => {
        const ex = cart.find(c => c.id === i.id);
        if (ex) ex.qty += i.qty; else cart.push({ id: i.id, name: i.name, price: i.price, qty: i.qty });
      });
      try { localStorage.setItem('bizlink_cart', JSON.stringify(cart)); } catch (err) {}
      location.href = 'browse.html#cart';
    }
  });

  document.querySelectorAll('.od-tab').forEach(b => {
    b.addEventListener('click', () => {
      tab = b.dataset.tab;
      document.querySelectorAll('.od-tab').forEach(x => {
        x.classList.toggle('active', x === b);
        x.setAttribute('aria-selected', x === b ? 'true' : 'false');
      });
      renderList();
    });
  });

  /* ---------- live loop ---------- */
  function signature() {
    return BizOrders.list(email).map(o => o.number + ':' + BizOrders.status(o).key + (BizOrders.isLate(o) ? ':late' : '') + ':' + (o.driverEmail || '') + ':' + (o.messages || []).length).join('|');
  }

  function milestones() {
    BizOrders.list(email).forEach(o => {
      const s = BizOrders.status(o);
      if (!s.active || s.idx !== 3) return;
      const a = announced[o.number] || (announced[o.number] = {});
      const L = BizOrders.live(o);
      if (L.minutesLeft <= 2 && !a.soon) {
        a.soon = true;
        toast(L.minutesLeft <= 1 ? 'Your driver is almost there' : 'Your driver is 2 minutes away');
      }
      if (L.late && !a.late) {
        a.late = true;
        toast('Order #' + o.number + ' is running late');
      }
    });
  }

  function sync(force) {
    const sig = signature();
    if (force || sig !== lastSig) {
      lastSig = sig;
      BizOrders.list(email).forEach(o => {
        const k = BizOrders.status(o).key;
        if (lastStatus[o.number] && lastStatus[o.number] !== k && k !== 'cancelled') {
          toast('Order #' + o.number + ': ' + BizOrders.status(o).label);
        }
        lastStatus[o.number] = k;
      });
      renderList();
      if (openNumber) renderSheet();
      if (chatNumber) renderChat();
      BizNav.refresh();
    }
    liveTick();
    milestones();
  }

  /* ---------- init ---------- */
  BizOrders.list(email).forEach(o => {
    lastStatus[o.number] = BizOrders.status(o).key;
    const s = BizOrders.status(o);
    if (s.active && s.idx === 3) {            // don't re-announce things that already happened
      const L = BizOrders.live(o);
      announced[o.number] = { soon: L.minutesLeft <= 2, late: L.late };
    }
  });
  lastSig = signature();

  const m = location.hash.match(/BL-\d+/);   // arriving from checkout: orders.html#BL-1043
  if (m) {
    const o = BizOrders.find(email, m[0]);
    if (o) {
      tab = BizOrders.status(o).active ? 'active' : 'past';
      document.querySelectorAll('.od-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
    }
    renderList();
    if (o) openSheet(m[0]);
    history.replaceState(null, '', location.pathname);
  } else {
    renderList();
  }
  BizNav.refresh();
  setInterval(() => sync(false), 1000);
})();
