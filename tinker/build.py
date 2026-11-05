"""Bake one app + its knob list into a single tinker page you can hand out.

    python3 tinker/build.py APP.html KNOBS.json            # writes APP-tinker.html next to APP.html
    python3 tinker/build.py APP.html KNOBS.json -o out.html
    python3 tinker/build.py                                # rebuilds tinker/index.html (football example)

KNOBS.json can be the model's answer pasted as-is: a sentence before it or ``` fences around it are
fine. Before writing, every knob is checked against the app with the same rules the page uses, so you
see problems before a student does. Knobs that fail are still written (the page shows them in red and
skips them). Add --strict to write nothing if any knob fails.
"""
import argparse
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).parent


def parse_knobs(text):
    a, b = text.find("{"), text.rfind("}")
    if a < 0 or b < a:
        raise ValueError("no knob list ({ ... }) found in the knobs file")
    data = json.loads(text[a : b + 1])
    if not isinstance(data.get("knobs"), list):
        raise ValueError('the knob list has no "knobs" array')
    return data


def check(code, knobs):
    """Mirror locate() + the overlap rule in template.html. Returns one result per knob."""
    results = []
    for k in knobs:
        r = {"label": k.get("label") or "(no label)", "ok": False, "problem": "", "line": None}
        snippet, value = k.get("code") or "", k.get("value") or ""
        if not snippet or not value:
            r["problem"] = "missing code or value"
        elif code.count(snippet) == 0:
            r["problem"] = "code not found in the app (mis-copied?)"
        elif code.count(snippet) > 1:
            r["problem"] = f"code appears {code.count(snippet)} times; it must be unique"
        elif value not in snippet:
            r["problem"] = "value is not inside the quoted code"
        else:
            start = code.index(snippet) + snippet.index(value)
            r.update(ok=True, start=start, end=start + len(value), line=code[:start].count("\n") + 1)
        results.append(r)
    ok = sorted((r for r in results if r["ok"]), key=lambda r: r["start"])
    for prev, cur in zip(ok, ok[1:]):
        if prev["ok"] and cur["start"] < prev["end"]:
            cur.update(ok=False, problem=f'overlaps "{prev["label"]}"')
    return results


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("app", nargs="?", help="the student's HTML file")
    ap.add_argument("knobs", nargs="?", help="the knob list (JSON, or the model's answer as-is)")
    ap.add_argument("-o", "--out", help="output file (default: APP-tinker.html next to APP)")
    ap.add_argument("--strict", action="store_true", help="write nothing if any knob fails")
    args = ap.parse_args()

    if not args.app:
        app, knobs_path, out = HERE / "examples/football.html", HERE / "examples/football.knobs.json", HERE / "index.html"
    elif not args.knobs:
        ap.error("give both APP.html and KNOBS.json")
    else:
        app, knobs_path = pathlib.Path(args.app), pathlib.Path(args.knobs)
        out = pathlib.Path(args.out) if args.out else app.with_name(app.stem + "-tinker.html")

    code = app.read_text(encoding="utf-8")
    knob_text = knobs_path.read_text(encoding="utf-8")
    try:
        data = parse_knobs(knob_text)
    except (ValueError, json.JSONDecodeError) as e:
        sys.exit(f"knobs: {e}")

    results = check(code, data["knobs"])
    for r in results:
        mark = f"ok    line {r['line']:>4}" if r["ok"] else "FAIL         "
        print(f"  {mark}  {r['label']}" + ("" if r["ok"] else f"  ({r['problem']})"))
    good = sum(r["ok"] for r in results)
    print(f"{good} of {len(results)} knobs match {app.name}")
    if args.strict and good < len(results):
        sys.exit("--strict: nothing written")

    blob = json.dumps({"code": code, "knobs": knob_text}).replace("</", "<\\/")
    page = (HERE / "template.html").read_text(encoding="utf-8").replace("/*EXAMPLE*/null", blob, 1)
    out.write_text(page, encoding="utf-8")
    print("wrote", out)


if __name__ == "__main__":
    main()
