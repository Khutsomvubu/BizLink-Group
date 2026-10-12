/* ============================================================
   BizLink — logged-in session (localStorage)
   ============================================================ */
(function () {
  const KEY = 'bizlink_session';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }

  // Where each role lands, and which pages belong to it.
  const HOME = { customer: 'browse.html', business: 'business.html', delivery: 'driver.html' };
  const roleOf = s => (s && HOME[s.accountType]) ? s.accountType : 'customer';

  const BizSession = {
    HOME,
    get() { return load(); },

    /** Home page for a role (or for the signed-in user). */
    homeFor(role) { return HOME[role] || HOME.customer; },

    set(user) {
      const payload = {
        email: user.email,
        name: user.name || '',
        accountType: HOME[user.accountType] ? user.accountType : 'customer',
        businessName: user.businessName || '',
        vehicleType: user.vehicleType || '',
        plate: user.plate || '',
        phone: user.phone || '',
        address: user.address || '',
        created: user.created || null,
        initials: user.initials || (window.BizAuth && BizAuth.initialsFromName(user.name || user.email)) || '?',
        at: Date.now()
      };
      localStorage.setItem(KEY, JSON.stringify(payload));
      return payload;
    },

    clear() {
      try { localStorage.removeItem(KEY); } catch (e) {}
    },

    /**
     * Protected page that belongs to one role. Not signed in → sign-in.
     * Signed in as another role → that role's own home (e.g. a driver who
     * types browse.html lands back on driver.html).
     */
    requireRole(role, redirectTo) {
      const s = load();
      if (!s || !s.email) {
        location.replace(redirectTo || 'signin.html');
        return null;
      }
      if (roleOf(s) !== role) {
        location.replace(HOME[roleOf(s)]);
        return null;
      }
      return s;
    },

    /** Redirect to signin if not logged in. Call on protected pages. */
    requireAuth(redirectTo) {
      const s = load();
      if (!s || !s.email) {
        location.href = redirectTo || 'signin.html';
        return null;
      }
      return s;
    },

    /** If already logged in, send to the role's home. Call on landing/auth pages. */
    redirectIfLoggedIn() {
      const s = load();
      if (s && s.email) {
        location.href = HOME[roleOf(s)];
        return true;
      }
      return false;
    }
  };

  window.BizSession = BizSession;
})();
