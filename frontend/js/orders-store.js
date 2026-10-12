/* ============================================================
   BizLink — orders store (localStorage, one list per account)

   There is no backend yet, so everything "live" is SIMULATED from the
   time since the order was placed: stage, driver position, minutes left
   and delays. When a real API exists, replace stageIndex() / live() with
   server data — the UI code does not need to change.

   DEMO = true  → whole delivery takes 60 s (65 s if delayed) so you can watch it
   DEMO = false → realistic timings (~31 min)

   CONNECTED (layer 1): orders now live in ONE shared list, so the shop and
   the driver can see the same order as the customer. Each order carries
   shopEmail / driverEmail and a real `state` (see FLOW below) plus the API
   the business and driver screens call (shopAccept, driverAdvance, …).
   AUTOPILOT = true keeps the customer tracker on the timer simulation until
   the business and driver screens are built; set it to false to follow the
   real `state` instead.
   ============================================================ */
(function () {
  const DEMO = true;
  const AUTOPILOT = true;          // true = timer simulation (demo: 60s total) · false = the customer's tracker follows the REAL shop + driver actions
  const PAY = { base: 20, perKm: 5 };   // driver commission per delivery: base + per km (edit here)
  const SEQ_KEY = 'bizlink_order_seq';
  const CMP_KEY = 'bizlink_complaint_seq';

  // Phone numbers are placeholders — replace with real ones.
  const SUPPORT_PHONE = '0800 000 000';

  // Time spent in: Placed, Confirmed, Being prepared, Out for delivery
  const DUR = DEMO ? [10e3, 10e3, 10e3, 30e3] : [2 * 60e3, 4 * 60e3, 10 * 60e3, 15 * 60e3];
  // Extra time a "delayed" order spends stuck in traffic (every 3rd order number)
  const DELAY = DEMO ? 5e3 : 8 * 60e3;

  const STAGES = [
    { key: 'placed',    pill: 'Placed',           label: 'Order placed',     desc: 'We’ve received your order.' },
    { key: 'confirmed', pill: 'Confirmed',        label: 'Confirmed',        desc: 'The supplier accepted your order.' },
    { key: 'preparing', pill: 'Being prepared',   label: 'Being prepared',   desc: 'Your items are being packed.' },
    { key: 'out',       pill: 'Out for delivery', label: 'Out for delivery', desc: 'Your driver is on the way.' },
    { key: 'delivered', pill: 'Delivered',        label: 'Delivered',        desc: 'Enjoy! Thanks for shopping local.' }
  ];
  const LAST = STAGES.length - 1;

  const DRIVERS = [
    { name: 'Sipho Dlamini',   rating: 4.9, vehicle: 'Honda Wave scooter',  plate: 'GP 48 21 TR', phone: '071 555 0142' },
    { name: 'Thandi Mokoena',  rating: 4.8, vehicle: 'Yamaha Crypton',      plate: 'GP 77 03 BZ', phone: '072 555 0187' },
    { name: 'Lerato Khumalo', rating: 4.7, vehicle: 'Suzuki Address',      plate: 'GP 19 66 KL', phone: '073 555 0119' },
    { name: 'Bongani Nkosi',   rating: 4.9, vehicle: 'Bajaj Boxer',         plate: 'GP 52 90 MV', phone: '074 555 0163' }
  ];

  const ALL_KEY = 'bizlink_orders_all';
  const MIGRATED = 'bizlink_orders_migrated';
  const DRV_KEY = 'bizlink_drivers';
  const norm = e => String(e || '').trim().toLowerCase();
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  /* One-time: fold the old per-customer lists (bizlink_orders_<email>) into the shared list. */
  function migrate() {
    try {
      if (localStorage.getItem(MIGRATED)) return;
      const all = read(ALL_KEY, []);
      Object.keys(localStorage).forEach(k => {
        if (k === ALL_KEY || k.indexOf('bizlink_orders_') !== 0 || k.indexOf('@') < 0) return;
        const email = k.slice('bizlink_orders_'.length);
        read(k, []).forEach(o => {
          if (all.some(x => x.number === o.number)) return;
          o.customerEmail = email; o.shopEmail = o.shopEmail || null; o.shopName = o.shopName || '';
          o.state = o.cancelledAt ? 'cancelled' : 'placed'; o.driverEmail = null; o.times = o.times || { placed: o.placedAt };
          all.push(o);
        });
        localStorage.removeItem(k);
      });
      write(ALL_KEY, all);
      localStorage.setItem(MIGRATED, '1');
    } catch (e) {}
  }
  function loadAll() { migrate(); return read(ALL_KEY, []); }
  function saveAll(list) { write(ALL_KEY, list); }
  /** All of one customer's orders. */
  function load(email) { return loadAll().filter(o => o.customerEmail === norm(email)); }
  /** Find an order by number, let fn change it, save. Returns fn's result (or the order). */
  function mutate(number, fn) {
    const all = loadAll();
    const o = all.find(x => x.number === number);
    if (!o) return null;
    const r = fn(o);
    saveAll(all);
    return r === undefined ? o : r;
  }
  const numOf = order => parseInt(String(order.number).replace(/\D/g, ''), 10) || 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function bumpSeq(key, start) {
    let n = parseInt(localStorage.getItem(key), 10) || start;
    n += 1;
    try { localStorage.setItem(key, String(n)); } catch (e) {}
    return n;
  }

  /* Stage boundaries (ms after placedAt): [confirmed, preparing, out, delivered] */
  function bounds(order) {
    const t1 = DUR[0], t2 = t1 + DUR[1], t3 = t2 + DUR[2];
    const t4 = t3 + DUR[3] + delayOf(order);
    return [t1, t2, t3, t4];
  }
  function delayOf(order) { return numOf(order) % 3 === 0 ? DELAY : 0; }

  function stageIndex(order, now) {
    const elapsed = (order.cancelledAt || now || Date.now()) - order.placedAt;
    return bounds(order).filter(b => elapsed >= b).length;
  }

  /* ---- real-state mode (AUTOPILOT = false): the stage comes from order.state ---- */
  const STATE_IDX = { placed: 0, accepted: 1, preparing: 2, ready: 2, at_shop: 2, picked_up: 3, on_trip: 3, arrived: 3, delivered: 4 };
  const tripMs = o => DEMO ? 90e3 : (12 + numOf(o) % 4) * 60e3;     // how long the trip is expected to take

  const BizOrders = {
    DEMO, AUTOPILOT, PAY, STAGES, SUPPORT_PHONE,

    /**
     * Check out a cart. One order per shop (each shop packs and ships its own),
     * stock is taken, closed shops are refused.
     * user = { name, address, phone }. Returns { orders } or { error }.
     */
    createMany(email, items, user) {
      const lines = items.map(i => {
        const p = window.BizProducts && BizProducts.get(i.id);
        return { id: i.id, name: p ? p.name : i.name, price: p ? p.price : Number(i.price), qty: Number(i.qty), shopEmail: p ? p.shopEmail : null, shopName: p ? p.vendor : '' };
      });
      if (window.BizProducts) {
        const t = BizProducts.take(lines);
        if (!t.ok) return { error: t.reason };
      }
      const groups = {};
      lines.forEach(l => { (groups[l.shopEmail || ''] = groups[l.shopEmail || ''] || []).push(l); });
      const orders = Object.keys(groups).map(k => this.create(email, groups[k], user, k ? { email: k, name: groups[k][0].shopName } : null));
      return { orders };
    },

    /** Create one order for one shop (stock already taken). */
    create(email, items, user, shop) {
      const clean = items.map(i => ({ id: i.id, name: i.name, price: Number(i.price), qty: Number(i.qty) }));
      const now = Date.now();
      const number = 'BL-' + bumpSeq(SEQ_KEY, 1042);
      const km = 2.4 + (parseInt(number.replace(/\D/g, ''), 10) % 5) * 0.4;
      const parts = String((user && user.address) || '').split(',').map(x => x.trim()).filter(Boolean);
      const order = {
        number,
        customerEmail: norm(email),
        customerName: (user && user.name) || '',
        shopEmail: shop ? norm(shop.email) : null,
        shopName: shop ? shop.name : '',
        items: clean,
        total: clean.reduce((s, i) => s + i.price * i.qty, 0),
        address: (user && user.address) || '',
        dropArea: parts[1] || parts[0] || '',
        phone: (user && user.phone) || '',
        km: Math.round(km * 10) / 10,
        payout: Math.round(PAY.base + km * PAY.perKm),
        state: 'placed',
        driverEmail: null,
        times: { placed: now },
        placedAt: now,
        cancelledAt: null,
        messages: [],
        complaints: []
      };
      const all = loadAll();
      all.unshift(order);
      saveAll(all);
      return order;
    },

    list(email) { return load(email).sort((a, b) => b.placedAt - a.placedAt); },
    find(email, number) { return load(email).find(o => o.number === number) || null; },

    status(order, now) {
      if (!AUTOPILOT) {
        const cancelled = !!order.cancelledAt || order.state === 'cancelled' || order.state === 'declined';
        const i = STATE_IDX[order.state] != null ? STATE_IDX[order.state] : 0;
        const done = !cancelled && order.state === 'delivered';
        return {
          idx: i, cancelled, delivered: done, active: !cancelled && !done,
          key: cancelled ? 'cancelled' : STAGES[i].key,
          label: cancelled ? (order.state === 'declined' ? 'Declined' : 'Cancelled') : STAGES[i].pill
        };
      }
      const idx = stageIndex(order, now);
      const cancelled = !!order.cancelledAt;
      const delivered = !cancelled && idx === LAST;
      return {
        idx, cancelled, delivered,
        active: !cancelled && !delivered,
        key: cancelled ? 'cancelled' : STAGES[idx].key,
        label: cancelled ? 'Cancelled' : STAGES[idx].pill
      };
    },

    canCancel(order, now) {
      if (!AUTOPILOT) return !order.cancelledAt && (order.state === 'placed' || order.state === 'accepted');
      const s = this.status(order, now); return s.active && s.idx <= 1;
    },
    cancel(email, number) {
      const o = this.find(email, number);
      if (!o || !this.canCancel(o)) return false;
      mutate(number, x => { x.cancelledAt = Date.now(); x.state = 'cancelled'; x.times.cancelled = x.cancelledAt; });
      if (window.BizProducts) BizProducts.give(o.items);
      return true;
    },

    /** Time the order reached stage i (0 = placed … 4 = delivered). */
    stageTime(order, i) {
      if (!AUTOPILOT) { const t = order.times || {}; return [t.placed, t.accepted, t.preparing || t.accepted, t.picked_up, t.delivered][i] || order.placedAt; }
      return order.placedAt + (i === 0 ? 0 : bounds(order)[i - 1]); },
    /** The delivery time we originally promised. */
    etaTime(order) {
      if (!AUTOPILOT) {
        const t = order.times || {};
        if (t.on_trip) return t.on_trip + tripMs(order);
        if (t.picked_up) return t.picked_up + tripMs(order) + (DEMO ? 15e3 : 2 * 60e3);
        return order.placedAt + (DEMO ? 4 * 60e3 : 35 * 60e3);
      }
      return order.placedAt + bounds(order)[2] + DUR[3]; },
    /** When it will actually arrive (later than promised if delayed). */
    actualEnd(order) {
      if (!AUTOPILOT) {
        if (order.state === 'delivered') return (order.times || {}).delivered || order.etaAt || Date.now();
        return this.isLate(order) ? Date.now() + (DEMO ? 30e3 : 5 * 60e3) : this.etaTime(order);
      }
      return order.placedAt + bounds(order)[3]; },
    activeCount(email) { return load(email).filter(o => this.status(o).active).length; },

    /* ---------- driver + live tracking (simulated) ---------- */
    driver(order) {
      if (order.driverEmail) {                      // a real driver took this order
        const u = (window.BizAuth && BizAuth.getUser(order.driverEmail)) || {};
        return { name: u.name || 'Your driver', rating: null, vehicle: u.vehicleType || 'Vehicle', plate: u.vehicleType === 'Bicycle' ? '' : (u.plate || ''), phone: u.phone || SUPPORT_PHONE, real: true };
      }
      return DRIVERS[numOf(order) % DRIVERS.length];
    },

    isLate(order, now) {
      const s = this.status(order, now);
      return s.active && (now || Date.now()) > this.etaTime(order);
    },

    /** Driver progress along the route (0–1), minutes left and km left. */
    live(order, now) {
      now = now || Date.now();
      if (!AUTOPILOT) {
        const t = order.times || {}, trip = tripMs(order);
        let p = 0;
        if (order.state === 'on_trip') p = clamp((now - (t.on_trip || now)) / trip, 0, 0.95);
        else if (order.state === 'arrived' || order.state === 'delivered') p = 1;
        const km = order.km || 2.4;
        return { p, minutesLeft: p >= 1 ? 0 : Math.max(1, Math.ceil((1 - p) * trip / 60000)), km: (1 - p) * km, late: this.isLate(order, now) };
      }
      const b = bounds(order);
      const start = order.placedAt + b[2];
      const total = b[3] - b[2];                       // ms from leaving to arriving
      const elapsed = clamp(now - start, 0, total);
      const planned = DUR[3];
      let p;
      if (delayOf(order)) {                            // fast, then stuck in traffic
        const knee = planned * 0.7;
        p = elapsed <= knee ? elapsed / planned : 0.7 + 0.3 * ((elapsed - knee) / (total - knee));
      } else {
        p = elapsed / total;
      }
      p = clamp(p, 0, 1);
      const baseTrip = 12 + (numOf(order) % 4);        // minutes for a normal trip
      const tripMin = baseTrip * (total / planned);
      const secondsLeft = Math.ceil((total - elapsed) / 1000);
      const minutesLeft = DEMO ? Math.max(1, Math.ceil(secondsLeft / 60)) : Math.ceil(((total - elapsed) / total) * tripMin);
      const totalKm = 2.4 + (numOf(order) % 5) * 0.4;
      return { p, minutesLeft, secondsLeft, km: (1 - p) * totalKm, late: this.isLate(order, now) };
    },

    /* ---------- driver chat ---------- */
    addMessage(email, number, msg) {
      const m = { from: msg.from, text: String(msg.text).slice(0, 300), at: Date.now() };
      return mutate(number, o => { o.messages = o.messages || []; o.messages.push(m); return m; });
    },

    /* ---------- complaints ---------- */
    addComplaint(email, number, data) {
      const c = {
        ref: 'CMP-' + bumpSeq(CMP_KEY, 2030),
        reason: data.reason,
        note: String(data.note || '').slice(0, 500),
        at: Date.now()
      };
      return mutate(number, o => { o.complaints = o.complaints || []; o.complaints.push(c); return c; });
    },

    /* ============================================================
       Shop + driver side (shared orders)
       FLOW: placed → accepted → preparing → ready → (driver) at_shop →
             picked_up → on_trip → arrived → delivered
             placed → declined (shop) · placed/accepted → cancelled (customer)
       ============================================================ */
    FLOW: ['placed', 'accepted', 'preparing', 'ready', 'at_shop', 'picked_up', 'on_trip', 'arrived', 'delivered'],
    DRIVER_STEPS: [
      { from: 'ready',     to: 'at_shop',   label: 'Arrived at shop' },
      { from: 'at_shop',   to: 'picked_up', label: 'Picked up' },
      { from: 'picked_up', to: 'on_trip',   label: 'Start trip' },
      { from: 'on_trip',   to: 'arrived',   label: 'Arrived' },
      { from: 'arrived',   to: 'delivered', label: 'Delivered' }
    ],

    forShop(shopEmail) { return loadAll().filter(o => o.shopEmail === norm(shopEmail)).sort((a, b) => b.placedAt - a.placedAt); },
    forDriver(driverEmail) { return loadAll().filter(o => o.driverEmail === norm(driverEmail)).sort((a, b) => b.placedAt - a.placedAt); },
    /** Ready for pickup and nobody has taken it yet. */
    openJobs() { return loadAll().filter(o => o.state === 'ready' && !o.driverEmail && !o.cancelledAt).sort((a, b) => a.times.ready - b.times.ready); },
    /** The delivery the driver is on right now (one at a time). */
    activeFor(driverEmail) { return this.forDriver(driverEmail).find(o => o.state !== 'delivered' && !o.cancelledAt) || null; },

    _shopMove(number, shopEmail, from, to) {
      let ok = false;
      mutate(number, o => {
        if (o.shopEmail !== norm(shopEmail) || o.state !== from || o.cancelledAt) return;
        o.state = to; o.times[to] = Date.now(); ok = true;
      });
      return ok;
    },
    shopAccept(number, shopEmail) { return this._shopMove(number, shopEmail, 'placed', 'accepted'); },
    shopStartPreparing(number, shopEmail) { return this._shopMove(number, shopEmail, 'accepted', 'preparing'); },
    shopReady(number, shopEmail) { return this._shopMove(number, shopEmail, 'preparing', 'ready'); },
    shopDecline(number, shopEmail) {
      const o = loadAll().find(x => x.number === number);
      if (!o || o.shopEmail !== norm(shopEmail) || o.state !== 'placed' || o.cancelledAt) return false;
      mutate(number, x => { x.state = 'declined'; x.cancelledAt = Date.now(); x.times.declined = x.cancelledAt; });
      if (window.BizProducts) BizProducts.give(o.items);
      return true;
    },

    /** A driver takes a ready job. One active delivery at a time. */
    driverAccept(number, driverEmail) {
      if (this.activeFor(driverEmail)) return { ok: false, reason: 'Finish your current delivery first.' };
      let res = { ok: false, reason: 'Someone else already took this delivery.' };
      mutate(number, o => {
        if (o.state !== 'ready' || o.driverEmail || o.cancelledAt) return;
        const now = Date.now();
        o.driverEmail = norm(driverEmail);
        o.times.driverAccepted = now;
        o.shopEtaAt = now + (DEMO ? 90e3 : (6 + (numOf(o) % 5)) * 60e3);     // when the driver should reach the shop
        res = { ok: true };
      });
      return res;
    },
    /** Next step label for the driver, or null when finished. */
    driverNext(order) { return this.DRIVER_STEPS.find(s => s.from === order.state) || null; },
    driverAdvance(number, driverEmail) {
      let res = { ok: false };
      mutate(number, o => {
        const step = this.driverNext(o);
        if (!step || o.driverEmail !== norm(driverEmail) || o.cancelledAt) return;
        o.state = step.to; o.times[step.to] = Date.now();
        res = { ok: true, state: o.state };
      });
      return res;
    },

    /* driver availability */
    isOnline(driverEmail) { return !!(read(DRV_KEY, {})[norm(driverEmail)] || {}).online; },
    setOnline(driverEmail, online) {
      const db = read(DRV_KEY, {});
      db[norm(driverEmail)] = Object.assign({}, db[norm(driverEmail)], { online: !!online });
      write(DRV_KEY, db);
    }
  };

  window.BizOrders = BizOrders;
})();
