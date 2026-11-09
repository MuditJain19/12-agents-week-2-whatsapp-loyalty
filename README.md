# WhatsApp Loyalty Agent for local stores

**Every morning it tells a shopkeeper which customers to message, and what to say. Each message is a WhatsApp link with the text already written: tap, check, send. It also keeps 15% of customers aside, so the shop can see whether the messages actually bring people back.**

Agent 2 of *12 Agents in 12 Weeks*. Built for my family's clothing store; demo on mock data for 4 fictional shops.

```
Google Form at the counter (15 seconds per sale)
        ▼
n8n, 9 AM daily (no AI, no paid API)
  ├─ learns each customer's buying rhythm from their past visits
  ├─ applies the store's playbook: thank-you, review ask, festival, birthday, "due", "we miss you"
  ├─ respects limits: one message a day, a gap between messages, a monthly cap, consent only
  ├─ ranks by importance, then by customer value, and keeps a list short enough to tap through
  └─ holds out 15% of customers on purpose (they get nothing) and logs every decision
        ▼
"Today" tab in Google Sheets: name, message, WhatsApp link → shopkeeper taps and sends
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
| `setup/google-form.md` | Form questions, sheet tabs, 20-minute setup |
| `demo/` | Today's lists (3 Nov), message log, lift report, mock sales |

## Limitations

- Someone has to fill in the form at the counter. If it's skipped, the agent can't see the sale.
- The tap limit means some due customers wait a day or two. Busy festival weeks will leave some out.
- Messages are templates, not personalised AI text. That keeps it free and predictable. Add Claude if you want variety.
- The lift report is only as good as the logging. Don't message held-out customers manually, or the comparison breaks.
- Respect consent: only customers who said yes are ever listed.

All shops, customers and phone numbers in this repo are fictional. Phone numbers start with 0 after the country code, so they are not real WhatsApp numbers.
