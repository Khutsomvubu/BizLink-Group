/* Business Orders — New / Preparing / Ready / Completed, one big action per order. */
(function () {
  const U = window.BizUI;
  const shop = U.me();
  if (!shop) return;
  const $ = id => document.getElementById(id);

  const TABS = {
    new:       { states: ['placed'], title: 'No new orders', text: 'When a customer checks out with your products, the order lands here.' },
    preparing: { states: ['accepted', 'preparing'], title: 'Nothing being prepared', text: 'Accepted orders show here until you mark them ready.' },
    ready:     { states: ['ready', 'at_shop'], title: 'Nothing waiting for pickup', text: 'Orders you’ve packed wait here until a driver collects them.' },
    done:      { states: ['picked_up', 'on_trip', 'arrived', 'delivered', 'declined', 'cancelled'], title: 'No completed orders yet', text: 'Orders handed to a driver, delivered, declined or cancelled are kept here.' }
  };
  let tab = TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'new';

  function render() {
    const all = BizOrders.forShop(shop.email);
    const by = k => all.filter(o => TABS[k].states.indexOf(o.state) >= 0);
    document.querySelectorAll('.od-tab').forEach(b => {
      const k = b.dataset.tab, n = by(k).length;
      b.classList.toggle('active', k === tab);
      b.setAttribute('aria-selected', k === tab ? 'true' : 'false');
      const c = b.querySelector('span');
      c.textContent = n; c.style.display = n && k !== 'done' ? '' : 'none';
    });
    const nNew = by('new').length;
    const pill = $('bo-new-pill');
    pill.textContent = nNew + ' waiting'; pill.classList.toggle('hidden', nNew === 0);

    const list = by(tab);
    if (tab === 'done') list.sort((a, b) => b.placedAt - a.placedAt);
    else list.sort((a, b) => a.placedAt - b.placedAt);   // oldest first: they've waited longest
    $('bo-list').innerHTML = list.map(o => U.orderCard(o, { fresh: true })).join('');
    $('bo-empty').classList.toggle('hidden', list.length > 0);
    $('bo-empty-title').textContent = TABS[tab].title;
    $('bo-empty-text').textContent = TABS[tab].text;
    if (window.BizNav) BizNav.refresh();
  }

  document.querySelector('.od-tabs').addEventListener('click', e => {
    const b = e.target.closest('.od-tab');
    if (!b) return;
    tab = b.dataset.tab;
    history.replaceState(null, '', '#' + tab);
    render();
  });
  window.addEventListener('hashchange', () => { if (TABS[location.hash.slice(1)]) { tab = location.hash.slice(1); render(); } });

  U.bindActions($('bo-list'), shop.email, () => {
    // after a move, follow the order to its next tab so the shop sees what happened
    render();
  });
  U.watchNew(shop.email, o => { U.toast('New order #' + o.number); render(); });
  window.addEventListener('storage', render);
  setInterval(render, 4000);
  render();
})();
