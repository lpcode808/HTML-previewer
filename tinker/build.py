"""Bake an example app + its knob list into template.html -> index.html.

    python3 tinker/build.py            # uses examples/football.*
"""
import json
import pathlib

here = pathlib.Path(__file__).parent
code = (here / "examples/football.html").read_text()
knobs = (here / "examples/football.knobs.json").read_text()
blob = json.dumps({"code": code, "knobs": knobs}).replace("</", "<\\/")
page = (here / "template.html").read_text().replace("/*EXAMPLE*/null", blob, 1)
(here / "index.html").write_text(page)
print("wrote", here / "index.html")
