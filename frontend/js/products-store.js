/* ============================================================
   BizLink — shops + products (localStorage, shared by all roles)

   BizShops    one record per business account: open / closed.
   BizProducts the single product list. Customers read it on Browse;
               a business edits its own products on the Products tab.

   Product: { id, shopEmail, vendor, name, category, price, stock, inStock,
              rating, ratings, tile:{c1,c2,shape,brand,sub,size}, createdAt }
   stock    = units on hand (number)
   inStock  = the business's own in/out switch (false = hidden from buying)
   ============================================================ */
(function () {
  const PKEY = 'bizlink_products';
  const SKEY = 'bizlink_shops';
  const SEEDED = 'bizlink_products_seeded';
  const LOW = 6;                                  // "Only N left" at or below this (matches the old Browse: 6 and 4 were "low")

  const CATEGORIES = ['Groceries', 'Drinks', 'Household', 'Personal Care', 'Stationery'];
  const PALETTE = {
    Groceries:       [['#fde7a8', '#d9831f'], ['#fdba74', '#c2410c'], ['#fde68a', '#0f766e']],
    Drinks:          [['#f87171', '#b91c1c'], ['#fdba74', '#ea580c'], ['#93c5fd', '#1d4ed8']],
    Household:       [['#93c5fd', '#1d4ed8'], ['#fde047', '#65a30d'], ['#c4b5fd', '#6d28d9']],
    'Personal Care': [['#f9a8d4', '#9333ea'], ['#fca5a5', '#be123c'], ['#99f6e4', '#0f766e']],
    Stationery:      [['#86efac', '#059669'], ['#fcd34d', '#b45309'], ['#a5b4fc', '#4338ca']]
  };
  const SHAPE = { Groceries: 'bag', Drinks: 'bottle', Household: 'box', 'Personal Care': 'box', Stationery: 'box' };

  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const norm = e => String(e || '').trim().toLowerCase();

  /* ---------- starter catalogue (the original 12 Browse products) ---------- */
  // [id, name, shop email, category, price, rating, ratings, stock, c1, c2, shape, brand, sub, size]
  const SEED = [
    ['p1',  'Iwisa Super Maize Meal 10kg',        'ubuntu@example.com',     'Groceries',     119.99, 4.8, 120, 40, '#fde7a8', '#d9831f', 'bag',    'IWISA',     'MAIZE MEAL',          '10kg'],
    ['p2',  'Sunfoil Cooking Oil 2L',             'shop@example.com',       'Groceries',      64.99, 4.6,  85, 30, '#fca5a5', '#ef4444', 'bottle', 'SUNFOIL',   'COOKING OIL',         '2L'],
    ['p3',  'Coca-Cola Original 500ml (6 Pack)',  'mamsi@example.com',      'Drinks',         69.99, 4.7, 210, 60, '#f87171', '#b91c1c', 'bottle', 'Coca-Cola', 'ORIGINAL',            '6 × 500ml'],
    ['p4',  'Sasko Brown Bread 700g',             'freshstop@example.com',  'Groceries',      16.99, 4.5,  64,  6, '#f6b445', '#b45309', 'bag',    'SASKO',     'BROWN BREAD',         '700g'],
    ['p5',  'Skip Washing Powder 2kg',            'homecare@example.com',   'Household',      54.99, 4.4,  97, 25, '#93c5fd', '#1d4ed8', 'box',    'SKIP',      'WASHING POWDER',      '2kg'],
    ['p6',  'BIC Pens (10 Pack)',                 'edustation@example.com', 'Stationery',     27.99, 4.3,  41, 50, '#86efac', '#059669', 'box',    'BIC',       'BALLPOINT PENS',      '10 pack'],
    ['p7',  'Sunlight Dishwashing Liquid 750ml',  'homecare@example.com',   'Household',      29.99, 4.5,  73, 35, '#fde047', '#65a30d', 'bottle', 'SUNLIGHT',  'DISH LIQUID',         '750ml'],
    ['p8',  'Lux Soap Bar 175g (3 Pack)',         'shop@example.com',       'Personal Care',  32.99, 4.6,  58,  4, '#f9a8d4', '#9333ea', 'box',    'LUX',       'SOFT TOUCH SOAP',     '3 × 175g'],
    ['p9',  'Colgate Toothpaste 100ml',           'ubuntu@example.com',     'Personal Care',  22.99, 4.7, 132, 45, '#fca5a5', '#be123c', 'box',    'COLGATE',   'TOTAL PROTECTION',    '100ml'],
    ['p10', 'Fanta Orange 2L',                    'mamsi@example.com',      'Drinks',         24.99, 4.4,  52,  0, '#fdba74', '#ea580c', 'bottle', 'FANTA',     'ORANGE',              '2L'],
    ['p11', 'Tastic Long Grain Rice 2kg',         'ubuntu@example.com',     'Groceries',      42.99, 4.6,  88, 38, '#fde68a', '#0f766e', 'bag',    'TASTIC',    'LONG GRAIN RICE',     '2kg'],
    ['p12', 'Koo Baked Beans 410g',               'freshstop@example.com',  'Groceries',      19.99, 4.5,  67, 55, '#fdba74', '#c2410c', 'box',    'KOO',       'BAKED BEANS',         '410g']
  ];

  function seedIfNeeded() {
    if (localStorage.getItem(SEEDED)) return;
    const shops = (window.BizAuth && BizAuth.DEMO_SHOPS) || [];
    const nameOf = e => (shops.find(s => s.email === e) || {}).name || '';
    const list = SEED.map(r => ({
      id: r[0], shopEmail: r[2], vendor: nameOf(r[2]), name: r[1], category: r[3],
      price: r[4], stock: r[7], inStock: r[7] > 0, rating: r[5], ratings: r[6],
      tile: { c1: r[8], c2: r[9], shape: r[10], brand: r[11], sub: r[12], size: r[13] },
      createdAt: 0
    }));
    // keep anything a business already added before seeding ran
    write(PKEY, list.concat(read(PKEY, []).filter(p => !list.some(x => x.id === p.id))));
    try { localStorage.setItem(SEEDED, '1'); } catch (e) {}
  }

  function allRaw() { seedIfNeeded(); return read(PKEY, []); }

  /* A tile for products that don't have a hand-made one. */
  function autoTile(p) {
    const pal = PALETTE[p.category] || PALETTE.Groceries;
    let h = 0; for (const ch of String(p.name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const c = pal[h % pal.length];
    const words = String(p.name).trim().split(/\s+/);
    return { c1: c[0], c2: c[1], shape: SHAPE[p.category] || 'box', brand: words[0].toUpperCase().slice(0, 12), sub: words.slice(1, 3).join(' ').toUpperCase().slice(0, 18), size: '' };
  }

  /* ---------- shops ---------- */
  const BizShops = {
    all() { return read(SKEY, {}); },
    get(email) {
      const rec = read(SKEY, {})[norm(email)] || {};
      return { email: norm(email), open: rec.open !== false };      // shops start open
    },
    isOpen(email) { return this.get(email).open; },
    setOpen(email, open) {
      const db = read(SKEY, {});
      db[norm(email)] = Object.assign({}, db[norm(email)], { open: !!open });
      write(SKEY, db);
    }
  };

  /* ---------- products ---------- */
  const BizProducts = {
    LOW, CATEGORIES,

    all() { return allRaw(); },
    get(id) { return allRaw().find(p => p.id === id) || null; },
    byShop(email) { return allRaw().filter(p => p.shopEmail === norm(email)); },

    tile(p) { return p.tile || autoTile(p); },

    /** 'out' | 'low' | 'in' — what the customer sees. */
    stockState(p) {
      if (!p.inStock || p.stock <= 0) return 'out';
      return p.stock <= LOW ? 'low' : 'in';
    },
    stockText(p) {
      const s = this.stockState(p);
      return s === 'out' ? 'Out of stock' : s === 'low' ? 'Only ' + p.stock + ' left' : 'In stock';
    },
    /** Can a customer buy qty of this right now? (shop open + stock) */
    available(p, qty) {
      return BizShops.isOpen(p.shopEmail) && p.inStock && p.stock >= (qty || 1);
    },

    /** Add a product for a shop. shop = { email, businessName }. Returns the product or { error }. */
    add(shop, f) {
      const v = validate(f);
      if (v) return { error: v };
      const list = allRaw();
      let n = list.reduce((m, p) => Math.max(m, parseInt(String(p.id).replace(/\D/g, ''), 10) || 0), 12) + 1;
      const p = {
        id: 'p' + n, shopEmail: norm(shop.email), vendor: shop.businessName || '',
        name: f.name.trim(), category: f.category, price: round2(f.price),
        stock: Math.floor(Number(f.stock)), inStock: f.inStock !== false && Number(f.stock) > 0,
        rating: 0, ratings: 0, tile: null, createdAt: Date.now()
      };
      list.push(p);
      write(PKEY, list);
      return p;
    },

    /** Edit fields of a product the shop owns. */
    update(shopEmail, id, f) {
      const list = allRaw();
      const p = list.find(x => x.id === id && x.shopEmail === norm(shopEmail));
      if (!p) return { error: 'Product not found.' };
      const v = validate(Object.assign({}, p, f));
      if (v) return { error: v };
      if (f.name != null) p.name = String(f.name).trim();
      if (f.category != null) p.category = f.category;
      if (f.price != null) p.price = round2(f.price);
      if (f.stock != null) { p.stock = Math.floor(Number(f.stock)); if (p.stock <= 0) p.inStock = false; }
      if (f.inStock != null) { p.inStock = !!f.inStock && p.stock > 0; p.autoOut = false; }
      write(PKEY, list);
      return p;
    },

    setInStock(shopEmail, id, inStock) { return this.update(shopEmail, id, { inStock }); },

    remove(shopEmail, id) {
      const list = allRaw();
      const next = list.filter(x => !(x.id === id && x.shopEmail === norm(shopEmail)));
      if (next.length === list.length) return false;
      write(PKEY, next);
      return true;
    },

    /** Keep the business name on its products in step with the account. */
    renameVendor(shopEmail, name) {
      const list = allRaw();
      list.forEach(p => { if (p.shopEmail === norm(shopEmail)) p.vendor = name; });
      write(PKEY, list);
    },

    /**
     * Take stock for an order, all-or-nothing.
     * items = [{ id, qty }]. Returns { ok:true } or { ok:false, reason }.
     */
    take(items) {
      const list = allRaw();
      for (const it of items) {
        const p = list.find(x => x.id === it.id);
        if (!p) return { ok: false, reason: it.name + ' is no longer sold.' };
        if (!BizShops.isOpen(p.shopEmail)) return { ok: false, reason: p.vendor + ' is closed right now.' };
        if (!p.inStock || p.stock < it.qty) return { ok: false, reason: p.stock > 0 && p.inStock ? 'Only ' + p.stock + ' of ' + p.name + ' left.' : p.name + ' is out of stock.' };
      }
      items.forEach(it => { const p = list.find(x => x.id === it.id); p.stock -= it.qty; if (p.stock <= 0) { p.stock = 0; p.inStock = false; p.autoOut = true; } });
      write(PKEY, list);
      return { ok: true };
    },
    /** Put stock back (declined / cancelled order). Products the order sold out come back in stock. */
    give(items) {
      const list = allRaw();
      items.forEach(it => { const p = list.find(x => x.id === it.id); if (p) { p.stock += it.qty; if (p.autoOut && p.stock > 0) { p.inStock = true; p.autoOut = false; } } });
      write(PKEY, list);
    }
  };

  function round2(n) { return Math.round(Number(n) * 100) / 100; }
  function validate(f) {
    if (!f || !String(f.name || '').trim()) return 'Enter a product name.';
    if (String(f.name).trim().length > 60) return 'Product name is too long (60 characters max).';
    if (!CATEGORIES.includes(f.category)) return 'Choose a category.';
    const price = Number(f.price);
    if (!isFinite(price) || price <= 0 || price > 100000) return 'Enter a price above R0.';
    const stock = Number(f.stock);
    if (!isFinite(stock) || stock < 0 || stock > 100000 || Math.floor(stock) !== stock) return 'Stock must be a whole number (0 or more).';
    return '';
  }

  window.BizShops = BizShops;
  window.BizProducts = BizProducts;
})();
