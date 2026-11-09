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

// ===== Old customers: bulk import, win-back campaign, broadcast lists =====

// Indian 10-digit numbers get the 91 country code; anything else keeps its digits.
function phoneOf(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '0') d = d.slice(1);
  return d.length === 10 ? '91' + d : d;
}

// Phone contacts export (.vcf) -> [{ name, phone }]. One row per contact, first mobile number.
function parseVcf(text) {
  const out = [];
  String(text).replace(/\r\n[ \t]/g, '').split(/BEGIN:VCARD/i).slice(1).forEach(card => {
    const fn = (card.match(/^FN[^:]*:(.*)$/im) || [])[1];
    const tel = (card.match(/^TEL[^:]*:(.*)$/im) || [])[1];
    if (tel) out.push({ name: (fn || 'Customer').trim(), phone: phoneOf(tel) });
  });
  return out;
}

// "Old customers" tab rows -> sales-shaped rows the rest of the engine understands.
// Unknown last visit counts as one year ago. Consent is only true once the customer said yes.
function importedToSales(rows, today) {
  const seen = {};
  return rows.filter(r => r.phone).map(r => ({
    date: r.last_visit ? String(r.last_visit).slice(0, 10) : addDays(today, -365),
    phone: phoneOf(r.phone), name: r.name || 'Customer',
    amount: Number(r.total_spend) || 0, category: r.category || 'purchase',
    consent: /^(y|haan|han|ha)/i.test(String(r.consent || '')), opted_out: /^(n|na)/i.test(String(r.consent || '')),
    birthday: r.birthday || '', source: 'import', last_known: !!r.last_visit
  })).filter(r => r.phone.length >= 10 && !seen[r.phone] && (seen[r.phone] = true));
}

// One-time win-back: a few imported customers a day, each messaged once, with the same holdout.
function reactivationRun(imported, sales, playbook, store, today, log, holdoutPct, skipPhones) {
  const rc = playbook.reactivation;
  const lastVisit = {};
  sales.concat(imported).forEach(s => { if (s.date <= today && (!lastVisit[s.phone] || s.date > lastVisit[s.phone])) lastVisit[s.phone] = s.date; });
  const logBy = {};
  log.forEach(l => { (logBy[l.phone] = logBy[l.phone] || []).push(l); });
  const skip = new Set(skipPhones || []);
  sales.forEach(s => skip.add(s.phone));                                     // already a form customer: the daily list handles them
  const pool = imported.filter(c => {
    if (c.opted_out || skip.has(c.phone)) return false;
    const mine = logBy[c.phone] || [];
    if (mine.some(l => l.moment === 'reactivation')) return false;           // once per customer, ever
    if (mine.some(l => l.status === 'sent' && daysBetween(l.date, today) < playbook.min_days_between_messages)) return false;
    return daysBetween(lastVisit[c.phone], today) >= rc.min_days_since_visit;
  });
  // Known, recent, high-spend customers first: they're the likeliest to come back.
  pool.sort((a, b) => (b.last_known - a.last_known) || (b.amount - a.amount) || (lastVisit[b.phone] < lastVisit[a.phone] ? -1 : 1));
  const list = [], entries = [];
  for (const c of pool.slice(0, rc.per_day)) {
    const held = inHoldout(c.phone, holdoutPct);
    const text = fill(rc.template, { name: c.name.split(' ')[0], shop: store.name });
    const entry = { date: today, store: store.id, phone: c.phone, name: c.name, moment: 'reactivation', event: '', status: held ? 'held_out' : 'sent', days_since: daysBetween(lastVisit[c.phone], today), cycle: '' };
    entries.push(entry);
    if (!held) list.push(Object.assign({}, entry, { message: text, link: waLink(c.phone, text) }));
  }
  return { list, entries, remaining: pool.length - entries.length };
}

// Customers who said yes, split into WhatsApp broadcast lists (max 256 each), most recent first.
// A broadcast only reaches people who saved the shop's number, so this is for festival announcements, not win-backs.
function broadcastLists(sales, today, size) {
  const by = {};
  sales.filter(s => s.date <= today).forEach(s => {
    const p = by[s.phone] = by[s.phone] || { phone: s.phone, name: s.name, last: s.date, consent: false, opted_out: false };
    if (s.date > p.last) p.last = s.date;
    if (s.consent === true) p.consent = true;
    if (s.opted_out) p.opted_out = true;
  });
  const yes = Object.values(by).filter(p => p.consent && !p.opted_out).sort((a, b) => a.last < b.last ? 1 : -1);
  const n = size || 256;
  return yes.map((p, i) => ({ list: 'Broadcast ' + (Math.floor(i / n) + 1), name: p.name, phone: p.phone, last_visit: p.last }));
}

function toVcf(rows) {
  return rows.map(r => 'BEGIN:VCARD\nVERSION:3.0\nFN:' + r.name + '\nTEL;TYPE=CELL:+' + r.phone + '\nEND:VCARD').join('\n') + '\n';
}

if (typeof module !== 'undefined') module.exports = { dailyRun, lift, buildProfiles, inHoldout, addDays, daysBetween, phoneOf, parseVcf, importedToSales, reactivationRun, broadcastLists, toVcf };
