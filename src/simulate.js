// Mock data: 4 fictional stores, ~8 months of sales, with the agent running daily from June.
// The message effect is PLANTED (customers who get a message are more likely to visit that week),
// so the lift report shows the method working, not a real-world result.
const fs = require('fs'), path = require('path');
const E = require('./engine.js');
const root = path.join(__dirname, '..');
const cal = JSON.parse(fs.readFileSync(path.join(root, 'playbooks/calendar.json'), 'utf8'));

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const STORES = [
  { id: 'clothing', name: 'Rangoli Sarees', customers: 520, churn: 0.15, festival: 2.5, amount: [1200, 9000], cats: ['saree', 'kurti', 'suit', 'lehenga'] },
  { id: 'kirana', name: 'Sharma General Store', customers: 600, churn: 0.05, festival: 1.5, amount: [300, 2500], cats: ['monthly ration', 'dairy', 'snacks'] },
  { id: 'salon', name: 'Glow Salon', customers: 460, churn: 0.10, festival: 1.8, amount: [250, 2500], cats: ['haircut', 'facial', 'hair colour', 'spa'] },
  { id: 'sweets', name: 'Mithaas Sweets', customers: 460, churn: 0.15, festival: 2.5, amount: [300, 3000], cats: ['kaju katli', 'rasgulla', 'cake', 'namkeen'] }
];
const FIRST = ['Priya', 'Rahul', 'Anita', 'Vikram', 'Sunita', 'Amit', 'Neha', 'Rohit', 'Kavita', 'Suresh', 'Pooja', 'Arjun', 'Meena', 'Deepak', 'Ritu', 'Manoj', 'Asha', 'Karan', 'Geeta', 'Nikhil', 'Rekha', 'Sanjay', 'Divya', 'Ajay'];
const LAST = ['Sharma', 'Agarwal', 'Gupta', 'Meena', 'Jain', 'Singh', 'Verma', 'Khandelwal', 'Saini', 'Joshi', 'Mathur', 'Choudhary'];

const START = '2026-03-01', AGENT_FROM = '2026-06-01', TODAY = '2026-11-03', BOOST = 0.6, HOLDOUT = 15;

function simulate(seed) {
  const r = rng(seed || 7);
  const out = { sales: [], log: [], today: {} };
  for (const st of STORES) {
    const pb = JSON.parse(fs.readFileSync(path.join(root, 'playbooks', st.id + '.json'), 'utf8'));
    const store = { id: st.id, name: st.name, review_link: 'https://g.page/r/EXAMPLE/review' };
    const cust = [];
    for (let i = 0; i < st.customers; i++) {
      const first = FIRST[Math.floor(r() * FIRST.length)];
      const ln = Math.exp((r() + r() + r() - 1.5) * 0.5);
      cust.push({
        phone: '9100000' + String(10000 + cust.length + STORES.indexOf(st) * 1000).padStart(5, '0'),
        name: first + ' ' + LAST[Math.floor(r() * LAST.length)],
        cycle: pb.default_cycle_days * ln,
        joinDay: Math.floor(r() * 214), // first visit between Mar and Sep
        consent: r() < 0.9,
        birthday: r() < 0.6 ? '1990-' + String(1 + Math.floor(r() * 12)).padStart(2, '0') + '-' + String(1 + Math.floor(r() * 28)).padStart(2, '0') : '',
        last: null, lapsed: false
      });
    }
    const sales = [], log = [];
    const total = E.daysBetween(START, TODAY);
    for (let d = 0; d <= total; d++) {
      const today = E.addDays(START, d);
      if (today >= AGENT_FROM) {
        const run = E.dailyRun(sales, pb, cal, store, today, log, HOLDOUT);
        run.entries.forEach(e => log.push(e));
        if (today === TODAY) { out.today[st.id] = Object.assign({ store: st.name, playbook: pb.name }, run); break; }
      }
      const toFest = E.daysBetween(today, cal.diwali.date);
      for (const c of cust) {
        let p;
        if (c.last == null) p = d === c.joinDay ? 1 : 0;
        else {
          const ratio = E.daysBetween(c.last, today) / c.cycle;
          p = (2 / c.cycle) * Math.pow(ratio, 4) / (1 + Math.pow(ratio, 4));
          if (c.lapsed) p *= 0.15;
          const recent = log.filter(l => l.phone === c.phone && l.status === 'sent' && E.daysBetween(l.date, today) <= 7 && E.daysBetween(l.date, today) >= 0);
          if (recent.length) { p *= 1 + BOOST; if (c.lapsed && r() < 0.02) c.lapsed = false; }
          if (toFest >= 0 && toFest <= 7) p *= st.festival;
        }
        if (r() < Math.min(p, 0.9)) {
          const amt = Math.round(st.amount[0] + (st.amount[1] - st.amount[0]) * Math.pow(r(), 2));
          sales.push({ date: today, store: st.id, phone: c.phone, name: c.name, amount: amt, category: st.cats[Math.floor(r() * st.cats.length)], consent: c.consent, birthday: c.birthday });
          c.last = today; c.lapsed = r() < st.churn;
        }
      }
    }
    out.sales = out.sales.concat(sales);
    out.log = out.log.concat(log);
  }
  return out;
}

if (require.main === module) {
  const t = Date.now();
  const s = simulate(7);
  fs.mkdirSync(path.join(root, 'demo'), { recursive: true });
  const cols = ['date', 'store', 'phone', 'name', 'amount', 'category', 'consent', 'birthday'];
  fs.writeFileSync(path.join(root, 'demo/sales_mock.csv'), [cols.join(',')].concat(s.sales.map(x => cols.map(c => x[c]).join(','))).join('\n') + '\n');
  fs.writeFileSync(path.join(root, 'demo/message_log.json'), JSON.stringify(s.log));
  const today = {};
  Object.entries(s.today).forEach(([k, v]) => { today[k] = { store: v.store, playbook: v.playbook, customers: v.customers, opted_in: v.opted_in, due_today: v.due, to_send: v.list.length, held_out: v.entries.filter(e => e.status === 'held_out').length, list: v.list }; });
  fs.writeFileSync(path.join(root, 'demo/today_2026-11-03.json'), JSON.stringify(today, null, 2));
  const report = {};
  for (const st of STORES) {
    const L = s.log.filter(l => l.store === st.id), S = s.sales.filter(x => x.store === st.id);
    report[st.id] = { reminders_and_winbacks: E.lift(L, S, ['due_reminder', 'win_back'], 14, '2026-11-03') };
  }
  report.all = E.lift(s.log, s.sales, ['due_reminder', 'win_back'], 14, '2026-11-03');
  fs.writeFileSync(path.join(root, 'demo/lift_report.json'), JSON.stringify(report, null, 2));
  console.log('ms', Date.now() - t, 'sales', s.sales.length, 'log', s.log.length);
  Object.entries(today).forEach(([k, v]) => console.log(k, 'customers', v.customers, 'due', v.due_today, 'to send today', v.to_send, 'held out', v.held_out, v.list.slice(0, 2).map(x => x.moment + ': ' + x.message).join(' || ')));
  const f = x => (x * 100).toFixed(1) + '%';
  Object.entries(report).forEach(([k, v]) => { const L = v.reminders_and_winbacks || v; console.log(k, 'messaged', L.messaged.back + '/' + L.messaged.n, f(L.rate_messaged), 'held', L.held_out.back + '/' + L.held_out.n, f(L.rate_held_out), 'diff', f(L.diff), 'CI', f(L.ci95[0]), f(L.ci95[1])); });
}
module.exports = { simulate };
