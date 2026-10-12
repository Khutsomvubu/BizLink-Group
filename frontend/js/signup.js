/* signup.html — create account, then session with initials */
(function () {
  const $ = id => document.getElementById(id);
  let accountType = 'customer';

  document.querySelectorAll('.acct-type').forEach(btn => {
    btn.addEventListener('click', () => {
      accountType = btn.dataset.type;
      $('account-type').value = accountType;
      document.querySelectorAll('.acct-type').forEach(b => {
        const on = b === btn;
        b.classList.toggle('border-blue-600', on);
        b.classList.toggle('bg-blue-50/50', on);
        b.classList.toggle('border-slate-200', !on);
        b.classList.toggle('bg-white', !on);
        b.classList.toggle('active', on);
      });
      syncRoleFields();
    });
  });

  /* Show only the extra fields this role needs. */
  function syncRoleFields() {
    const biz = accountType === 'business', drv = accountType === 'delivery';
    $('biz-fields').classList.toggle('hidden', !biz);
    $('driver-fields').classList.toggle('hidden', !drv);
    $('plate-wrap').classList.toggle('hidden', drv && $('signup-vehicle').value === 'Bicycle');
    $('address-label').textContent = biz ? 'Shop address' : drv ? 'Home area' : 'Address';
    $('address-hint').textContent = biz ? 'Where drivers collect orders from' : drv ? 'Helps us show you jobs near you' : 'Used for deliveries and shown on your profile';
  }
  $('signup-vehicle').addEventListener('change', syncRoleFields);

  $('toggle-pw').addEventListener('click', () => {
    const input = $('signup-password');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    $('toggle-pw').textContent = show ? 'Hide' : 'Show';
  });

  $('signup-password').addEventListener('input', () => {
    const v = $('signup-password').value;
    const rules = BizAuth.rules;
    document.querySelectorAll('#pw-rules [data-rule]').forEach(li => {
      const ok = rules[li.dataset.rule](v);
      li.style.color = ok ? '#059669' : '';
    });
  });

  function toast(msg, ok) {
    const el = $('signup-toast');
    el.textContent = msg;
    el.className = 'text-xs rounded-xl px-3 py-2 mb-3 ' + (ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200');
  }

  $('signup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = ($('signup-name').value || '').trim();
    const email = ($('signup-email').value || '').trim().toLowerCase();
    const phone = ($('signup-phone').value || '').trim();
    const address = ($('signup-address').value || '').trim();
    const password = $('signup-password').value;

    if (!window.BizAuth || !BizAuth.supported()) {
      toast('Open the app from http://localhost or https so sign-up works.');
      return;
    }
    if (!name) { toast('Please enter your full name.'); return; }
    if (!BizAuth.phoneOk(phone)) { toast('Please enter a valid phone number (e.g. 082 123 4567).'); return; }
    if (address.length < 5) { toast('Please enter your address.'); return; }
    const businessName = ($('signup-business').value || '').trim();
    const vehicleType = $('signup-vehicle').value;
    const plate = ($('signup-plate').value || '').trim().toUpperCase();
    if (accountType === 'business' && businessName.length < 2) { toast('Please enter your business name.'); return; }
    if (accountType === 'delivery' && vehicleType !== 'Bicycle' && plate.length < 3) { toast('Please enter your vehicle’s number plate.'); return; }
    if (!BizAuth.passwordOk(password)) {
      toast('Password needs 8+ characters with a letter, a number and a symbol.');
      return;
    }

    const btn = $('signup-btn');
    btn.disabled = true;
    btn.textContent = 'Creating…';

    try {
      await BizAuth.ready;
      const created = await BizAuth.register(email, password, {
        name,
        phone,
        address,
        accountType,
        businessName: accountType === 'business' ? businessName : '',
        vehicleType: accountType === 'delivery' ? vehicleType : '',
        plate: accountType === 'delivery' && vehicleType !== 'Bicycle' ? plate : ''
      });
      if (!created) {
        toast('An account with this email already exists. Please sign in.');
        btn.disabled = false;
        btn.textContent = 'Create Account →';
        return;
      }

      const user = BizAuth.getUser(email);
      BizSession.set(user);
      toast('Welcome, ' + user.initials + '! Account created.', true);
      setTimeout(() => { location.href = BizSession.homeFor(user.accountType); }, 600);
    } catch (err) {
      console.error(err);
      toast('Something went wrong. Please try again.');
      btn.disabled = false;
      btn.textContent = 'Create Account →';
    }
  });

  syncRoleFields();
  if (window.BizSession) BizSession.redirectIfLoggedIn();
})();
