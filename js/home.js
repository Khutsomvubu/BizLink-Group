/* index.html — menu toggle + session redirect */
(function () {
  if (window.BizSession) {
    document.addEventListener('DOMContentLoaded', () => BizSession.redirectIfLoggedIn());
  }

  const btn = document.getElementById('home-menu-btn');
  const panel = document.getElementById('home-nav-panel');
  if (!btn || !panel) return;

  function setOpen(open) {
    panel.classList.toggle('open', open);
    if (open) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  btn.addEventListener('click', () => {
    setOpen(!panel.classList.contains('open'));
  });

  // Close menu after choosing a link
  panel.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => setOpen(false));
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') setOpen(false);
  });
})();
