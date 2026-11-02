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

From the form's **Responses** tab, click **Link to Sheets**. In that spreadsheet, add three more tabs:

- `Message log` with header row: `date, store, phone, name, moment, event, status, days_since, cycle`
- `Today` with header row: `name, moment, message, link`
- `Report` with header row: `date, store, customers, opted_in, due_today, sent_today, messaged_came_back, held_out_came_back, lift_pct_points, lift_95ci`

## 3. n8n

1. Import `n8n/whatsapp-loyalty.json`.
2. Connect your Google account and pick the spreadsheet in every Google Sheets node.
3. In **Build Today's List**, set `STORE_TYPE` (clothing, kirana, salon or sweets), `SHOP_NAME` and `REVIEW_LINK` (your Google review link).
4. Click **Run Demo (4 mock stores)** first to see what the lists look like, then publish the workflow so it runs at 9 AM daily.

## 4. Every morning

Open the `Today` tab on the shop phone. Tap each link: WhatsApp opens with the message ready. Read it, edit it if you like, and send. That's it.

## Optional upgrades

- **Bill photos instead of the form:** add an AI image-reading step that turns a bill photo (even handwritten Hindi) into the same fields. It costs a little per bill.
- **Fully automatic sending:** the official WhatsApp Business API can send without taps. It needs Meta business verification, approved message templates and recorded opt-in, and Meta charges per message. Never use unofficial WhatsApp bots: they break WhatsApp's terms and numbers get banned.
