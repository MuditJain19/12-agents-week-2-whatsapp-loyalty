// Rebuilds the list for an ordinary day (20 Oct) from the saved mock sales and log, to show non-festival messages.
const fs = require('fs'), path = require('path');
const E = require('../src/engine.js');
const root = path.join(__dirname, '..');
const cal = JSON.parse(fs.readFileSync(path.join(root, 'playbooks/calendar.json'), 'utf8'));
const DAY = '2026-10-20';
const names = { clothing: 'Rangoli Sarees', kirana: 'Sharma General Store', salon: 'Glow Salon', sweets: 'Mithaas Sweets' };
const lines = fs.readFileSync(path.join(root, 'demo/sales_mock.csv'), 'utf8').trim().split('\n');
const cols = lines[0].split(',');
const sales = lines.slice(1).map(l => { const v = l.split(','); const o = {}; cols.forEach((c, i) => { o[c] = v[i]; }); o.consent = o.consent === 'true'; return o; });
const log = JSON.parse(fs.readFileSync(path.join(root, 'demo/message_log.json'), 'utf8'));
const out = {};
for (const k of Object.keys(names)) {
  const pb = JSON.parse(fs.readFileSync(path.join(root, 'playbooks', k + '.json'), 'utf8'));
  const run = E.dailyRun(sales.filter(s => s.store === k && s.date < DAY), pb, cal, { id: k, name: names[k], review_link: 'https://g.page/r/EXAMPLE/review' }, DAY, log.filter(l => l.store === k && l.date < DAY), 15);
  out[k] = { store: names[k], list: run.list.map(x => ({ name: x.name, moment: x.moment, message: x.message })) };
}
fs.writeFileSync(path.join(root, 'demo/list_2026-10-20.json'), JSON.stringify(out, null, 2));
Object.entries(out).forEach(([k, v]) => console.log(k, v.list.map(x => x.moment).join(',')));
