/* Isolated, in-memory end-to-end role simulation. It never writes BizLink order data. */
(function () {
  const root = document.getElementById('delivery-test-content');
  if (!root) return;

  const steps = [
    { role: 'Customer', text: 'Places orders TEST-C101 and TEST-C102 with two local shops.', status: 'Orders placed' },
    { role: 'Local shops', text: 'Both shops receive and accept their customer orders.', status: 'Orders accepted' },
    { role: 'Local shops', text: 'Both shops start preparing the customer orders.', status: 'Preparing orders' },
    { role: 'Local shops', text: 'Shop A places supplier restock order TEST-S201.', status: 'Supplier restock requested' },
    { role: 'Supplier', text: 'Receives and accepts TEST-S201.', status: 'Restock accepted' },
    { role: 'Supplier', text: 'Packs the restock and marks it ready for pickup.', status: 'Restock ready' },
    { role: 'Driver', text: 'Sees the supplier-to-shop request and accepts that delivery.', status: 'Restock delivery accepted' },
    { role: 'Supplier', text: 'Confirms handoff of TEST-S201 to the driver.', status: 'Restock handed to driver' },
    { role: 'Driver', text: 'Delivers the supplier restock to Shop A.', status: 'Restock delivered' },
    { role: 'Local shops', text: 'Shop A confirms receipt of the supplier restock.', status: 'Restock received' },
    { role: 'Supplier', text: 'The supplier order is recorded as delivered to Shop A.', status: 'Restock complete' },
    { role: 'Local shops', text: 'Both shops finish packing customer orders and mark them ready.', status: 'Customer orders ready' },
    { role: 'Driver', text: 'Sees TEST-C101 and TEST-C102 pooled into one nearby customer-delivery batch.', status: 'Two-order batch accepted' },
    { role: 'Driver', text: 'Arrives at Shop A for the first pooled pickup.', status: 'At Shop A' },
    { role: 'Local shops', text: 'Shop A confirms handoff for TEST-C101 to the driver.', status: 'Shop A pickup confirmed' },
    { role: 'Driver', text: 'Arrives at Shop B for the second pooled pickup.', status: 'At Shop B' },
    { role: 'Local shops', text: 'Shop B confirms handoff for TEST-C102 to the driver.', status: 'Shop B pickup confirmed' },
    { role: 'Driver', text: 'Leaves both shops with the collected orders and starts the delivery route.', status: 'Batch out for delivery' },
    { role: 'Driver', text: 'Delivers TEST-C101 to the deliberately incorrect test address and confirms the drop-off.', status: 'TEST-C101 drop-off verified' },
    { role: 'Driver', text: 'Delivers TEST-C102 despite its missing phone number and confirms the drop-off.', status: 'TEST-C102 drop-off verified' },
    { role: 'Customer', text: 'Both customer orders show Delivered. The driver confirms each drop-off; customers do not confirm.', status: 'Both orders delivered' }
  ];
  const roleNames = ['Customer', 'Local shops', 'Supplier', 'Driver'];
  const state = { index: -1, timer: null };

  function esc(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function roleStatus(role) {
    for (let i = state.index; i >= 0; i--) {
      if (steps[i].role === role) return steps[i].status;
    }
    return 'Waiting to start';
  }

  function render() {
    const running = state.timer !== null;
    const complete = state.index >= steps.length - 1;
    const roleCards = roleNames.map(role => `<article class="bo-card">
      <div class="od-top"><div class="od-num">${esc(role)}</div>
        <span class="od-pill ${roleStatus(role) === 'Delivered' ? 'delivered' : state.index >= 0 ? 'accepted' : 'placed'}">${esc(roleStatus(role))}</span></div>
    </article>`).join('');
    const timeline = steps.map((step, index) => {
      const done = index < state.index;
      const current = index === state.index;
      return `<li class="od-step ${done ? 'done' : current ? 'current' : ''}">
        <span class="od-dot">${done ? '<svg class="ic"><use href="#i-check"/></svg>' : index + 1}</span>
        <div><div class="t">${esc(step.role)} · ${esc(step.status)}</div><div class="d">${esc(step.text)}</div></div>
        ${current ? '<span class="tm">Now</span>' : ''}</li>`;
    }).join('');
    let button;
    if (complete) button = '<button type="button" class="bz-btn ghost" data-test-action="reset">Run test again</button>';
    else if (running) button = '<button type="button" class="bz-btn ghost" data-test-action="stop">Pause automatic test</button>';
    else if (state.index >= 0) button = '<button type="button" class="bz-btn primary" data-test-action="run">Resume automatic test</button>';
    else button = '<button type="button" class="bz-btn primary" data-test-action="run">Run full automatic test</button>';
    const progress = state.index < 0 ? 'Ready to start' : complete
      ? 'All roles completed the test workflow.'
      : `Step ${state.index + 1} of ${steps.length} · next update is simulated automatically.`;

    root.innerHTML = `<section class="bd-card">
      <div class="bd-card-head"><h2>FAKE DATA · TEST ONLY</h2><span class="bd-total">${esc(progress)}</span></div>
      <p>This simulator automatically acts as the customer, local shop, supplier, and driver. It includes a false delivery address and invalid contact details to demonstrate the workflow. Nothing is sent, and no real order or account data is read or changed.</p>
      <div class="bo-actions">${button}</div>
    </section>
    <section class="bd-list" aria-label="Simulated role dashboards">${roleCards}</section>
    <section class="bd-card">
      <div class="bd-card-head"><h2>Test orders</h2><span class="bd-total">TEST-C101 · TEST-C102 · TEST-S201</span></div>
      <div class="dj-route">
        <div class="dj-stop"><span class="dj-dot"></span><div><b>Customer delivery address · deliberately false</b>999 Nowhere Street, Fakeville, Exampleland</div></div>
        <div class="dj-stop to"><span class="dj-dot"></span><div><b>Customer contact · invalid</b>000-000-0000</div></div>
        <div class="dj-stop"><span class="dj-dot"></span><div><b>Second customer address · contact missing</b>2 Imaginary Lane, Demo District, Exampleland · no phone number</div></div>
        <div class="dj-stop to"><span class="dj-dot"></span><div><b>Mock Local Shop A</b>1 Fictional Road, Demo District, Exampleland</div></div>
        <div class="dj-stop"><span class="dj-dot"></span><div><b>Mock Local Shop B</b>3 Pretend Street, Demo District, Exampleland</div></div>
        <div class="dj-stop to"><span class="dj-dot"></span><div><b>Mock Supplier</b>5 Placeholder Avenue, Demo District, Exampleland</div></div>
      </div>
    </section>
    <section class="bd-card" aria-label="Automatic end-to-end test timeline">
      <div class="bd-card-head"><h2>Automatic workflow</h2><span class="bd-total">${state.index < 0 ? 'Not started' : `${state.index + 1}/${steps.length}`}</span></div>
      <ol class="od-timeline da-timeline">${timeline}</ol>
    </section>`;
  }

  function advance() {
    if (state.index < steps.length - 1) {
      state.index++;
      render();
    }
    if (state.index >= steps.length - 1) {
      clearInterval(state.timer);
      state.timer = null;
      render();
    }
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('[data-test-action]');
    if (!button) return;
    if (button.dataset.testAction === 'run') {
      if (state.timer !== null) return;
      if (state.index < steps.length - 1) state.timer = setInterval(advance, 1000);
      advance();
    } else if (button.dataset.testAction === 'stop') {
      clearInterval(state.timer);
      state.timer = null;
    } else if (button.dataset.testAction === 'reset') {
      clearInterval(state.timer);
      state.timer = null;
      state.index = -1;
    }
    render();
  });

  render();
})();
