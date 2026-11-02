// WhatsApp loyalty agent: turns sales into a daily tap-to-send list, using a store playbook.
// No AI, no paid API: the shopkeeper taps each wa.me link and sends from their own WhatsApp.

const DAY = 86400000;
const toDate = s => new Date(String(s).slice(0, 10) + 'T00:00:00Z');
const iso = d => d.toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY);
const addDays = (s, n) => iso(new Date(toDate(s).getTime() + n * DAY));

// Stable 15% holdout: same customer always lands in the same group.
function inHoldout(phone, pct) {
  let h = 2166136261;
  for (const ch of String(phone)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return (h % 100) < (pct == null ? 15 : pct);
}

function median(a) { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

function buildProfiles(sales, today, playbook) {
  const by = {};
  sales.filter(s => s.date <= today).forEach(s => {
    const p = by[s.phone] = by[s.phone] || { phone: s.phone, name: s.name, visits: [], consent: false, birthday: '' };
    p.visits.push({ date: s.date, amount: Number(s.amount) || 0, category: s.category });
    if (s.consent === true || s.consent === 'Yes') p.consent = true;
    if (s.birthday) p.birthday = s.birthday;
    if (s.name) p.name = s.name;
  });
  return Object.values(by).map(p => {
    p.visits.sort((a, b) => a.date < b.date ? -1 : 1);
    const dates = [...new Set(p.visits.map(v => v.date))];
    const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i], d));
    const def = playbook.default_cycle_days;
    let cycle = gaps.length >= 2 ? median(gaps) : def;
    cycle = Math.max(def * 0.5, Math.min(def * 3, cycle));
    const last = p.visits[p.visits.length - 1];
    const catCount = {};
    p.visits.forEach(v => { catCount[v.category] = (catCount[v.category] || 0) + 1; });
    const top = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0][0];
    return Object.assign(p, { visit_days: dates.length, last_visit: last.date, last_amount: last.amount, last_category: last.category, top_category: top, cycle: Math.round(cycle), days_since: daysBetween(last.date, today) });
  });
}

function fill(t, vars) { return t.replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? vars[k] : m); }

function waLink(phone, text) { return 'https://wa.me/' + String(phone).replace(/\D/g, '') + '?text=' + encodeURIComponent(text); }

// Which moment (if any) is due today for this customer?
function dueMoment(p, pb, cal, today, mine) {
  const sinceLastVisit = mine.filter(l => l.date > p.last_visit);
  const lastMsg = mine.filter(l => l.status === 'sent').map(l => l.date).sort().pop();
  if (lastMsg && daysBetween(lastMsg, today) < pb.min_days_between_messages) return null;
  if (mine.filter(l => l.status === 'sent' && daysBetween(l.date, today) < 30).length >= pb.max_messages_per_30_days) return null;
  const hits = [];
  for (const m of pb.moments) {
    const r = m.rule;
    const already = sinceLastVisit.some(l => l.moment === m.id);
    if (r.type === 'days_after_visit') {
      if (p.days_since === r.days && !already && (!r.first_visit_only || p.visit_days === 1) && (!r.min_amount || p.last_amount >= r.min_amount)) hits.push({ m });
    } else if (r.type === 'cycle') {
      const at = Math.round(p.cycle * r.at);
      // fire on the first run on or after the threshold, within a week, once per visit
      if (p.days_since >= at && p.days_since < at + 7 && !already) hits.push({ m });
    } else if (r.type === 'calendar') {
      for (const ev of r.events) {
        const e = cal[ev]; if (!e) continue;
        const d = daysBetween(today, e.date);
        const sentThisEvent = mine.some(l => l.moment === m.id && l.event === ev);
        if (d >= 0 && d <= r.days_before && !sentThisEvent && p.days_since <= 365) { hits.push({ m, event: ev }); break; }
      }
    } else if (r.type === 'birthday' && p.birthday) {
      const md = p.birthday.slice(5, 10);
      const target = today.slice(0, 4) + '-' + md;
      const d = daysBetween(today, target);
      const sentThisYear = mine.some(l => l.moment === m.id && l.date.slice(0, 4) === today.slice(0, 4));
      if (d >= 0 && d <= r.days_before && !sentThisYear) hits.push({ m });
    }
  }
  if (!hits.length) return null;
  hits.sort((a, b) => a.m.priority - b.m.priority);
  return hits[0];
}

// The daily run: returns today's tap-to-send list and the log entries to append.
function dailyRun(sales, playbook, calendar, store, today, log, holdoutPct) {
  const profiles = buildProfiles(sales, today, playbook);
  const logBy = {};
  log.forEach(l => { (logBy[l.phone] = logBy[l.phone] || []).push(l); });
  const list = [], entries = [];
  // Find everyone who is due, then keep a hand-tappable number: most important moment first,
  // then the most valuable customers (spend in the last 180 days). The rest stay due for tomorrow.
  const cands = [];
  for (const p of profiles) {
    if (!p.consent) continue;
    const hit = dueMoment(p, playbook, calendar, today, logBy[p.phone] || []);
    if (!hit) continue;
    const value = p.visits.filter(v => daysBetween(v.date, today) <= 180).reduce((a, v) => a + v.amount, 0);
    cands.push({ p, hit, value });
  }
  cands.sort((a, b) => a.hit.m.priority - b.hit.m.priority || b.value - a.value);
  const due = cands.length;
  for (const { p, hit } of cands.slice(0, playbook.max_messages_per_day || 30)) {
    const held = inHoldout(p.phone, holdoutPct);
    const ev = hit.event ? calendar[hit.event].label : '';
    const text = fill(hit.m.template, { name: p.name.split(' ')[0], shop: store.name, category: p.last_category, top_category: p.top_category, event: ev, days_since: p.days_since, review_link: store.review_link });
    const entry = { date: today, store: store.id, phone: p.phone, name: p.name, moment: hit.m.id, event: hit.event || '', status: held ? 'held_out' : 'sent', days_since: p.days_since, cycle: p.cycle };
    entries.push(entry);
    if (!held) list.push(Object.assign({}, entry, { message: text, link: waLink(p.phone, text) }));
  }
  const order = {}; playbook.moments.forEach(m => { order[m.id] = m.priority; });
  list.sort((a, b) => order[a.moment] - order[b.moment]);
  return { list, entries, due, customers: profiles.length, opted_in: profiles.filter(p => p.consent).length };
}

// Did messages bring people back? Compare messaged vs held-out customers on the same triggers.
function lift(log, sales, moments, windowDays, asOf) {
  const visitsBy = {};
  sales.forEach(s => { (visitsBy[s.phone] = visitsBy[s.phone] || []).push(s.date); });
  const g = { sent: { n: 0, back: 0 }, held_out: { n: 0, back: 0 } };
  log.filter(l => moments.includes(l.moment) && addDays(l.date, windowDays) <= asOf).forEach(l => {
    const came = (visitsBy[l.phone] || []).some(d => d > l.date && daysBetween(l.date, d) <= windowDays);
    g[l.status].n++; if (came) g[l.status].back++;
  });
  const r1 = g.sent.back / g.sent.n, r0 = g.held_out.back / g.held_out.n;
  const se = Math.sqrt(r1 * (1 - r1) / g.sent.n + r0 * (1 - r0) / g.held_out.n);
  return { window_days: windowDays, messaged: g.sent, held_out: g.held_out, rate_messaged: r1, rate_held_out: r0, diff: r1 - r0, ci95: [r1 - r0 - 1.96 * se, r1 - r0 + 1.96 * se] };
}

if (typeof module !== 'undefined') module.exports = { dailyRun, lift, buildProfiles, inHoldout, addDays, daysBetween };
