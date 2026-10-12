/* Role pages (business / driver): guard + placeholder content until each screen is built. */
(function () {
  const role = document.body.dataset.role;
  const session = BizSession.requireRole(role);
  if (!session) return;
  const u = (window.BizAuth && BizAuth.getUser(session.email)) || session;
  document.getElementById('rp-who').textContent = role === 'business' ? (u.businessName || 'Your shop') : (u.name || 'Driver');
  document.getElementById('rp-detail').textContent = role === 'business'
    ? 'Business · ' + u.email
    : 'Delivery · ' + (u.vehicleType || 'Vehicle') + (u.plate ? ' · ' + u.plate : '');
})();
