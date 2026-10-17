/* ============================================================
   BizLink — account store
   Accounts in localStorage; passwords salted + PBKDF2-SHA256.
   ============================================================ */
(function () {
  const KEY = 'bizlink_users';
  const SEEDED = 'bizlink_seeded';
  const SEEDED2 = 'bizlink_seeded_roles';
  const ITER = 150000;
  const ROLES = ['customer', 'business', 'delivery'];

  // The six shops behind the 12 starter products. All use password123.
  const DEMO_SHOPS = [
    { email: 'shop@example.com',      name: 'Kasi Essentials',   owner: 'Nomsa Zulu',      phone: '083 555 0101', address: '48 Vilakazi Street, Orlando West, Soweto', businessType: 'local-shop' },
    { email: 'ubuntu@example.com',    name: 'Ubuntu Suppliers',  owner: 'Themba Sithole',  phone: '083 555 0102', address: '9 Chris Hani Road, Diepkloof, Soweto', businessType: 'supplier' },
    { email: 'mamsi@example.com',     name: "Mamsi's Tuckshop",  owner: 'Mamsi Dube',      phone: '083 555 0103', address: '22 Mooki Street, Orlando East, Soweto', businessType: 'local-shop' },
    { email: 'freshstop@example.com', name: 'FreshStop Local',   owner: 'Pule Maseko',     phone: '083 555 0104', address: '3 Nkomo Street, Pimville, Soweto', businessType: 'local-shop' },
    { email: 'homecare@example.com',  name: 'HomeCare Hub',      owner: 'Lindiwe Radebe',  phone: '083 555 0105', address: '17 Klipspruit Valley Road, Soweto', businessType: 'local-shop' },
    { email: 'edustation@example.com',name: 'EduStation',        owner: 'Sam Mokoena',     phone: '083 555 0106', address: '6 Maponya Mall Drive, Klipspruit, Soweto', businessType: 'local-shop' }
  ];
  const enc = new TextEncoder();

  const norm = e => String(e || '').trim().toLowerCase();
  const hex = buf => Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, '0')).join('');
  const fromHex = h => new Uint8Array(h.match(/.{2}/g).map(x => parseInt(x, 16)));

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }

  async function derive(password, saltHex, iter) {
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: iter }, key, 256);
    return hex(bits);
  }
  function newSalt() { const b = new Uint8Array(16); crypto.getRandomValues(b); return hex(b); }
  function same(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

  /** "Mpho Ramarumo" → "MR" */
  function initialsFromName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const BizAuth = {
    supported() { return !!(window.crypto && crypto.subtle); },

    rules: {
      len: v => v.length >= 8,
      letter: v => /[A-Za-z]/.test(v),
      num: v => /\d/.test(v),
      sym: v => /[^A-Za-z0-9]/.test(v)
    },
    /** 9–15 digits; spaces, +, -, ( ) allowed. */
    phoneOk(v) {
      const s = String(v || '').trim();
      return /^[0-9+()\s-]+$/.test(s) && s.replace(/\D/g, '').length >= 9 && s.replace(/\D/g, '').length <= 15;
    },
    passwordOk(v) { return Object.values(this.rules).every(fn => fn(v)); },
    initialsFromName,

    roles: ROLES,
    DEMO_SHOPS,

    exists(email) { return Object.prototype.hasOwnProperty.call(load(), norm(email)); },

    getUser(email) {
      const u = load()[norm(email)];
      if (!u) return null;
      return {
        email: norm(email),
        name: u.name || '',
        accountType: ROLES.includes(u.accountType) ? u.accountType : 'customer',
        businessName: u.businessName || '',
        businessType: ['local-shop', 'supplier'].includes(u.businessType)
          ? u.businessType
          : u.accountType === 'business'
            ? ((DEMO_SHOPS.find(sh => sh.email === norm(email)) || {}).businessType || 'local-shop')
            : '',
        vehicleType: u.vehicleType || '',
        plate: u.plate || '',
        initials: initialsFromName(u.name || email),
        phone: u.phone || '',
        address: u.address || '',
        created: u.created,
        demo: !!u.demo
      };
    },

    /** Update name / phone / address for an existing account. */
    updateProfile(email, fields) {
      email = norm(email);
      const db = load();
      if (!db[email]) return false;
      ['name', 'phone', 'address', 'businessName', 'vehicleType', 'plate'].forEach(k => {
        if (fields && typeof fields[k] === 'string') db[email][k] = fields[k].trim();
      });
      save(db);
      return true;
    },

    async register(email, password, extra) {
      email = norm(email);
      const db = load();
      if (db[email]) return false;
      const salt = newSalt();
      db[email] = Object.assign({ salt, iter: ITER, hash: await derive(password, salt, ITER), created: Date.now() }, extra || {});
      save(db);
      return true;
    },

    async verify(email, password) {
      const u = load()[norm(email)];
      if (!u) { await derive(password, newSalt(), ITER); return false; }
      return same(await derive(password, u.salt, u.iter || ITER), u.hash);
    },

    async setPassword(email, password) {
      email = norm(email);
      const db = load();
      if (!db[email]) return false;
      const salt = newSalt();
      db[email].salt = salt; db[email].iter = ITER;
      db[email].hash = await derive(password, salt, ITER);
      db[email].passwordChangedAt = Date.now();
      save(db);
      return true;
    },

    async seedDemo() {
      try {
        if (!this.supported()) return;
        if (!localStorage.getItem(SEEDED)) {
          await this.register('you@example.com', 'password123', { name: 'Mpho Ramarumo', accountType: 'customer', phone: '082 123 4567', address: '12 Vilakazi Street, Orlando West, Soweto', demo: true });
          localStorage.setItem(SEEDED, '1');
        }
        // Demo shops (own the 12 starter products) and one demo driver. Password: password123
        if (!localStorage.getItem(SEEDED2)) {
          for (const sh of DEMO_SHOPS) {
            await this.register(sh.email, 'password123', { name: sh.owner, accountType: 'business', businessName: sh.name, businessType: sh.businessType, phone: sh.phone, address: sh.address, demo: true });
          }
          await this.register('driver@example.com', 'password123', { name: 'Sipho Dlamini', accountType: 'delivery', vehicleType: 'Scooter', plate: 'GP 48 21 TR', phone: '071 555 0142', address: '5 Mofokeng Street, Meadowlands, Soweto', demo: true });
          localStorage.setItem(SEEDED2, '1');
        }
      } catch (e) { /* storage blocked */ }
    }
  };

  window.BizAuth = BizAuth;
  BizAuth.ready = BizAuth.seedDemo();
})();
