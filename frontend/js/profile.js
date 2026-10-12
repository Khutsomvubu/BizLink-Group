/* profile.html — shows the details saved at sign-up; lets the user edit name, phone and address */
(function () {
  const session = BizSession.requireAuth('signin.html');   // shared by every role
  if (!session) return;

  const $ = id => document.getElementById(id);
  const TYPES = { customer: 'Customer', business: 'Business', delivery: 'Delivery' };
  let toastTimer;

  function currentUser() {
    // Account store is the source of truth; session is the fallback.
    return (window.BizAuth && BizAuth.getUser(session.email)) || session;
  }

  function setValue(id, value, emptyText) {
    const el = $(id);
    if (value) { el.textContent = value; el.classList.remove('empty'); }
    else { el.textContent = emptyText || 'Not added yet'; el.classList.add('empty'); }
  }

  function render() {
    const u = currentUser();
    const initials = (window.BizAuth && BizAuth.initialsFromName(u.name || u.email)) || session.initials || '?';
    const type = TYPES[u.accountType] || 'Customer';

    $('profile-avatar').textContent = initials;
    $('profile-name').textContent = u.name || 'Member';
    $('profile-type').textContent = type;

    setValue('d-name', u.name);
    setValue('d-email', u.email);
    setValue('d-phone', u.phone);
    setValue('d-address', u.address);
    setValue('d-type', type);
    setValue('d-business', u.businessName);
    setValue('d-vehicle', u.vehicleType);
    setValue('d-plate', u.plate);
    $('d-plate-row').classList.toggle('hidden', u.accountType !== 'delivery' || u.vehicleType === 'Bicycle');

    // Show only the rows, fields and links that belong to this role.
    document.querySelectorAll('[data-role-only]').forEach(el => {
      if (el.id === 'd-plate-row') return;
      el.classList.toggle('hidden', el.dataset.roleOnly !== u.accountType);
    });
    $('e-address-label').textContent = u.accountType === 'business' ? 'Shop address' : 'Address';
    setValue('d-since', u.created
      ? new Date(u.created).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
      : '', 'Unknown');
  }

  function showForm(on) {
    $('details-view').classList.toggle('hidden', on);
    $('details-form').classList.toggle('hidden', !on);
    $('edit-btn').classList.toggle('hidden', on);
    $('form-err').classList.add('hidden');
    if (on) {
      const u = currentUser();
      $('e-name').value = u.name || '';
      $('e-phone').value = u.phone || '';
      $('e-address').value = u.address || '';
      $('e-business').value = u.businessName || '';
      $('e-vehicle').value = u.vehicleType || 'Scooter';
      $('e-plate').value = u.plate || '';
      $('e-name').focus();
    }
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  $('edit-btn').addEventListener('click', () => showForm(true));
  $('cancel-btn').addEventListener('click', () => showForm(false));

  $('details-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('e-name').value.trim();
    const phone = $('e-phone').value.trim();
    const address = $('e-address').value.trim();
    const err = $('form-err');
    const fail = msg => { err.textContent = msg; err.classList.remove('hidden'); };

    if (!name) return fail('Please enter your full name.');
    if (!BizAuth.phoneOk(phone)) return fail('Please enter a valid phone number (e.g. 082 123 4567).');
    if (address.length < 5) return fail('Please enter your address.');

    const u = currentUser();
    const fields = { name, phone, address };
    if (u.accountType === 'business') {
      fields.businessName = $('e-business').value.trim();
      if (fields.businessName.length < 2) return fail('Please enter your business name.');
    }
    if (u.accountType === 'delivery') {
      fields.vehicleType = $('e-vehicle').value;
      fields.plate = fields.vehicleType === 'Bicycle' ? '' : $('e-plate').value.trim().toUpperCase();
      if (fields.vehicleType !== 'Bicycle' && fields.plate.length < 3) return fail('Please enter your vehicle’s number plate.');
    }

    BizAuth.updateProfile(session.email, fields);
    if (fields.businessName && window.BizProducts) BizProducts.renameVendor(session.email, fields.businessName);
    BizSession.set(BizAuth.getUser(session.email));   // keeps initials + details in sync everywhere
    render();
    showForm(false);
    toast('Details saved');
  });

  $('signout-btn').addEventListener('click', () => {
    BizSession.clear();
    location.href = 'index.html';
  });

  render();
})();
