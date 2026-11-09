// Demo: Rangoli Sarees (fictional) imports 220 old customers from its phone and register,
// runs a 20-a-day win-back campaign from 5 October, and builds broadcast lists on 3 November.
// The win-back effect is PLANTED (a messaged old customer is 3x as likely to visit for 2 weeks),
// so the report shows the method working, not a real-world result.
const fs = require('fs'), path = require('path');
const E = require('../src/engine.js');
const root = path.join(__dirname, '..');
const pb = JSON.parse(fs.readFileSync(path.join(root, 'playbooks/clothing.json'), 'utf8'));
const cal = JSON.parse(fs.readFileSync(path.join(root, 'playbooks/calendar.json'), 'utf8'));
const store = { id: 'clothing', name: 'Rangoli Sarees', review_link: 'https://g.page/r/EXAMPLE/review' };

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r = rng(11);
const FIRST = ['Shobha', 'Lalit', 'Usha', 'Mahesh', 'Kiran', 'Ramesh', 'Seema', 'Gopal', 'Nirmala', 'Pradeep', 'Lata', 'Hemant', 'Sarita', 'Naveen', 'Kusum', 'Yogesh'];
const LAST = ['Sharma', 'Agarwal', 'Gupta', 'Jain', 'Khandelwal', 'Saini', 'Mathur', 'Bansal', 'Goyal', 'Rathore'];
const CATS = ['saree', 'kurti', 'suit', 'lehenga'];
const START = '2026-10-05', TODAY = '2026-11-03', N = 220, BOOST = 2.0, BASE = 0.0012;

// 1. What the shop has: a phone full of contacts, and a register for some of them.
const old = [];
for (let i = 0; i < N; i++) {
  const inRegister = r() < 0.6;
  old.push({
    phone: '91000' + String(9000000 + i * 37).slice(0, 7),
    name: FIRST[Math.floor(r() * FIRST.length)] + ' ' + LAST[Math.floor(r() * LAST.length)],
    last_visit: inRegister ? E.addDays(START, -(120 + Math.floor(r() * 600))) : '',
    category: inRegister ? CATS[Math.floor(r() * CATS.length)] : '',
    total_spend: inRegister ? Math.round(1500 + 20000 * Math.pow(r(), 2)) : '',
    consent: ''
  });
}
const vcf = old.map(o => 'BEGIN:VCARD\nVERSION:3.0\nFN:' + o.name + '\nTEL;TYPE=CELL:+91 ' + o.phone.slice(2, 7) + ' ' + o.phone.slice(7) + '\nEND:VCARD').join('\n') + '\n';
fs.writeFileSync(path.join(root, 'demo/old_contacts_sample.vcf'), vcf);
// The .vcf round-trip is what tools/vcf_to_csv.js does; register details are then added by hand.
const parsed = E.parseVcf(vcf);
if (parsed.length !== N || parsed.some((p, i) => p.phone !== old[i].phone)) throw new Error('vcf round-trip failed');
const cols = ['phone', 'name', 'last_visit', 'category', 'total_spend', 'consent'];
fs.writeFileSync(path.join(root, 'demo/old_customers_import.csv'), [cols.join(',')].concat(old.map(o => cols.map(c => o[c]).join(','))).join('\n') + '\n');

// 2. Run the campaign day by day. Replies update the consent column; visits become form sales.
const formSales = [], log = [];
const reply = {};
let firstDay = null;
for (let d = 0; ; d++) {
  const today = E.addDays(START, d);
  if (today > TODAY) break;
  const imported = E.importedToSales(old, today);
  const run = E.reactivationRun(imported, formSales, pb, store, today, log, 15, []);
  run.entries.forEach(e => log.push(e));
  if (!firstDay) firstDay = { date: today, to_send: run.list.length, held_out: run.entries.length - run.list.length, still_to_reach: run.remaining, list: run.list.slice(0, 5) };
  for (const o of old) {
    const sent = log.find(l => l.phone === o.phone && l.moment === 'reactivation' && l.status === 'sent');
    if (sent && !reply[o.phone]) { const x = r(); reply[o.phone] = x < 0.30 ? 'Haan' : x < 0.36 ? 'Na' : '-'; if (reply[o.phone] !== '-') o.consent = reply[o.phone]; }
    let p = BASE;
    if (sent && E.daysBetween(sent.date, today) >= 0 && E.daysBetween(sent.date, today) <= 14) p *= 1 + BOOST;
    if (r() < p) formSales.push({ date: today, store: 'clothing', phone: o.phone, name: o.name, amount: Math.round(1500 + 8000 * r()), category: CATS[Math.floor(r() * 4)], consent: o.consent === 'Haan', birthday: '' });
  }
}

// 3. Did the win-back work? Same holdout comparison as the daily list, 21-day window.
const L = E.lift(log, formSales, ['reactivation'], 21, TODAY);
const said = v => old.filter(o => o.consent === v).length;
// 4. On 3 Nov, customers who said Haan join the normal daily list (Diwali is on 8 Nov).
const imported = E.importedToSales(old, TODAY);
const daily = E.dailyRun(formSales.concat(imported.filter(i => i.consent)), pb, cal, store, TODAY, log, 15);
// 5. Broadcast lists: everyone who said yes, most recent first, 256 per list.
const bl = E.broadcastLists(formSales.concat(imported), TODAY);
fs.writeFileSync(path.join(root, 'demo/broadcast_lists.csv'), 'list,name,phone,last_visit\n' + bl.map(b => [b.list, b.name, b.phone, b.last_visit].join(',')).join('\n') + '\n');
fs.writeFileSync(path.join(root, 'demo/broadcast_1.vcf'), E.toVcf(bl.filter(b => b.list === 'Broadcast 1')));

const report = {
  store: store.name, imported: N, with_register_details: old.filter(o => o.last_visit).length,
  campaign: { start: START, per_day: pb.reactivation.per_day, days_to_reach_everyone: new Set(log.map(l => l.date)).size, messaged: log.filter(l => l.status === 'sent').length, held_out: log.filter(l => l.status === 'held_out').length },
  replies: { haan: said('Haan'), na: said('Na'), no_reply: log.filter(l => l.status === 'sent').length - said('Haan') - said('Na') },
  came_back_within_21_days: { messaged: L.messaged, held_out: L.held_out, rate_messaged: +L.rate_messaged.toFixed(3), rate_held_out: +L.rate_held_out.toFixed(3), diff_pct_points: +(L.diff * 100).toFixed(1), ci95_pct_points: L.ci95.map(x => +(x * 100).toFixed(1)) },
  on_3_nov: { opted_in_old_customers_in_daily_list: daily.list.filter(x => imported.some(i => i.phone === x.phone)).length, broadcast_contacts: bl.length },
  first_day: firstDay
};
fs.writeFileSync(path.join(root, 'demo/winback_report.json'), JSON.stringify(report, null, 2));
const f = x => (x * 100).toFixed(1) + '%';
console.log('imported', N, '| days', report.campaign.days_to_reach_everyone, '| messaged', report.campaign.messaged, 'held', report.campaign.held_out);
console.log('replies', JSON.stringify(report.replies));
console.log('back in 21d: messaged', L.messaged.back + '/' + L.messaged.n, f(L.rate_messaged), '| held out', L.held_out.back + '/' + L.held_out.n, f(L.rate_held_out), '| diff', f(L.diff), 'CI', f(L.ci95[0]), f(L.ci95[1]));
console.log('3 Nov: old customers in daily list', report.on_3_nov.opted_in_old_customers_in_daily_list, '| broadcast contacts', bl.length);
console.log('first message:', firstDay.list[0].message);
