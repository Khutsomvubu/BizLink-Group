/* Driver earnings — commission made, per day, and every completed delivery. */
(function () {
  const U = window.BizUI, D = window.BizDrv;
  const me = D.me();
  if (!me) return;
  const st = D.stats(me.email);
  const plural = (n, w) => n + ' ' + (n === 1 ? w : w === 'delivery' ? 'deliveries' : w + 's');
  const P = BizOrders.PAY;
  const when = o => new Date(D.at(o)).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) + ', ' + new Date(D.at(o)).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false });
  const stat = (l, v, t) => `<div class="bd-stat"><div class="l">${l}</div><div class="v">${v}</div><div class="t">${t}</div></div>`;

  function render() {
    const s = D.stats(me.email);
    document.getElementById('de-body').innerHTML = `
      <div class="de-big"><div class="l">Total commission made</div><div class="v">${U.money(s.all)}</div><div class="s">${plural(s.allCount, 'delivery')} completed</div></div>
      <section class="bd-stats">${stat('Today', U.money(s.today), plural(s.todayCount, 'delivery'))}${stat('This week', U.money(s.week), plural(s.weekCount, 'delivery'))}</section>
      <section class="bd-card"><div class="bd-card-head"><h2>Commission, last 7 days</h2><span class="bd-total">${U.money(s.week)} total</span></div>${D.bars(s.days, s.best)}</section>
      <div class="de-info"><b>How commission works</b><br>You earn R${P.base} per delivery plus R${P.perKm} for every km. It’s added when you mark an order Delivered.</div>
      <div class="bd-sec"><h2>Completed deliveries</h2></div>
      ${s.done.length ? '<div class="bd-top">' + s.done.map(o => `<div class="de-row"><span class="bd-rank"><svg class="ic" style="width:14px;height:14px"><use href="#i-check"/></svg></span>
        <div class="n">${U.esc(o.shopName || 'Shop')} → ${U.esc(o.dropArea || 'Customer')}<small>#${U.esc(o.number)} · ${o.km} km · ${U.esc(when(o))}</small></div><div class="r">+${U.money(o.payout || 0)}</div></div>`).join('') + '</div>'
        : '<div class="bd-quiet"><b>No deliveries yet</b>Your completed deliveries and the commission from each one will be listed here.</div>'}`;
    BizNav.refresh();
  }
  window.addEventListener('storage', render);
  setInterval(render, 5000);
  render();
})();
