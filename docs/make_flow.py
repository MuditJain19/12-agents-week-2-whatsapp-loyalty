# Renders the "how it works" walkthrough: one slide per screen the shopkeeper sees.
# Output: docs/flow/*.png (1080x1350) and docs/flow/walkthrough.pdf (for a LinkedIn document post).
# All shops, customers and numbers are fictional (mock run in demo/).
import html, json, pathlib
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
out = root / "docs/flow"; out.mkdir(parents=True, exist_ok=True)
today = json.loads((root / "demo/today_2026-11-03.json").read_text())
wb = json.loads((root / "demo/winback_report.json").read_text())
lift = json.loads((root / "demo/lift_report.json").read_text())
E = html.escape

CSS = """*{box-sizing:border-box}body{margin:0;width:1080px;height:1350px;background:#f6f3ee;font-family:'Helvetica Neue',Arial,sans-serif;color:#1c1b19;padding:64px 68px;display:flex;flex-direction:column;align-items:stretch}
.kick{font-size:22px;letter-spacing:.14em;text-transform:uppercase;color:#a1502a;font-weight:700}
h1{font-size:52px;line-height:1.08;margin:12px 0 30px;font-weight:800;letter-spacing:-.01em}
.row{display:flex;gap:44px;align-items:flex-start}
.phone{width:470px;height:900px;flex:none;background:#1c1b19;border-radius:56px;padding:16px;box-shadow:0 18px 40px rgba(0,0,0,.16)}
.screen{width:100%;height:100%;background:#fff;border-radius:42px;overflow:hidden;display:flex;flex-direction:column;position:relative}
.status{height:44px;display:flex;justify-content:space-between;align-items:center;padding:0 28px;font-size:16px;font-weight:700;color:#1c1b19}
.bar{padding:14px 22px;font-size:20px;font-weight:700;border-bottom:1px solid #eee;display:flex;align-items:center;gap:12px}
.notes{flex:1;padding-top:30px}
.note{font-size:24px;line-height:1.38;margin-bottom:26px;padding-left:22px;border-left:4px solid #d9cfbf}
.note b{display:block;font-size:19px;letter-spacing:.08em;text-transform:uppercase;color:#a1502a;margin-bottom:4px}
.foot{margin-top:auto;font-size:19px;color:#8a857b;display:flex;justify-content:space-between}
.av{width:40px;height:40px;border-radius:50%;background:#d9cfbf;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;color:#5b574f}"""

def page(body, step, note="Mockup · fictional shop & customers"):
    return f'<html><head><meta charset="utf-8"><style>{CSS}</style></head><body>{body}<div class="foot"><span>WhatsApp Loyalty Agent · 12 Agents in 12 Weeks · {step}</span><span>{note}</span></div></body></html>'

def phone(inner, t="9:41"):
    return f'<div class="phone"><div class="screen"><div class="status"><span>{t}</span><span>●●● ▮</span></div>{inner}</div></div>'

def notes(items):
    return '<div class="notes">' + "".join(f'<div class="note"><b>{E(h)}</b>{t}</div>' for h, t in items) + "</div>"

slides = []

# 0. Cover
slides.append(page(f'''<div style="flex:1;display:flex;flex-direction:column;justify-content:center">
<div class="kick">Agent 2 of 12</div>
<div style="font-size:92px;line-height:1.02;font-weight:800;letter-spacing:-.02em;margin:18px 0 34px">Diwali filled<br>the shop.<br><span style="color:#a1502a">Will they<br>come back?</span></div>
<div style="font-size:34px;line-height:1.35;max-width:820px;color:#3a3834">Local shops don't lack customers. They lack memory.<br><b>So I built the shop a memory.</b></div>
<div style="margin-top:46px;font-size:24px;color:#5b574f">Swipe for how it works: 5 screens, no app, no API bill →</div></div>''', "How it works", "Free to copy"))

# 1. Counter form
field = lambda label, val, sel=False: f'''<div style="margin:0 20px 16px;padding:16px 18px;border:1px solid #e5ded2;border-radius:14px">
<div style="font-size:15px;color:#8a857b;margin-bottom:6px">{E(label)}</div><div style="font-size:21px;{'color:#1a7f4b;font-weight:700' if sel else ''}">{E(val)}</div></div>'''
form = f'''<div class="bar" style="background:#f3ede4">📝 Rangoli Sarees · New sale</div><div style="height:18px"></div>
{field("Customer phone", "98•••• ••210")}{field("Customer name", "Rekha Sharma")}{field("Amount (Rs)", "6,400")}{field("Category", "lehenga ▾")}
{field("Birthday (optional)", "—")}{field("Agreed to WhatsApp updates?", "● Yes   ○ No", True)}
<div style="margin:10px 20px;background:#1c1b19;color:#fff;text-align:center;border-radius:28px;padding:16px;font-size:20px;font-weight:700">Submit</div>'''
slides.append(page(f'''<div class="kick">Step 1 · At the counter</div><h1>Every sale: 15 seconds<br>on a Google Form.</h1>
<div class="row">{phone(form)}{notes([("Who", "Whoever is at the counter, on the shop phone. The form link is pinned to the home screen."),
("What", "Phone, name, amount, category. Birthday if they share it."),
("Consent", "One question: <i>“Can we send you festival and offer updates on WhatsApp?”</i> No means never messaged.")])}</div>''', "Step 1"))

# 2. Morning list
c = today["clothing"]
items = [x for x in c["list"] if x["moment"] == "festival"][:3]
extra = [("Priya Meena", "thank you", "Namaste Priya ji! Rangoli Sarees se saree lene ke liye dhanyavaad…"), ("Anita Jain", "review ask", "Anita ji, umeed hai aapko kurti pasand aayi! 30 second mein ek review…")]
cards = "".join(f'''<div style="margin:0 16px 12px;padding:14px 16px;border-radius:16px;background:#fbf8f3;border:1px solid #eee5d8">
<div style="display:flex;justify-content:space-between;font-size:15px;color:#8a857b"><b style="color:#1c1b19;font-size:18px">{E(n)}</b><span>{E(m)}</span></div>
<div style="font-size:16px;line-height:1.35;margin:8px 0 10px;color:#3a3834">{E(t[:78].rstrip("…").rstrip("."))}…</div>
<div style="display:inline-block;background:#1a7f4b;color:#fff;border-radius:18px;padding:6px 14px;font-size:15px;font-weight:700">Tap to send →</div></div>'''
    for n, m, t in [(x["name"], "festival", x["message"]) for x in items] + extra)
sheet = f'''<div class="bar" style="background:#eef6ec">📋 Today · 3 Nov <span style="margin-left:auto;font-size:15px;color:#5b574f;font-weight:400">{c["to_send"]} to send</span></div><div style="height:14px"></div>{cards}'''
slides.append(page(f'''<div class="kick">Step 2 · 9 AM</div><h1>The agent picks who to<br>message, and writes it.</h1>
<div class="row">{phone(sheet, "9:02")}{notes([("How it decides", "It learns each customer's buying rhythm, then applies the shop's playbook: thank-you, review ask, festival, “due”, “we miss you”."),
("Limits", "One message a day per person, a gap between messages, a monthly cap. The list stays short enough to tap through."),
("Cost", "Runs on n8n with plain code. No AI calls, no API bill.")])}</div>''', "Step 2", "Mock run · 3 Nov, 5 days before Diwali"))

# 3. Tap -> WhatsApp opens with message ready
msg = items[0]["message"]
chat = f'''<div class="bar" style="background:#f0f2f0"><div class="av">R</div><div><div>{E(items[0]["name"])}</div><div style="font-size:14px;color:#8a857b;font-weight:400">tap here for contact info</div></div></div>
<div style="flex:1;background:#efe7dd;padding:20px 16px;display:flex;flex-direction:column;justify-content:flex-end">
<div style="align-self:center;background:#fff8d6;border-radius:10px;padding:8px 14px;font-size:14px;color:#6b5d2d;margin-bottom:auto;margin-top:8px">Last message: 4 months ago</div></div>
<div style="background:#f6f6f6;padding:14px 12px;display:flex;gap:10px;align-items:flex-end;border-top:1px solid #e5e5e5">
<div style="flex:1;background:#fff;border-radius:22px;padding:14px 16px;font-size:18px;line-height:1.4;border:2px solid #1a7f4b">{E(msg)}</div>
<div style="width:52px;height:52px;border-radius:50%;background:#1a7f4b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;flex:none">➤</div></div>'''
slides.append(page(f'''<div class="kick">Step 3 · Tap</div><h1>The chat opens with the<br>message already typed.</h1>
<div class="row">{phone(chat, "9:03")}{notes([("Human in the loop", "The shopkeeper reads it, edits if they like, and presses send. From their own WhatsApp."),
("Why not a bot", "Unofficial bots break WhatsApp's rules and numbers get banned. Tap-to-send is free and safe."),
("Want it automatic?", "Swap in the official WhatsApp Business API. Meta charges per message.")])}</div>''', "Step 3"))

# 4. Old customers: import + win-back + consent reply
first = wb["first_day"]["list"][0]
fn = first["name"].split(" ")[0]
conv = f'''<div class="bar" style="background:#f0f2f0"><div class="av">{E(fn[0])}</div><div>{E(first["name"])}</div></div>
<div style="flex:1;background:#efe7dd;padding:22px 16px;display:flex;flex-direction:column;gap:14px">
<div style="align-self:flex-end;max-width:84%;background:#d9fdd3;border-radius:14px 14px 4px 14px;padding:12px 14px;font-size:17px;line-height:1.4">{E(first["message"])}<div style="text-align:right;font-size:13px;color:#7b8a7a;margin-top:4px">10:15 ✓✓</div></div>
<div style="align-self:flex-start;max-width:70%;background:#fff;border-radius:14px 14px 14px 4px;padding:12px 14px;font-size:17px;line-height:1.4">Haan ji, bhejiye! Diwali ke baad aayenge 🙏<div style="text-align:right;font-size:13px;color:#999;margin-top:4px">11:02</div></div>
<div style="margin-top:auto;background:#fff;border-radius:14px;padding:14px;font-size:15px;color:#3a3834;border:1px dashed #a1502a">
<b style="color:#a1502a">Old customers tab</b><br>{E(first["name"])} · last visit {first["days_since"]} days ago · <b style="color:#1a7f4b">Haan ✓</b></div></div>'''
slides.append(page(f'''<div class="kick">Step 4 · Old customers</div><h1>Hundreds of old numbers?<br>Import once. Win back slowly.</h1>
<div class="row">{phone(conv, "10:15")}{notes([("Import", "Paste numbers from the phone or the register into one tab. A phone contacts export works too."),
("Win-back", f"About {wb['campaign']['per_day']} a day, most valuable first. Everyone is messaged once, and the message asks for consent."),
("Haan or Na", "Yes: they join the normal playbook. No: never listed again. Slow pace keeps the number safe from reports.")])}</div>''', "Step 4"))

# 5. Proof: holdout report
cl, ki = lift["clothing"]["reminders_and_winbacks"], lift["kirana"]["reminders_and_winbacks"]
def bar(label, rm, rh):
    w = lambda r: int(r * 560)
    return f'''<div style="margin-bottom:34px"><div style="font-size:26px;font-weight:800;margin-bottom:12px">{label}</div>
<div style="display:flex;align-items:center;gap:14px;margin-bottom:8px"><div style="width:150px;font-size:19px;color:#5b574f">Messaged</div><div style="height:34px;width:{w(rm)}px;background:#1a7f4b;border-radius:6px"></div><b style="font-size:22px">{rm*100:.0f}%</b></div>
<div style="display:flex;align-items:center;gap:14px"><div style="width:150px;font-size:19px;color:#5b574f">Held out</div><div style="height:34px;width:{w(rh)}px;background:#c9c0b1;border-radius:6px"></div><b style="font-size:22px">{rh*100:.0f}%</b></div></div>'''
pb_strip = "".join(f'<div style="flex:1;background:#fff;border-radius:18px;padding:20px 16px;text-align:center"><div style="font-size:34px">{i}</div><div style="font-size:21px;font-weight:700;margin-top:6px">{n}</div><div style="font-size:16px;color:#8a857b;margin-top:4px">{g}</div></div>'
    for i, n, g in [("👗", "Clothing", "every 2–3 months"), ("🛒", "Kirana", "every ~10 days"), ("💇", "Salon", "every ~5 weeks"), ("🍬", "Sweets", "birthdays, festivals")])
slides.append(page(f'''<div class="kick">Step 5 · Proof</div><h1>15% get nothing, on purpose.<br>That's how you know it works.</h1>
<div style="background:#fff;border-radius:24px;padding:36px 40px;margin-bottom:28px"><div style="font-size:19px;color:#8a857b;margin-bottom:24px">Came back within 14 days · mock run, planted effect</div>
{bar("Saree shop", cl["rate_messaged"], cl["rate_held_out"])}{bar("Kirana", ki["rate_messaged"], ki["rate_held_out"])}
<div style="font-size:23px;line-height:1.4;color:#3a3834">Saree customers needed the reminder. Kirana regulars were coming anyway.</div></div>
<div style="background:#1c1b19;color:#f6f3ee;border-radius:24px;padding:30px 36px;font-size:27px;line-height:1.4"><b style="color:#e8a77f">The real test starts this week.</b><br>It's switching on at my family's clothing store in Jaipur. Real numbers in 4 weeks, good or bad.</div>
<div style="margin-top:28px;display:flex;gap:14px">{pb_strip}</div>''', "Step 5", "Repo in the comments"))

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1080, "height": 1350})
    names = ["0_cover", "1_counter", "2_morning_list", "3_tap_send", "4_old_customers", "5_proof"]
    for n, s in zip(names, slides):
        pg.set_content(s); pg.screenshot(path=str(out / f"{n}.png"))
    allp = "".join(f'<div style="page-break-after:always;width:1080px;height:1350px;overflow:hidden">{s.split("<body>")[1].split("</body>")[0]}</div>' for s in slides)
    pg.set_content(f'<html><head><meta charset="utf-8"><style>{CSS.replace("body{", "body{display:block;padding:0;height:auto;").replace("width:1080px;height:1350px;background:#f6f3ee", "width:1080px;background:#f6f3ee")} .pg{{padding:64px 68px;display:flex;flex-direction:column}}</style></head><body>' + allp.replace('<div style="page-break-after:always;width:1080px;height:1350px;overflow:hidden">', '<div class="pg" style="page-break-after:always;width:1080px;height:1350px;overflow:hidden">') + '</body></html>')
    pg.pdf(path=str(out / "walkthrough.pdf"), width="1080px", height="1350px", print_background=True)
    b.close()
print("ok")
