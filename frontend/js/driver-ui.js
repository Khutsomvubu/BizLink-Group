/* ============================================================
   BizLink — driver-side shared helpers (needs biz-ui.js first)
   Commission = order.payout, set at checkout from BizOrders.PAY
   (base + per km). A delivery's commission counts once it is delivered.
   ============================================================ */
(function () {
  const U = window.BizUI;

  function me() {
    const s = BizSession.requireRole('delivery');
    if (!s) return null;
    const u = (window.BizAuth && BizAuth.getUser(s.email)) || s;
    const name = u.name || 'Driver';
    const bike = u.vehicleType === 'Bicycle';
    return { email: s.email, name, first: name.split(' ')[0], vehicle: u.vehicleType || 'Vehicle', plate: bike ? '' : (u.plate || ''), bike };
  }

  const at = o => (o.times && o.times.delivered) || o.placedAt;

  function stats(email) {
    const done = BizOrders.forDriver(email).filter(o => o.state === 'delivered' && !o.isDemo);
    const t0 = U.sod(Date.now());
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(t0); d.setDate(d.getDate() - i);
      days.push({ start: d.getTime(), total: 0, count: 0, label: i === 0 ? 'Today' : d.toLocaleDateString('en-ZA', { weekday: 'short' }) });
    }
    done.forEach(o => {
      const day = days.find(d => d.start === U.sod(at(o)));
      if (day) { day.total += o.payout || 0; day.count++; }
    });
    let best = -1;
    days.forEach((d, i) => { if (d.total > 0 && (best < 0 || d.total >= days[best].total)) best = i; });
    return {
      days, best, done: done.sort((a, b) => at(b) - at(a)),
      today: days[6].total, todayCount: days[6].count,
      week: days.reduce((s, d) => s + d.total, 0), weekCount: days.reduce((s, d) => s + d.count, 0),
      all: done.reduce((s, o) => s + (o.payout || 0), 0), allCount: done.length
    };
  }

  function shopInfo(o) {
    const u = (window.BizAuth && o.shopEmail && BizAuth.getUser(o.shopEmail)) || {};
    return { name: o.shopName || u.businessName || 'Shop', address: u.address || '', phone: u.phone || '' };
  }

  function bars(days, best) {
    const max = Math.max.apply(null, days.map(d => d.total));
    return '<div class="bd-bars">' + days.map((d, i) => {
      const h = d.total > 0 ? Math.max(8, Math.round((d.total / max) * 82)) : 4;
      const cls = d.total <= 0 ? 'zero' : i === best ? 'best' : '';
      return `<div class="bd-col" title="${U.esc(d.label)}: ${U.money(d.total)}"><div class="bd-amt${d.total <= 0 ? ' zero' : ''}">${U.rand0(d.total)}</div>
        <div class="bd-bar ${cls}" style="height:${h}px"></div><div class="bd-day${i === 6 ? ' today' : ''}">${U.esc(d.label)}</div></div>`;
    }).join('') + '</div>';
  }

  window.BizDrv = { me, stats, shopInfo, bars, at };
})();
