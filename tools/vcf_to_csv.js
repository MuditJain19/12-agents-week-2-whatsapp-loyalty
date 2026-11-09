// Turn a phone contacts export (.vcf) into rows for the "Old customers" tab.
// Usage: node tools/vcf_to_csv.js contacts.vcf > old_customers.csv
// Then open the CSV, DELETE family, friends and suppliers, and paste the rest into the tab.
const fs = require('fs');
const { parseVcf } = require('../src/engine.js');
const file = process.argv[2];
if (!file) { console.error('Usage: node tools/vcf_to_csv.js contacts.vcf > old_customers.csv'); process.exit(1); }
const rows = parseVcf(fs.readFileSync(file, 'utf8'));
const q = v => /[",]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
console.log('phone,name,last_visit,category,total_spend,consent');
rows.forEach(r => console.log([r.phone, q(r.name), '', '', '', ''].join(',')));
console.error(rows.length + ' contacts converted. Remove anyone who is not a customer before importing.');
