import json, html, pathlib
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parent.parent
today = json.loads((root / "demo/today_2026-11-03.json").read_text())
normal = json.loads((root / "demo/list_2026-10-20.json").read_text())
lift = json.loads((root / "demo/lift_report.json").read_text())
BASE = """<html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:1080px;height:1350px;background:#f6f3ee;font-family:'Helvetica Neue',Arial,sans-serif;color:#1c1b19;padding:72px 68px;display:flex;flex-direction:column}
.kick{font-size:22px;letter-spacing:.14em;text-transform:uppercase;color:#a1502a;font-weight:700}
h1{font-size:54px;line-height:1.08;margin:14px 0 26px;font-weight:800;letter-spacing:-.01em}
.foot{margin-top:auto;font-size:19px;color:#8a857b;display:flex;justify-content:space-between}
</style></head><body>{body}<div class="foot"><span>WhatsApp Loyalty Agent · 12 Agents in 12 Weeks · Week 3</span><span>{note}</span></div></body></html>"""
page = lambda b, n="Mock shops, fictional customers": BASE.replace("{body}", b).replace("{note}", n)

# 1. The morning list, phone style (mix of stores so all playbooks show)
pick = lambda src, k, m: next(x for x in src[k]["list"] if x["moment"] == m)
picks = [("clothing", pick(today, "clothing", "festival")), ("sweets", pick(normal, "sweets", "birthday")), ("salon", pick(normal, "salon", "due_reminder")), ("kirana", pick(normal, "kirana", "due_reminder"))]
rows = ""
for k, x in picks:
    first = x["name"].split(" ")[0]
    rows += f'''<div style="background:#fff;border-radius:18px;padding:18px 20px;margin-bottom:14px;box-shadow:0 1px 0 #e5ded2">
<div style="display:flex;justify-content:space-between;font-size:17px;color:#8a857b;margin-bottom:8px"><span><b style="color:#1c1b19">{html.escape(x["name"])}</b> · {today[k]["store"]}</span><span>{x["moment"].replace("_"," ")}</span></div>
<div style="background:#eef6ec;border-radius:14px;padding:12px 14px;font-size:19px;line-height:1.38">{html.escape(x["message"])}</div>
<div style="margin-top:10px;display:inline-block;background:#1c1b19;color:#f6f3ee;border-radius:24px;padding:8px 18px;font-size:17px">Tap to open in WhatsApp →</div></div>'''
v1 = page(f'''<div class="kick">9 AM, on the shop phone</div><h1 style="font-size:50px">The agent writes the list.<br>The shopkeeper taps send.</h1>
<div style="display:flex;gap:28px"><div style="flex:1">{rows}</div></div>''', "Examples from the mock run · no API, no bot")

# 2. Playbooks
pbs = [("Clothing / saree", "~75 days", "Festival & shaadi collections · thank-you · win-back at 1.6× their gap"),
       ("Kirana", "~10 days", "“Send your list” when due · Diwali stock-up · “sab theek hai?”"),
       ("Salon", "~35 days", "“Slot book karein?” when due · festive glow-up · review ask"),
       ("Sweets / bakery", "by occasion", "Birthday pre-order 3 days before · festival dibbe · fresh batch")]
cards = "".join(f'<div style="background:#fffdf9;border-radius:18px;padding:24px 28px;margin-bottom:16px"><div style="display:flex;justify-content:space-between;align-items:baseline"><div style="font-size:30px;font-weight:800">{a}</div><div style="font-size:20px;color:#a1502a;font-weight:700">{"usual gap " + b if b[0] == "~" else b}</div></div><div style="font-size:21px;color:#4d4a44;margin-top:8px;line-height:1.35">{c}</div></div>' for a, b, c in pbs)
rules = '<div style="font-size:21px;line-height:1.5;color:#4d4a44;margin-top:8px">Same rules for every shop: <b>consent only</b> · one message a day · a gap between messages · a monthly cap · a short list you can actually tap through.</div>'
v2 = page(f'<div class="kick">One agent, four playbooks</div><h1>A saree shop and a kirana should not message the same way.</h1>{cards}{rules}', "Edit timing & wording in JSON")

# 3. Holdout honesty
a = lift["all"]; kir = lift["kirana"]["reminders_and_winbacks"]
f = lambda x: f"{x*100:.1f}"
stat = lambda big, small, dark=True: f'<div style="flex:1;background:{"#1c1b19" if dark else "#fffdf9"};color:{"#f6f3ee" if dark else "#1c1b19"};border-radius:18px;padding:24px 26px"><div style="font-size:46px;font-weight:800">{big}</div><div style="font-size:20px;color:{"#cfc8bb" if dark else "#5b574f"};line-height:1.3">{small}</div></div>'
v3 = page(f'''<div class="kick">The part most loyalty tools skip</div><h1 style="font-size:50px">15% of customers get nothing. On purpose.</h1>
<div style="background:#fffdf9;border-radius:18px;padding:26px 30px;font-size:23px;line-height:1.45;margin-bottom:22px">
That's the only way to know if a message <i>caused</i> the visit, or if the customer was coming anyway.</div>
<div style="display:flex;gap:16px;margin-bottom:16px">{stat(f"{f(kir['rate_messaged'])}% vs {f(kir['rate_held_out'])}%", "Kirana regulars came back at the same rate with or without reminders. Stop sending those.")}</div>
<div style="display:flex;gap:16px;margin-bottom:16px">{stat(f"+{f(a['diff'])} pts", f"All 4 shops, messaged vs held out, 5 months. 95% range {f(a['ci95'][0])} to +{f(a['ci95'][1])}: not proven yet.", False)}</div>
<div style="font-size:20px;color:#5b574f;line-height:1.4">Mock data with a message effect I planted. Even then, small shops need months to prove it. Real shops: be patient, and trust the holdout over your gut.</div>''', "Mock data · planted effect")
with sync_playwright() as p:
    b = p.chromium.launch()
    for n, d in [("1_morning_list", v1), ("2_playbooks", v2), ("3_holdout", v3)]:
        pg = b.new_page(viewport={"width": 1080, "height": 1350}); pg.set_content(d); pg.screenshot(path=str(root / f"docs/{n}.png")); pg.close()
    b.close()
print("ok")
