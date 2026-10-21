(function () {
  const $ = id => document.getElementById(id);

  // Pre-fill email from password reset or query
  try {
    const done = sessionStorage.getItem('bizlink_reset_done');
    if (done) {
      sessionStorage.removeItem('bizlink_reset_done');
      $('signin-email').value = done;
      $('signin-password').value = '';
      toast('Password updated. Sign in with your new password.', true);
    }
  } catch (e) {}

  const qEmail = new URLSearchParams(location.search).get('email');
  if (qEmail) $('signin-email').value = qEmail;

  document.querySelectorAll('[data-demo-email]').forEach(button => {
    button.addEventListener('click', () => {
      $('signin-email').value = button.dataset.demoEmail;
      $('signin-password').value = 'password123';
      document.querySelectorAll('[data-demo-email]').forEach(profile => {
        profile.setAttribute('aria-pressed', profile === button ? 'true' : 'false');
      });
      $('signin-toast').className = 'text-xs rounded-xl px-3 py-2 mb-3 bg-blue-50 text-blue-700 border border-blue-200';
      $('signin-toast').textContent = 'Demo login filled in. Select Sign In to continue.';
    });
  });

  $('toggle-pw').addEventListener('click', () => {
    const input = $('signin-password');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('toggle-pw').textContent = show ? 'Hide' : 'Show';
  });

  function toast(msg, ok) {
    const el = $('signin-toast');
    el.textContent = msg;
    el.className = 'text-xs rounded-xl px-3 py-2 mb-3 ' + (ok
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : 'bg-red-50 text-red-700 border border-red-200');
  }

  $('signin-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = ($('signin-email').value || '').trim().toLowerCase();
    const password = $('signin-password').value;

    if (!window.BizAuth || !BizAuth.supported()) {
      toast('Open the app from http://localhost or https so sign-in works.');
      return;
    }

    const btn = $('signin-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    try {
      await BizAuth.ready;
      if (!(await BizAuth.verify(email, password))) {
        toast('Incorrect email or password. Use “Forgot password?” to reset it.');
        btn.disabled = false;
        btn.textContent = 'Sign In →';
        return;
      }
      const user = BizAuth.getUser(email);
      BizSession.set(user, { newLogin: true });
      location.href = BizSession.homeFor(user.accountType);
    } catch (err) {
      console.error(err);
      toast('Something went wrong. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Sign In →';
    }
  });

  if (window.BizSession) BizSession.redirectIfLoggedIn();
})();
