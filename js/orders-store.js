/* ============================================================
   BizLink — orders store (localStorage, one list per account)

   There is no backend yet, so customer delivery tracking is SIMULATED from
   the time since the order was placed: stage, driver position, minutes left
   and delays. Supplier purchases follow the shared business/driver state.
   When a real API exists, replace stageIndex() / live() with server data.

   DEMO = true  → whole delivery takes 30 s so you can watch it
   DEMO = false → realistic timings (~31 min)

   CONNECTED (layer 1): orders now live in ONE shared list, so the shop and
   the driver can see the same order as the customer. Each order carries
   shopEmail / driverEmail and a real `state` (see FLOW below) plus the API
   the business and driver screens call (shopAccept, driverAdvance, …).
   Customer orders use the demo timeline. Supplier accept/prepare/ready stages
   can be auto-simulated in demo mode; shop handoff and driver delivery remain explicit.
   ============================================================ */
(function () {
  const DEMO = true;
  const AUTOPILOT = true;          // Demo order timelines progress automatically.
  const PAY = { base: 20, perKm: 5 };   // driver commission per delivery: base + per km (edit here)
  const SEQ_KEY = 'bizlink_order_seq';
  const CMP_KEY = 'bizlink_complaint_seq';

  // Phone numbers are placeholders — replace with real ones.
  const SUPPORT_PHONE = '0800 000 000';

  // Time spent in: Placed, Confirmed, Being prepared, Out for delivery
  const DUR = DEMO ? [5e3, 5e3, 5e3, 15e3] : [2 * 60e3, 4 * 60e3, 10 * 60e3, 15 * 60e3];
  const DELAY = 0;
  const DELIVERY_FEE_PER_SHOP = 20;

  const STAGES = [
    { key: 'placed',    pill: 'Placed',           label: 'Order placed',     desc: 'We’ve received your order.' },
    { key: 'confirmed', pill: 'Confirmed',        label: 'Confirmed',        desc: 'The supplier accepted your order.' },
    { key: 'preparing', pill: 'Being prepared',   label: 'Being prepared',   desc: 'Your items are being packed.' },
    { key: 'out',       pill: 'Out for delivery', label: 'Out for delivery', desc: 'Your driver is on the way.' },
    { key: 'delivered', pill: 'Delivered',        label: 'Delivered',        desc: 'Enjoy! Thanks for shopping local.' }
  ];
  const LAST = STAGES.length - 1;

  const DRIVERS = [
    { name: 'Sipho Dlamini',   vehicle: 'Honda Wave scooter',  plate: 'GP 48 21 TR', phone: '071 555 0142' },
    { name: 'Thandi Mokoena',  vehicle: 'Yamaha Crypton',      plate: 'GP 77 03 BZ', phone: '072 555 0187' },
    { name: 'Lerato Khumalo', vehicle: 'Suzuki Address',      plate: 'GP 19 66 KL', phone: '073 555 0119' },
    { name: 'Bongani Nkosi',   vehicle: 'Bajaj Boxer',         plate: 'GP 52 90 MV' }
  ];

  const ALL_KEY = 'bizlink_orders_all';
  const BATCHES_KEY = 'bizlink_delivery_batches';
  const BATCH_SEQ_KEY = 'bizlink_delivery_batch_seq';
  const MAX_BATCH_SIZE = 5;
  const MIGRATED = 'bizlink_orders_migrated';
  const DRV_KEY = 'bizlink_drivers';
  const norm = e => String(e || '').trim().toLowerCase();
  const routeDate = () => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  };
  const routeArea = address => String(address || '').split(',').map(part => part.trim().toLowerCase()).filter(Boolean).slice(-2).join(', ');
  const routeTown = address => String(address || '').split(',').map(part => part.trim().toLowerCase()).filter(Boolean).slice(-1)[0] || '';
  const routePoolId = (supplierEmail, address) => [
    'route', routeDate(), norm(supplierEmail), routeTown(address)
  ].join('|');
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
  function progressAutoPreparedOrders(orders) {
    if (!DEMO) return false;
    const now = Date.now();
    let changed = false;
    orders.forEach(order => {
      if (!order.autoPrepare || order.cancelledAt || order.state === 'declined'
        || !['placed', 'accepted', 'preparing'].includes(order.state)) return;
      const elapsed = now - order.placedAt;
      const next = elapsed >= 9000 ? 'ready' : elapsed >= 6000 ? 'preparing' : elapsed >= 3000 ? 'accepted' : 'placed';
      const states = ['placed', 'accepted', 'preparing', 'ready'];
      if (states.indexOf(next) > states.indexOf(order.state)) {
        for (let index = states.indexOf(order.state) + 1; index <= states.indexOf(next); index++) {
          const state = states[index];
          order.state = state;
          order.times[state] = order.placedAt + index * 3000;
        }
        changed = true;
      }
    });
    return changed;
  }
  function loadAll() {
    migrate();
    const orders = read(ALL_KEY, []);
    if (progressAutoPreparedOrders(orders)) write(ALL_KEY, orders);
    return orders;
  }
  function saveAll(list) { write(ALL_KEY, list); }
  function loadBatches() { return read(BATCHES_KEY, []); }
  function saveBatches(list) { write(BATCHES_KEY, list); }
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
  function poolDiscountRate(shopCount) {
    if (shopCount >= 4) return 0.30;
    if (shopCount === 3) return 0.20;
    if (shopCount === 2) return 0.10;
    return 0;
  }

  function stageIndex(order, now) {
    const elapsed = (order.cancelledAt || now || Date.now()) - order.placedAt;
    return bounds(order).filter(b => elapsed >= b).length;
  }
  const isAutopilot = order => AUTOPILOT && order.buyerType !== 'business';


  /* ---- business purchase tracking follows supplier and driver actions ---- */
  const STATE_IDX = { placed: 0, accepted: 1, preparing: 2, ready: 2, at_shop: 2, picked_up: 3, on_trip: 3, arrived: 3, delivered: 4 };
  const tripMs = o => DEMO ? 90e3 : (12 + numOf(o) % 4) * 60e3;     // how long the trip is expected to take

  const BizOrders = {
    DEMO, AUTOPILOT, PAY, STAGES, SUPPORT_PHONE, DELIVERY_FEE_PER_SHOP, isAutopilot,

    /**
     * Check out a cart. One order per shop (each shop packs and ships its own),
     * stock is taken, closed shops are refused.
     * user = { name, address, phone }. Returns { orders } or { error }.
     */
    createMany(email, items, user, routePooling) {
      const lines = items.map(i => {
        const p = window.BizProducts && BizProducts.get(i.id);
        return { id: i.id, name: p ? p.name : i.name, price: p ? p.price : Number(i.price), qty: Number(i.qty), shopEmail: p ? p.shopEmail : null, shopName: p ? p.vendor : '' };
      });
      if (user && user.accountType === 'business') {
        if (user.businessType !== 'local-shop') return { error: 'Only local shops can order from suppliers.' };
        for (const line of lines) {
          const supplier = window.BizAuth && BizAuth.getUser(line.shopEmail);
          const demoSupplier = window.BizAuth && BizAuth.DEMO_SHOPS.find(shop => shop.email === line.shopEmail && shop.businessType === 'supplier');
          if ((!supplier || supplier.accountType !== 'business' || supplier.businessType !== 'supplier') && !demoSupplier) {
            return { error: 'Local shops can only order products listed by suppliers.' };
          }
        }
      }
      if (window.BizProducts) {
        const t = BizProducts.take(lines);
        if (!t.ok) return { error: t.reason };
      }
      const groups = {};
      lines.forEach(l => { (groups[l.shopEmail || ''] = groups[l.shopEmail || ''] || []).push(l); });
      const shopCount = Object.keys(groups).filter(Boolean).length;
      const poolingEnabled = !!routePooling || !(user && user.accountType === 'business');
      const discountRate = poolingEnabled ? poolDiscountRate(shopCount) : 0;
      const deliveryDiscount = Math.round(DELIVERY_FEE_PER_SHOP * discountRate * 100) / 100;
      const orders = Object.keys(groups).map(k => {
        const shop = k ? { email: k, name: groups[k][0].shopName } : null;
        const routePool = routePooling && shop && user && user.accountType === 'business' && user.businessType === 'local-shop'
          ? {
            id: routePoolId(shop.email, user.address),
            date: routeDate(),
            supplierEmail: norm(shop.email),
            area: routeArea(user.address),
            status: 'open'
          }
          : null;
        return this.create(email, groups[k], user, shop, {
          autoPrepare: !!(user && user.accountType === 'business'),
          routePool,
          deliveryFee: shop ? DELIVERY_FEE_PER_SHOP : 0,
          deliveryDiscount: shop ? deliveryDiscount : 0,
          poolingShopCount: shop && poolingEnabled ? shopCount : 0
        });
      });
      return {
        orders,
        deliveryFee: orders.reduce((sum, order) => sum + order.deliveryFee - order.deliveryDiscount, 0),
        deliveryDiscount: orders.reduce((sum, order) => sum + order.deliveryDiscount, 0)
      };
    },

    /** Nearby businesses can discover an open, same-day route for these suppliers. */
    routePoolInfo(email, address, items) {
      const supplierEmails = new Set((items || []).map(item => {
        const product = window.BizProducts && BizProducts.get(item.id);
        return product && norm(product.shopEmail);
      }).filter(Boolean));
      const today = routeDate();
      const nearbyBuyers = new Set(loadAll().filter(order =>
        order.customerEmail !== norm(email)
        && order.buyerType === 'business'
        && order.routePool && order.routePool.status === 'open'
        && order.routePool.date === today
        && supplierEmails.has(norm(order.routePool.supplierEmail))
        && !order.cancelledAt && !['cancelled', 'declined', 'delivered'].includes(order.state)
        && (!window.BizLocation || window.BizLocation.areaRank(address, order.address) <= 1)
      ).map(order => order.customerEmail));
      return {
        nearbyBusinesses: nearbyBuyers.size,
        date: today,
        area: routeArea(address),
        quote: this.deliveryQuote(items, true)
      };
    },
    deliveryQuote(items, pooled) {
      const shops = new Set((items || []).map(item => {
        const product = window.BizProducts && BizProducts.get(item.id);
        return product && norm(product.shopEmail);
      }).filter(Boolean));
      const shopCount = shops.size;
      const rate = pooled ? poolDiscountRate(shopCount) : 0;
      const standardFee = shopCount * DELIVERY_FEE_PER_SHOP;
      const deliveryDiscount = Math.round(standardFee * rate * 100) / 100;
      const subtotal = (items || []).reduce((sum, item) => sum + Number(item.price) * Number(item.qty), 0);
      return {
        shopCount,
        discountPercent: rate * 100,
        standardFee,
        deliveryDiscount,
        deliveryFee: standardFee - deliveryDiscount,
        total: subtotal + standardFee - deliveryDiscount
      };
    },

    /** Create one order for one shop (stock already taken). */
    create(email, items, user, shop, options) {
      const clean = items.map(i => ({ id: i.id, name: i.name, price: Number(i.price), qty: Number(i.qty) }));
      const now = Date.now();
      const number = 'BL-' + bumpSeq(SEQ_KEY, 1042);
      const seller = shop && window.BizAuth ? BizAuth.getUser(shop.email) : null;
      const km = 2.4;
      const parts = String((user && user.address) || '').split(',').map(x => x.trim()).filter(Boolean);
      const order = {
        number,
        customerEmail: norm(email),
        customerName: (user && user.businessName) || (user && user.name) || '',
        buyerType: (user && user.accountType) || 'customer',
        isDemo: !!(options && options.isDemo),
        autoPrepare: !!(options && options.autoPrepare),
        demoWarning: (options && options.demoWarning) || '',
        shopEmail: shop ? norm(shop.email) : null,
        shopName: shop ? shop.name : '',
        shopAddress: seller && seller.address || '',
        items: clean,
        total: clean.reduce((s, i) => s + i.price * i.qty, 0),
        deliveryFee: Number(options && options.deliveryFee) || 0,
        deliveryDiscount: Number(options && options.deliveryDiscount) || 0,
        poolingShopCount: Number(options && options.poolingShopCount) || 0,
        amountDue: clean.reduce((s, i) => s + i.price * i.qty, 0)
          + (Number(options && options.deliveryFee) || 0)
          - (Number(options && options.deliveryDiscount) || 0),
        address: (user && user.address) || '',
        dropArea: parts[1] || parts[0] || '',
        phone: (user && user.phone) || '',
        km: Math.round(km * 10) / 10,
        payout: options && options.isDemo ? 0 : Math.round(PAY.base + km * PAY.perKm),
        routePool: options && options.routePool || null,
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

    createDemoCustomerOrder(shopEmail, loginToken) {
      const shop = window.BizAuth && BizAuth.getUser(shopEmail);
      if (!shop || shop.accountType !== 'business' || shop.businessType !== 'local-shop') {
        return { ok: false, reason: 'A local shop account is required to create a demo customer order.' };
      }
      const markerKey = 'bizlink_demo_order_generated_' + norm(shopEmail);
      if (localStorage.getItem(markerKey) === String(loginToken)) return { ok: true, alreadyCreated: true };
      const products = window.BizProducts
        ? BizProducts.byShop(shopEmail).filter(item => Number(item.stock) > 0)
        : [];
      if (!products.length) return { ok: false, reason: 'Add a product to this local shop before creating a demo order.' };
      const product = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * Math.min(3, Math.floor(Number(product.stock)))) + 1;
      const customerNumber = Math.floor(Math.random() * 9000) + 1000;
      const customerName = ['Lerato Mokoena', 'Sipho Dlamini', 'Thandi Nkosi', 'Bongani Khumalo'][Math.floor(Math.random() * 4)];
      const fakeCustomer = {
        accountType: 'customer',
        name: customerName,
        address: '999 Nowhere Street, Fakeville, Exampleland',
        phone: '000-000-0000'
      };
      const order = this.create('demo-customer-' + customerNumber + '@example.invalid', [{
        id: product.id,
        name: product.name,
        price: product.price,
        qty
      }], fakeCustomer, { email: shop.email, name: shop.businessName }, {
        isDemo: true,
        autoPrepare: true,
        demoWarning: 'Simulated customer and intentionally false delivery details.'
      });
      localStorage.setItem(markerKey, String(loginToken));
      return { ok: true, order };
    },

    list(email) { return load(email).sort((a, b) => b.placedAt - a.placedAt); },
    find(email, number) { return load(email).find(o => o.number === number) || null; },

    status(order, now) {
      if (!isAutopilot(order)) {
        const cancelled = !!order.cancelledAt || order.state === 'cancelled' || order.state === 'declined';
        const i = STATE_IDX[order.state] != null ? STATE_IDX[order.state] : 0;
        const done = !cancelled && order.state === 'delivered';
        return {
          idx: i, cancelled, delivered: done, active: !cancelled && !done,
          key: cancelled ? 'cancelled' : STAGES[i].key,
          label: cancelled ? (order.state === 'declined' ? 'Declined' : 'Cancelled') : ({
            placed: 'Placed', accepted: 'Confirmed', preparing: 'Being prepared',
            ready: 'Packed · waiting for driver', at_shop: 'Driver at supplier',
            picked_up: 'Out for delivery', on_trip: 'Out for delivery', arrived: 'Driver arrived', delivered: 'Delivered'
          }[order.state] || STAGES[i].pill)
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
      if (!isAutopilot(order)) return !order.cancelledAt && (order.state === 'placed' || order.state === 'accepted');
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
      if (!isAutopilot(order)) { const t = order.times || {}; return [t.placed, t.accepted, t.preparing || t.accepted, t.picked_up, t.delivered][i] || order.placedAt; }
      return order.placedAt + (i === 0 ? 0 : bounds(order)[i - 1]); },
    /** The delivery time we originally promised. */
    etaTime(order) {
      if (!isAutopilot(order)) {
        const t = order.times || {};
        if (t.on_trip) return t.on_trip + tripMs(order);
        if (t.picked_up) return t.picked_up + tripMs(order) + (DEMO ? 15e3 : 2 * 60e3);
        return order.placedAt + (DEMO ? 4 * 60e3 : 35 * 60e3);
      }
      return order.placedAt + bounds(order)[2] + DUR[3]; },
    /** When it will actually arrive (later than promised if delayed). */
    actualEnd(order) {
      if (!isAutopilot(order)) {
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
      return !DEMO && s.active && (now || Date.now()) > this.etaTime(order);
    },

    /** Driver progress along the route (0–1), minutes left and km left. */
    live(order, now) {
      now = now || Date.now();
      if (!isAutopilot(order)) {
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

    MAX_BATCH_SIZE,
    forShop(shopEmail) { return loadAll().filter(o => o.shopEmail === norm(shopEmail)).sort((a, b) => b.placedAt - a.placedAt); },
    forDriver(driverEmail) { return loadAll().filter(o => o.driverEmail === norm(driverEmail)).sort((a, b) => b.placedAt - a.placedAt); },
    batchForOrder(number) { return loadBatches().find(batch => batch.orderNumbers.includes(number)) || null; },
    batchAwaitingShop(number, shopEmail) {
      const batch = this.batchForOrder(number);
      const stop = batch && batch.shopStops[batch.currentShopIndex];
      return !!batch && batch.status === 'awaiting_shop' && stop && stop.email === norm(shopEmail)
        && stop.orderNumbers[0] === number;
    },
    activeBatchFor(driverEmail) {
      return loadBatches().find(batch => batch.driverEmail === norm(driverEmail) && batch.status !== 'completed') || null;
    },
    batchOrders(batch) {
      const all = loadAll();
      return batch.orderNumbers.map(number => all.find(order => order.number === number)).filter(Boolean);
    },
    /** Ready orders sharing a suburb or town form one request, capped at five orders. */
    availableBatches(driverEmail) {
      const ready = loadAll().filter(order => order.state === 'ready' && !order.driverEmail && !order.cancelledAt)
        .sort((a, b) => (a.times.ready || a.placedAt) - (b.times.ready || b.placedAt));
      const driver = driverEmail && window.BizAuth ? BizAuth.getUser(driverEmail) : null;
      const remaining = driver && window.BizLocation
        ? BizLocation.sortByNearby(ready, driver, order => ({ address: order.address }))
        : ready;
      const groups = [];
      while (remaining.length) {
        const first = remaining.shift();
        const compatible = [];
        for (let i = 0; i < remaining.length && compatible.length < MAX_BATCH_SIZE - 1;) {
          const sameArea = window.BizLocation
            ? BizLocation.areaRank(first.address, remaining[i].address) <= 1
            : String(first.dropArea || '').trim().toLowerCase() === String(remaining[i].dropArea || '').trim().toLowerCase();
          if (sameArea) compatible.push(...remaining.splice(i, 1));
          else i++;
        }
        const orders = [first].concat(compatible.slice(0, MAX_BATCH_SIZE - 1));
        const parts = String(first.dropArea || first.address || '').split(',').map(part => part.trim()).filter(Boolean);
        groups.push({
          orders,
          destinationArea: parts.slice(-2).join(', '),
          orderNumbers: orders.map(order => order.number),
          pickupCount: new Set(orders.map(order => order.shopEmail)).size,
          payout: orders.reduce((total, order) => total + (order.isDemo ? 0 : order.payout || 0), 0)
        });
      }
      return groups;
    },
    acceptBatch(orderNumbers, driverEmail) {
      const driver = window.BizAuth && BizAuth.getUser(driverEmail);
      if (!driver || driver.accountType !== 'delivery') return { ok: false, reason: 'Only a signed-in driver can accept a delivery batch.' };
      if (!this.isOnline(driverEmail)) return { ok: false, reason: 'Go online before accepting delivery batches.' };
      if (this.activeBatchFor(driverEmail) || this.activeFor(driverEmail)) {
        return { ok: false, reason: 'Finish your current delivery batch first.' };
      }
      const numbers = Array.from(new Set(orderNumbers || []));
      if (!numbers.length || numbers.length > MAX_BATCH_SIZE) return { ok: false, reason: 'This delivery batch is not valid.' };
      const available = this.availableBatches(driverEmail).find(batch =>
        numbers.every(number => batch.orderNumbers.includes(number)));
      if (!available) return { ok: false, reason: 'These deliveries are no longer available together.' };
      const all = loadAll();
      const orders = numbers.map(number => all.find(order => order.number === number));
      if (orders.some(order => !order || order.state !== 'ready' || order.driverEmail || order.cancelledAt)) {
        return { ok: false, reason: 'One or more deliveries have already been accepted.' };
      }
      const shops = [];
      orders.forEach(order => {
        let stop = shops.find(item => item.email === order.shopEmail);
        if (!stop) {
          const shopUser = window.BizAuth && BizAuth.getUser(order.shopEmail);
          stop = {
            email: order.shopEmail,
            name: order.shopName || (shopUser && shopUser.businessName) || 'Shop',
            address: (shopUser && shopUser.address) || order.shopAddress || '',
            phone: (shopUser && shopUser.phone) || '',
            orderNumbers: []
          };
          shops.push(stop);
        }
        stop.orderNumbers.push(order.number);
      });
      const batch = {
        id: 'DB-' + bumpSeq(BATCH_SEQ_KEY, 1000),
        driverEmail: norm(driverEmail),
        orderNumbers: numbers,
        shopStops: shops,
        status: 'to_shop',
        currentShopIndex: 0,
        currentDeliveryIndex: 0,
        createdAt: Date.now(),
        completedAt: null
      };
      const now = Date.now();
      orders.forEach(order => {
        order.driverEmail = norm(driverEmail);
        order.batchId = batch.id;
        order.times.driverAccepted = now;
        order.shopEtaAt = now + (DEMO ? 90e3 : (6 + (numOf(order) % 5)) * 60e3);
      });
      saveAll(all);
      const batches = loadBatches();
      batches.push(batch);
      saveBatches(batches);
      return { ok: true, batch };
    },
    markBatchArrived(batchId, driverEmail) {
      let result = { ok: false, reason: 'This pickup has changed.' };
      const batches = loadBatches();
      const batch = batches.find(item => item.id === batchId && item.driverEmail === norm(driverEmail));
      if (!batch || batch.status !== 'to_shop') return result;
      const stop = batch.shopStops[batch.currentShopIndex];
      const all = loadAll();
      const stopOrders = stop.orderNumbers.map(number => all.find(item => item.number === number));
      if (stopOrders.some(order => !order || order.state !== 'ready' || order.batchId !== batch.id)) return result;
      const now = Date.now();
      stop.orderNumbers.forEach(number => {
        const order = all.find(item => item.number === number);
        if (order && order.state === 'ready' && order.batchId === batch.id) {
          order.state = 'at_shop';
          order.times.at_shop = now;
        }
      });
      batch.status = 'awaiting_shop';
      batch.updatedAt = now;
      saveAll(all);
      saveBatches(batches);
      result = { ok: true, batch };
      return result;
    },
    confirmShopHandoff(batchId, shopEmail) {
      const batches = loadBatches();
      const batch = batches.find(item => item.id === batchId);
      if (!batch || batch.status !== 'awaiting_shop') return false;
      const stop = batch.shopStops[batch.currentShopIndex];
      if (!stop || stop.email !== norm(shopEmail)) return false;
      const all = loadAll();
      const stopOrders = stop.orderNumbers.map(number => all.find(item => item.number === number));
      if (stopOrders.some(order => !order || order.state !== 'at_shop' || order.batchId !== batch.id)) return false;
      const now = Date.now();
      stop.orderNumbers.forEach(number => {
        const order = all.find(item => item.number === number);
        if (order && order.state === 'at_shop' && order.batchId === batch.id) {
          order.state = 'picked_up';
          order.times.picked_up = now;
        }
      });
      batch.currentShopIndex++;
      if (batch.currentShopIndex < batch.shopStops.length) {
        batch.status = 'to_shop';
      } else {
        batch.status = 'delivering';
        batch.currentDeliveryIndex = 0;
        batch.orderNumbers.forEach(number => {
          const order = all.find(item => item.number === number);
          if (order && order.state === 'picked_up') {
            order.state = 'on_trip';
            order.times.on_trip = now;
          }
        });
      }
      batch.updatedAt = now;
      saveAll(all);
      saveBatches(batches);
      return true;
    },
    confirmBatchDelivery(batchId, orderNumber, driverEmail) {
      const batches = loadBatches();
      const batch = batches.find(item => item.id === batchId && item.driverEmail === norm(driverEmail));
      if (!batch || batch.status !== 'delivering' || batch.orderNumbers[batch.currentDeliveryIndex] !== orderNumber) return false;
      const all = loadAll();
      const order = all.find(item => item.number === orderNumber && item.batchId === batch.id && item.state === 'on_trip');
      if (!order) return false;
      const now = Date.now();
      order.state = 'delivered';
      order.times.delivered = now;
      batch.currentDeliveryIndex++;
      if (batch.currentDeliveryIndex >= batch.orderNumbers.length) {
        batch.status = 'completed';
        batch.completedAt = now;
      }
      batch.updatedAt = now;
      saveAll(all);
      saveBatches(batches);
      return true;
    },
    /** Ready for pickup and nobody has taken it yet. */
    openJobs(driverEmail) {
      const jobs = loadAll().filter(o => o.state === 'ready' && !o.driverEmail && !o.cancelledAt)
        .sort((a, b) => (a.times.ready || a.placedAt) - (b.times.ready || b.placedAt));
      if (driverEmail && window.BizLocation && window.BizAuth) {
        const driver = BizAuth.getUser(driverEmail);
        return BizLocation.sortByNearby(jobs, driver, order => {
          const shopUser = BizAuth.getUser(order.shopEmail);
          const pickup = shopUser || { address: order.shopAddress };
          return { address: pickup.address };
        });
      }
      return jobs.sort((a, b) => (a.times.ready || a.placedAt) - (b.times.ready || b.placedAt));
    },
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
