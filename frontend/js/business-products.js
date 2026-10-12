/* Business Products — add, edit, in/out switch, delete. Customers see changes on Browse. */
(function () {
  const U = window.BizUI;
  const shop = U.me();
  if (!shop) return;
  const $ = id => document.getElementById(id);
  let filter = ['low', 'out'].indexOf(location.hash.slice(1)) >= 0 ? location.hash.slice(1) : 'all';

  function stockLine(p) {
    if (p.stock <= 0) return ['out', 'Out of stock'];
    if (!p.inStock) return ['off', p.stock + ' on hand · hidden from customers'];
    return [p.stock <= BizProducts.LOW ? 'low' : '', p.stock <= BizProducts.LOW ? 'Only ' + p.stock + ' left' : p.stock + ' in stock'];
  }

  function render() {
    const all = BizProducts.byShop(shop.email);
    const low = all.filter(p => p.stock > 0 && p.stock <= BizProducts.LOW).length;
    const out = all.filter(p => p.stock <= 0).length;
    $('bp-count').textContent = all.length ? `${all.length} product${all.length === 1 ? '' : 's'}${low ? ' · ' + low + ' low' : ''}${out ? ' · ' + out + ' out' : ''}` : '';
    document.querySelectorAll('#bp-chips .bz-chip').forEach(c => c.classList.toggle('active', c.dataset.f === filter));

    const list = all.filter(p => filter === 'all' || (filter === 'low' ? p.stock > 0 && p.stock <= BizProducts.LOW : p.stock <= 0))
      .sort((a, b) => a.name.localeCompare(b.name));
    $('bp-list').innerHTML = list.length ? '<div class="bp-list">' + list.map(p => {
      const t = BizProducts.tile(p), s = stockLine(p);
      return `<div class="bp-row">
        <button type="button" class="bp-main" data-edit="${U.esc(p.id)}" aria-label="Edit ${U.esc(p.name)}">
          <span class="bp-thumb" style="background:linear-gradient(135deg,${t.c1},${t.c2})">${U.esc(t.brand)}</span>
          <span class="bp-info"><span class="n">${U.esc(p.name)}</span>
            <span class="m" style="display:block"><b>${U.money(p.price)}</b> · ${U.esc(p.category)}</span>
            <span class="s ${s[0]}" style="display:block">${U.esc(s[1])}</span></span>
        </button>
        <label class="bz-switch bp-sw" title="Available to customers"><input type="checkbox" data-sw="${U.esc(p.id)}" ${p.inStock && p.stock > 0 ? 'checked' : ''} aria-label="${U.esc(p.name)} available to customers"></label>
      </div>`;
    }).join('') + '</div>' : '';

    const empty = $('bp-empty');
    empty.classList.toggle('hidden', list.length > 0);
    if (!list.length) {
      empty.innerHTML = all.length === 0
        ? '<b>No products yet</b>Add your first product and customers can start ordering it.'
        : '<b>Nothing here</b>' + (filter === 'low' ? 'No products are running low.' : 'Nothing is sold out.');
    }
  }

  function form(p) {
    const cats = BizProducts.CATEGORIES.map(c => `<option${p && p.category === c ? ' selected' : ''}>${U.esc(c)}</option>`).join('');
    const on = p ? p.inStock && p.stock > 0 : true;
    return `<form class="pf-form" novalidate style="padding:0">
      <label for="f-name">Product name</label><input id="f-name" maxlength="60" value="${p ? U.esc(p.name) : ''}" placeholder="e.g. Sunfoil Cooking Oil 2L" autocomplete="off">
      <label for="f-cat">Category</label><select id="f-cat">${cats}</select>
      <div class="row2"><div><label for="f-price">Price (R)</label><input id="f-price" inputmode="decimal" value="${p ? p.price : ''}" placeholder="0.00"></div>
      <div><label for="f-stock">Stock on hand</label><input id="f-stock" inputmode="numeric" value="${p ? p.stock : ''}" placeholder="0"></div></div>
      <div class="bp-hint">Customers see “Only N left” at ${BizProducts.LOW} or fewer.</div>
      <label class="bz-switch" style="margin-top:12px"><span>Available to customers</span><input type="checkbox" id="f-on" ${on ? 'checked' : ''}></label>
      <div class="err" id="f-err" role="alert"></div>
      <div class="bz-sheet-actions">${p ? '<button type="button" class="bz-btn danger" id="f-del" style="flex:0 0 32%">Delete</button>' : ''}
      <button type="submit" class="bz-btn primary">${p ? 'Save changes' : 'Add product'}</button></div></form>`;
  }

  function open(p) {
    const s = U.sheet(p ? 'Edit product' : 'Add product', form(p));
    const f = s.body.querySelector('form'), q = id => s.body.querySelector('#' + id);
    let touched = false;
    q('f-on').addEventListener('change', () => { touched = true; });
    q('f-stock').addEventListener('input', () => { if (!touched && Number(q('f-stock').value) > 0) q('f-on').checked = true; });
    f.addEventListener('submit', e => {
      e.preventDefault();
      const data = { name: q('f-name').value, category: q('f-cat').value, price: q('f-price').value, stock: q('f-stock').value, inStock: q('f-on').checked };
      const r = p ? BizProducts.update(shop.email, p.id, data) : BizProducts.add({ email: shop.email, businessName: shop.name }, data);
      if (r.error) { q('f-err').textContent = r.error; return; }
      s.close(); U.toast(p ? 'Changes saved' : r.name + ' added'); render();
    });
    if (p) {
      let armed = false;
      q('f-del').addEventListener('click', ev => {
        if (!armed) { armed = true; ev.target.textContent = 'Tap again'; return; }
        BizProducts.remove(shop.email, p.id); s.close(); U.toast(p.name + ' deleted'); render();
      });
    }
    setTimeout(() => q('f-name').focus(), 50);
  }

  $('bp-add').addEventListener('click', () => open(null));
  $('bp-chips').addEventListener('click', e => {
    const c = e.target.closest('.bz-chip'); if (!c) return;
    filter = c.dataset.f; history.replaceState(null, '', filter === 'all' ? location.pathname : '#' + filter); render();
  });
  $('bp-list').addEventListener('click', e => {
    const b = e.target.closest('[data-edit]'); if (b) open(BizProducts.get(b.dataset.edit));
  });
  $('bp-list').addEventListener('change', e => {
    const id = e.target.dataset.sw; if (!id) return;
    const r = BizProducts.setInStock(shop.email, id, e.target.checked);
    if (r.error) U.toast(r.error);
    else if (e.target.checked && !r.inStock) U.toast('Add stock first — it has none on hand');
    else U.toast(r.inStock ? r.name + ' is available' : r.name + ' hidden from customers');
    render();
  });
  window.addEventListener('storage', render);
  render();
})();
