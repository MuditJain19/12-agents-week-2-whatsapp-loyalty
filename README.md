# WhatsApp Loyalty Agent for local stores

**Every morning it tells a shopkeeper which customers to message, and what to say. Each message is a WhatsApp link with the text already written: tap, check, send. It also keeps 15% of customers aside, so the shop can see whether the messages actually bring people back.**

Agent 2 of *12 Agents in 12 Weeks*. Built for my family's clothing store; demo on mock data for 4 fictional shops.

```
Google Form at the counter (15 seconds per sale)    +  old customers from your phone or register, pasted in once
        ▼
n8n, 9 AM daily (no AI, no paid API)
  ├─ learns each customer's buying rhythm from their past visits
  ├─ applies the store's playbook: thank-you, review ask, festival, birthday, "due", "we miss you"
  ├─ respects limits: one message a day, a gap between messages, a monthly cap, consent only
  ├─ ranks by importance, then by customer value, and keeps a list short enough to tap through
  ├─ win-back campaign for old customers: about 20 a day, once each, asking for consent
  └─ holds out 15% of customers on purpose (they get nothing) and logs every decision
        ▼
"Today" tab in Google Sheets: name, message, WhatsApp link → shopkeeper taps and sends
"Broadcast lists" tab: everyone who said yes, in groups of 256, for festival announcements
        ▼
"Report" tab: did messaged customers come back more than held-out ones?
```

## Why tap-to-send

| Option | Cost | Risk | Effort |
|---|---|---|---|
| **Tap-to-send links (this repo)** | Free | None: a human sends from their own WhatsApp | Live in a day |
| Official WhatsApp Business API | Meta charges per message | Low, but needs business verification, approved templates and recorded opt-in | Days to set up |
| Unofficial WhatsApp bots | Free | **Numbers get banned**; breaks WhatsApp's terms | Don't |

Want it fully automatic? Swap the "Today" tab for the WhatsApp Business API. Everything else stays the same.

## The 4 playbooks (`playbooks/`)

| Store | Usual gap between visits | What it sends | Daily tap limit |
|---|---|---|---|
| Clothing / saree | about 75 days | Thank-you next morning, review ask (first visit), festival and wedding-season collection, "we miss you" at 1.6× their usual gap | 30 |
| Kirana | about 10 days | "Send your list" when due, Diwali stock-up, "sab theek hai?" at 2.5× their gap | 30 |
| Salon | about 35 days | Review ask, "slot book karein?" when due, festive glow-up, "miss you" | 20 |
| Sweets / bakery | about 45 days | Thank-you on big orders, birthday pre-order 3 days before, festival pre-orders, fresh batch | 30 |

Each customer's own rhythm replaces the default once they have 3 or more visits. Messages are in Hinglish; edit the templates freely. The festival calendar is in `playbooks/calendar.json`; check the dates for your city and year.

## Old customers: import once, win back slowly

Most shops already have hundreds of past customers in a phone or a register. Paste them into the `Old customers` tab (or convert a phone export with `node tools/vcf_to_csv.js contacts.vcf`), and the agent:

1. **Runs a one-time win-back**, about 20 people a day, most valuable first. Each message is playbook-specific and **asks for consent** ("Haan ya Na"). Old contacts never agreed to updates, so nobody gets a second message unless they say yes.
2. **Moves the yeses into the normal playbook** (festivals, reminders), and never lists the nos again.
3. **Builds broadcast lists** of everyone who said yes, for WhatsApp Business broadcasts (max 256 per list, and only people who saved your number receive them).
4. **Measures it with the same 15% holdout**, so the shop can see whether the win-back worked.

The slow pace is deliberate: messaging hundreds of numbers in a day is how WhatsApp numbers get reported and banned.

**Demo** (`node demo/import_demo.js`): Rangoli Sarees imports 220 old customers (140 with register details). The campaign reaches everyone in 11 days: 189 messaged, 31 held out. 64 said Haan, 8 said Na. On 3 November, 30 of those yeses get the Diwali message in the normal list, and the broadcast list has 64 contacts. With a planted effect, 7.2% of messaged customers came back within 21 days versus 3.7% held out (+3.5 points, 95% range −4.7 to +11.7). One campaign at one shop is too small to prove it, which is exactly why the holdout keeps running.

## The honest part: did it work?

The mock data has a **planted** effect: a messaged customer is 60% more likely to visit that week. The agent ran daily from June to 3 November (2,016 reminders and win-backs to messaged customers, 375 decisions held out):

| Store | Messaged customers back within 14 days | Held out | Difference (95% range) |
|---|---|---|---|
| Clothing | 21 of 92 | 2 of 29 | +15.9 pts (+3.3 to +28.5) |
| Kirana | 1,052 of 1,235 | 200 of 233 | −0.7 pts (−5.6 to +4.2) |
| Salon | 258 of 599 | 35 of 100 | +8.1 pts (−2.1 to +18.2) |
| Sweets | 28 of 90 | 4 of 13 | +0.3 pts (−26.5 to +27.2) |
| **All four** | 1,359 of 2,016 | 241 of 375 | **+3.1 pts (−2.1 to +8.4)** |

Two lessons, and the second is the reason the holdout exists:
1. **One small shop needs months to prove anything.** Even with a real effect built in, 5 months across 4 shops can't separate it from noise with confidence.
2. **Some messages do nothing.** Kirana regulars came back at the same rate with or without reminders (85% vs 86%), because they were coming anyway. Without a holdout, the shop would credit the messages. With it, they can stop sending those messages.

Reproduce: `node src/simulate.js`

## Files

| Path | What it is |
|---|---|
| `n8n/whatsapp-loyalty.json` | Import-ready workflow: daily run, Google Sheets in and out, and a **Run Demo** button |
| `playbooks/*.json` | The 4 store playbooks and the festival calendar |
| `src/engine.js` | Customer rhythm, playbook rules, limits, holdout, lift report |
| `src/simulate.js` | Mock data for the 4 shops, with the agent running daily |
| `tools/vcf_to_csv.js` | Turns a phone contacts export (.vcf) into rows for the `Old customers` tab |
| `demo/import_demo.js` | Old-customer import, win-back campaign and broadcast lists for one mock shop |
| `setup/google-form.md` | Form questions, sheet tabs, 20-minute setup |
| `demo/` | Today's lists (3 Nov), message log, lift report, mock sales, win-back report, sample .vcf and broadcast lists |

## Walkthrough

`docs/flow/` has one mockup per screen the shopkeeper sees (counter form, morning list, tap-to-send, old customers, proof), also as `walkthrough.pdf`. Regenerate with `python3 docs/make_flow.py`.

## Limitations

- Someone has to fill in the form at the counter. If it's skipped, the agent can't see the sale.
- The tap limit means some due customers wait a day or two. Busy festival weeks will leave some out.
- Messages are templates, not personalised AI text. That keeps it free and predictable. Add Claude if you want variety.
- The lift report is only as good as the logging. Don't message held-out customers manually, or the comparison breaks.
- Respect consent: only customers who said yes get regular messages. Imported old customers get exactly one message, which asks.
- The import can't tell customers from family or suppliers in a phone's contacts. Clean the list before pasting it in.
- Broadcasts only reach people who saved the shop's number. Reaching everyone automatically needs the paid WhatsApp Business API.

All shops, customers and phone numbers in this repo are fictional. Phone numbers start with 0 after the country code, so they are not real WhatsApp numbers.
