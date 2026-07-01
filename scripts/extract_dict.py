#!/usr/bin/env python3
"""Extract the Trigg haiku dictionary and grammar frames from mochimo trigg.c/h
into JSON for use by the JavaScript codec. Source of truth: mochimodev/mochimo."""
import json, re, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "../mochimo-src/src/trigg.c"
HDR = sys.argv[2] if len(sys.argv) > 2 else "../mochimo-src/src/trigg.h"

hdr = open(HDR).read()
feats = {}
for m in re.finditer(r'#define\s+(F_\w+|S_\w+)\s+(.+)', hdr):
    name, expr = m.group(1), m.group(2).split('/*')[0].strip()
    feats[name] = expr

def ev(name, seen=None):
    seen = seen or set()
    if name in seen: raise ValueError(name)
    seen.add(name)
    expr = feats[name]
    expr = re.sub(r'\b(F_\w+|S_\w+)\b', lambda m: str(ev(m.group(1), seen.copy())), expr)
    return eval(expr)

FVAL = {k: ev(k) for k in feats if k != 'F_VB'}  # F_VB references undefined F_INT upstream; unused

src = open(SRC).read()
dict_block = re.search(r'static DICT Dict\[MAXDICT\] = \{(.*?)\};\s*/\* end Dict\[\] \*/', src, re.S).group(1)
entries = []
for m in re.finditer(r'\{\s*"((?:\\.|[^"\\])*)"\s*,\s*([^}]+)\}', dict_block):
    tok_raw, fexpr = m.group(1), m.group(2).strip()
    tok = tok_raw.encode().decode('unicode_escape')
    fe = eval(re.sub(r'\b(F_\w+|S_\w+)\b', lambda mm: str(FVAL[mm.group(1)]), fexpr))
    entries.append({"tok": tok, "fe": fe})
assert len(entries) == 256, f"expected 256 dict entries, got {len(entries)}"

frame_block = re.search(r'static word32 Frame\[NFRAMES\]\[MAXH\] = \{(.*?)\};\s*/\* end Frame', src, re.S)
frames = []
for fb in re.finditer(r'\{([^{}]*)\}', frame_block.group(1)):
    body = re.sub(r'/\*.*?\*/', '', fb.group(1), flags=re.S)
    vals = [v.strip() for v in body.split(',') if v.strip()]
    row = [eval(re.sub(r'\b(F_\w+|S_\w+)\b', lambda mm: str(FVAL[mm.group(1)]), v)) for v in vals]
    row += [0] * (16 - len(row))
    frames.append(row)
assert len(frames) == 10, f"expected 10 frames, got {len(frames)}"

out = {"source": "mochimodev/mochimo src/trigg.c (master)",
       "features": FVAL, "dict": entries, "frames": frames}
json.dump(out, open("codec/trigg_data.json", "w"), indent=1)
print(f"OK: {len(entries)} words, {len(frames)} frames -> codec/trigg_data.json")
