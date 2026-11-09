# Setup (about 20 minutes, once)

## 1. Google Form: one entry per sale

Create a Google Form with these questions. Keep the wording, because the workflow finds columns by these words.

| Question | Type | Required |
|---|---|---|
| Customer phone | Short answer (10 digits) | Yes |
| Customer name | Short answer | Yes |
| Amount (Rs) | Short answer (number) | Yes |
| Category | Dropdown (e.g. saree, kurti, suit) | Yes |
| Birthday (optional) | Date | No |
| Agreed to WhatsApp updates | Multiple choice: Yes / No | Yes |

The person at the counter fills it in on their phone in about 15 seconds. Pin the form link to the phone's home screen.

**Consent matters.** Only ask "Can we send you festival and offer updates on WhatsApp?" and record the real answer. Customers marked No never appear in the list.

## 2. Google Sheet

From the form's **Responses** tab, click **Link to Sheets**. In that spreadsheet, add five more tabs:

- `Old customers` with header row: `phone, name, last_visit, category, total_spend, Agreed to WhatsApp updates` (step 3 below)
- `Message log` with header row: `date, store, phone, name, moment, event, status, days_since, cycle`
- `Today` with header row: `name, moment, message, link`
- `Broadcast lists` with header row: `list, name, phone, last_visit`
- `Report` with header row: `date, store, customers, opted_in, due_today, sent_today, messaged_came_back, held_out_came_back, lift_pct_points, lift_95ci, winback_sent_today, winback_still_to_reach, winback_came_back, winback_held_out_came_back, winback_lift_pct_points`

## 3. Old customers (optional, once)

Most shops already have hundreds of past customers in a phone or a register. Add them once, and the agent runs a slow win-back campaign.

1. **Get the numbers out of the phone.** Either export from Google Contacts (Export → Google CSV, then copy the name and phone columns), or export a `.vcf` file and run `node tools/vcf_to_csv.js contacts.vcf > old_customers.csv`.
2. **Delete everyone who isn't a customer:** family, friends, suppliers, staff. The agent can't tell them apart.
3. **Add what the register knows**, if anything: last visit date, category, total spend. Rows with a known last visit and higher spend are messaged first. Blank is fine.
4. **Paste the rows into the `Old customers` tab.** Leave `Agreed to WhatsApp updates` blank.

What happens next:
- About 20 old customers a day appear in the `Today` tab with a win-back message (`moment: reactivation`). Each person gets it once, ever. 15% are held out, as usual.
- **The message asks for consent** ("Kya hum aapko… khabar bhej sakte hain? Haan ya Na"). When someone replies, write `Haan` or `Na` in their row. `Haan` customers get the normal playbook from then on (festivals, reminders). `Na` customers are never listed again. No reply means no further messages.
- Why slowly: messaging hundreds of numbers in one day gets a WhatsApp number reported and banned. 20 a day, sent by hand, with a consent question, is the safe pace.
- The `Report` tab shows whether win-back customers came back more than held-out ones (21-day window).

## 4. Broadcast lists (festival announcements)

The `Broadcast lists` tab is refreshed every morning: everyone who said yes, most recent customers first, split into lists of 256 (WhatsApp's limit). In WhatsApp Business: **New broadcast** → add the people in one list → send your festival announcement once.

A broadcast only reaches people who have **saved the shop's number**, so use it for announcements to existing customers, not for win-backs. Contacts missing from the phone can be imported from a `.vcf` (see `demo/broadcast_1.vcf` for the format).

## 5. n8n

1. Import `n8n/whatsapp-loyalty.json`.
2. Connect your Google account and pick the spreadsheet in every Google Sheets node.
3. In **Build Today's List**, set `STORE_TYPE` (clothing, kirana, salon or sweets), `SHOP_NAME` and `REVIEW_LINK` (your Google review link).
4. Click **Run Demo (4 mock stores)** first to see what the lists look like, then publish the workflow so it runs at 9 AM daily.

## 6. Every morning

Open the `Today` tab on the shop phone. Tap each link: WhatsApp opens with the message ready. Read it, edit it if you like, and send. If an old customer replies Haan or Na, note it in the `Old customers` tab.

## Optional upgrades

- **Bill photos instead of the form:** add an AI image-reading step that turns a bill photo (even handwritten Hindi) into the same fields. It costs a little per bill.
- **Fully automatic sending:** the official WhatsApp Business API can send without taps. It needs Meta business verification, approved message templates and recorded opt-in, and Meta charges per message. Never use unofficial WhatsApp bots: they break WhatsApp's terms and numbers get banned.
