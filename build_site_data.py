"""
build_site_data.py
------------------
Builds casket-data.js for the project website from the files
produced in Google Colab (corpus, matches, theme dictionary, partial reading).

Run from the folder that holds all the project files:
    python build_site_data.py

Why this script exists
- The Colab notebook stored character offsets for a normalised copy of the
  text. The website highlights phrases in the original corpus, so every match
  is re-anchored here: within its own segment, longest phrases are placed
  first and shorter phrases may not overlap them (the same overlap rule the
  notebook used, which is why "the casket" counts 18 and not more).
- It also computes the exploratory statistics shown on the Analysis page
  (chi-square across stages, Spearman trend, narrative centroids) and a
  heuristic dialogue / narration split.

Output: a single JS file that sets window.CASKET, so the site works both on
GitHub Pages and when index.html is opened straight from disk.
"""
import csv
import json
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path

from scipy import stats

ROOT = Path(__file__).resolve().parent
CORPUS = (ROOT / "magic_casket.txt").read_text(encoding="utf-8")

DIMENSIONS = [
    ("investigation_and_observation", "Investigation and observation"),
    ("objects_and_material_value", "Objects and material value"),
    ("deception_and_concealment", "Deception and concealment"),
    ("knowledge_and_revelation", "Knowledge and revelation"),
]
SUBTYPES = {
    "investigation_and_observation": ["physical_observation", "suspicion_and_inquiry", "evidence_and_inspection"],
    "objects_and_material_value": ["objects_and_possessions", "appearance_and_material", "ownership_and_exchange"],
    "deception_and_concealment": ["theft_and_intrusion", "secrecy_and_hidden_information", "misleading_appearances"],
    "knowledge_and_revelation": ["reasoning_and_deduction", "language_and_decoding", "discovery_and_resolution"],
}
# Segmentation used in the Colab notebook (paragraph ranges, 1-based, inclusive)
SEGMENTS = [
    (1, 1, 11, "Opening discovery of the handbag and initial clues", "I"),
    (2, 12, 23, "Chinese stoneware jar and identification of Miss Mabel Bonney", "I"),
    (3, 24, 35, "Initial investigation and development of the mystery", "I"),
    (4, 36, 47, "Uyenishi and the background of the casket", "II"),
    (5, 48, 59, "The missing pearls and the history of the object", "II"),
    (6, 60, 71, "Prison, suspected burglars and connected individuals", "II"),
    (7, 72, 82, "Surveillance and the circumstances surrounding the exhibition", "II"),
    (8, 83, 94, "Thorndyke's examination of the casket's construction", "III"),
    (9, 95, 106, "Physical features and possible concealment inside the casket", "III"),
    (10, 107, 118, "The hidden Japanese message and its presentation", "III"),
    (11, 119, 130, "Decoding the message and identifying its key words", "IV"),
    (12, 131, 142, "Deduction about the possible hiding place of the pearls", "IV"),
    (13, 143, 154, "Exposure of the casket's secret and resolution", "IV"),
]
# Descriptions written after a full close reading. The Colab notes above were
# provisional labels for mechanical 12-paragraph blocks and several of them do
# not describe the paragraphs they cover (e.g. segment 4 has no Uyenishi
# material at all). Both are kept: "colabNote" for the record, "note" for display.
READ_NOTES = {
    1: "Night walk off King's Road; Thorndyke finds a forced handbag in a church porch and a jar with a museum label",
    2: "Returning the bag to Willow Walk; two Japanese men hurrying away; a police cab; the anxious maid",
    3: "Jervis guesses the bag was stolen; Brodribb glimpsed in a taxi; Thorndyke fits the facts together",
    4: "Interlude: the omnibus home, Brodribb's night visit, port by the fire (no thematic matches)",
    5: "Brodribb's account begins: the pearls in Harold Bonney's safe, the murder, Uyenishi's flight through Hand Court",
    6: "The pearls vanish; Mabel accepts liability; Uyenishi's prison casket; burglaries, shadowing, the exhibition, the street attack",
    7: "Brodribb names the casket's 'extrinsic value' and asks for help; Miss Bonney comes to tea",
    8: "Thorndyke examines the casket: white-metal casting, lacquer, a Shakudo base, etched decoration, 'an obvious anomaly'",
    9: "Japanese men in the Temple; the 'oracle' has spoken; the party walks to the pump in Bedford Row",
    10: "At the pump: Miss Bonney draws out the sealed leather bag, the necklace; three men approach; the police close in",
    11: "The police were pre-arranged; 'We've got the pearls'; dinner; Brodribb demands the words of the oracle",
    12: "Thorndyke's lecture: two physical facts, metallurgical and optical; the Japanese magic mirror",
    13: "How the mirror hid a chased message; decoding 'Pearls, Pump, Jokkis, Fields, London'; the casket as trophy",
}

STAGES = [
    ("I", "Discovery and Initial Mystery"),
    ("II", "Investigation and Suspicion"),
    ("III", "Examination and Deductive Reasoning"),
    ("IV", "Revelation and Resolution"),
]


def norm(s: str) -> str:
    return (s.replace("’", "'").replace("‘", "'")
             .replace("“", '"').replace("”", '"').lower())


def word_count(s: str) -> int:
    return len(s.split())


# ---------------------------------------------------------------- paragraphs
para_spans = [(m.start(), m.end()) for m in
              re.finditer(r"[^\n]+(?:\n(?!\s*\n)[^\n]+)*", CORPUS) if m.group().strip()]
assert len(para_spans) == 154, len(para_spans)
NORM = norm(CORPUS)


def in_dialogue(pos: int) -> bool:
    """Heuristic: is this offset inside a quotation in its paragraph?"""
    for a, b in para_spans:
        if a <= pos < b:
            before = CORPUS[a:pos]
            return before.count("“") > before.count("”")
    return False


# ---------------------------------------------------------------- segments
segments = []
for n, p0, p1, note, stage in SEGMENTS:
    a, b = para_spans[p0 - 1][0], para_spans[p1 - 1][1]
    segments.append({"n": n, "paras": f"{p0}–{p1}", "note": READ_NOTES[n], "colabNote": note, "stage": stage,
                     "start": a, "end": b, "words": word_count(CORPUS[a:b])})
TOTAL_WORDS = word_count(CORPUS)

# ---------------------------------------------------------------- re-anchor matches
rows = list(csv.DictReader(open(ROOT / "matches.csv", encoding="utf-8")))
by_seg = defaultdict(list)
for r in rows:
    by_seg[int(r["segment"])].append(r)

matches = []
for seg in segments:
    want = Counter((r["item"], r["dimension"], r["sub"]) for r in by_seg[seg["n"]])
    taken = []
    for (item, dim, sub), k in sorted(want.items(), key=lambda kv: -len(kv[0][0])):
        pat = r"(?<!\w)" + re.escape(norm(item)) + r"(?!\w)"
        found = 0
        for m in re.finditer(pat, NORM[seg["start"]:seg["end"]]):
            s, e = seg["start"] + m.start(), seg["start"] + m.end()
            if any(s < te and ts < e for ts, te in taken):
                continue
            taken.append((s, e))
            matches.append({"seg": seg["n"], "stage": seg["stage"], "dim": dim, "sub": sub,
                            "item": item, "s": s, "e": e, "dlg": in_dialogue(s)})
            found += 1
            if found == k:
                break
        assert found == k, (seg["n"], item, found, k)
matches.sort(key=lambda m: m["s"])
assert len(matches) == len(rows) == 154

# ---------------------------------------------------------------- aggregates
dim_keys = [d for d, _ in DIMENSIONS]
seg_dim = {s["n"]: Counter() for s in segments}
stage_dim = {k: Counter() for k, _ in STAGES}
stage_words = Counter()
for s in segments:
    stage_words[s["stage"]] += s["words"]
for m in matches:
    seg_dim[m["seg"]][m["dim"]] += 1
    stage_dim[m["stage"]][m["dim"]] += 1

dim_totals = Counter(m["dim"] for m in matches)
sub_totals = Counter((m["dim"], m["sub"]) for m in matches)
phrase_counts = Counter((m["item"], m["dim"], m["sub"]) for m in matches)

# exploratory statistics -------------------------------------------------------
stat_rows = []
L = len(CORPUS)
for d in dim_keys:
    obs = [stage_dim[k][d] for k, _ in STAGES]
    exp = [dim_totals[d] * stage_words[k] / TOTAL_WORDS for k, _ in STAGES]
    chi = stats.chisquare(obs, exp)
    dens = [100 * seg_dim[s["n"]][d] / s["words"] for s in segments]
    rho = stats.spearmanr(range(1, 14), dens)
    pos = [((m["s"] + m["e"]) / 2) / L for m in matches if m["dim"] == d]
    stat_rows.append({
        "dim": d, "observed": obs, "expected": [round(x, 2) for x in exp],
        "chi2": round(float(chi.statistic), 2), "p_chi": float(chi.pvalue),
        "min_expected": round(min(exp), 2),
        "rho": round(float(rho.statistic), 3), "p_rho": float(rho.pvalue),
        "centroid": round(statistics.mean(pos), 4),
        "q1": round(statistics.quantiles(pos, n=4)[0], 4),
        "median": round(statistics.median(pos), 4),
        "q3": round(statistics.quantiles(pos, n=4)[2], 4),
        "dialogue": sum(1 for m in matches if m["dim"] == d and m["dlg"]),
    })

# ---------------------------------------------------------------- theme dictionary
llm = json.load(open(ROOT / "llm_output.json", encoding="utf-8"))
audit = {(r["dimension"], r["subtype"], r["phrase"]): r["status"]
         for r in csv.DictReader(open(ROOT / "phrase_audit.csv", encoding="utf-8"))}
dictionary = []
for d in dim_keys:
    for sub in SUBTYPES[d]:
        for ph in llm[d][sub]:
            dictionary.append({"dim": d, "sub": sub, "item": ph,
                               "n": phrase_counts.get((ph, d, sub), 0),
                               "status": audit.get((d, sub, ph), "counted")})

# ---------------------------------------------------------------- partial reading
pr_text = (ROOT / "partial_reading.txt").read_text(encoding="utf-8")
blocks = []
parts = re.split(r"\nPART (\d) \((\w+)\)\n-+\n", pr_text)
marked = list(csv.DictReader(open(ROOT / "marked_phrase_audit.csv", encoding="utf-8")))
ws_corpus = re.sub(r"\s+", " ", NORM)
# index map from whitespace-collapsed text back to original offsets
idx_map, prev_space = [], False
for i, ch in enumerate(NORM):
    if ch.isspace():
        if not prev_space:
            idx_map.append(i)
        prev_space = True
    else:
        idx_map.append(i)
        prev_space = False

extracted_norm = {norm(x["item"]) for x in dictionary}
for i in range(1, len(parts), 3):
    num, mode, body = parts[i], parts[i + 1], parts[i + 2]
    passage = body.split("\n\nVerified marked phrases:")[0].strip()
    pn = re.sub(r"\s+", " ", norm(passage))
    a = ws_corpus.find(pn[:120])
    b = ws_corpus.find(pn[-120:]) + 120
    assert a >= 0 and b > a, num
    start, end = idx_map[a], idx_map[b - 1] + 1
    phr = []
    for r in marked:
        if r["part"] != num:
            continue
        p = norm(r["phrase"]).replace("thorndyke's ", "")
        hit = [x["item"] for x in dictionary if p in norm(x["item"]) or norm(x["item"]) in p]
        phr.append({"phrase": r["phrase"], "carried": bool(hit), "as": hit[:2]})
    blocks.append({"part": int(num), "mode": mode, "start": start, "end": end,
                   "words": word_count(CORPUS[start:end]), "marked": phr})

# share of the story's words that sit inside quotation marks (dialogue baseline)
dlg_words = 0
for a, b in para_spans:
    depth = 0
    for tok in re.finditer(r"\S+", CORPUS[a:b]):
        w = tok.group()
        inside = depth > 0 or "“" in w
        if inside:
            dlg_words += 1
        depth += w.count("“") - w.count("”")
        depth = max(depth, 0)

# The Colab notebook split the story into 487 "sentence-like units" (line breaks,
# or whitespace after . ! ?) and cut them into three parts of 162 / 162 / 163.
stripped = CORPUS.strip()
lead = CORPUS.index(stripped[:20])
units, cur = [], 0
for m in re.finditer(r"\n+|(?<=[.!?])\s+", stripped):
    if stripped[cur:m.start()].strip():
        units.append((lead + cur, lead + m.start()))
    cur = m.end()
if stripped[cur:].strip():
    units.append((lead + cur, lead + len(stripped)))
assert len(units) == 487, len(units)
cuts = [0, 162, 324, 487]
parts_spans = [[units[cuts[i]][0], units[cuts[i + 1] - 1][1]] for i in range(3)]
for m in matches:
    m["inSample"] = any(b["start"] <= m["s"] < b["end"] for b in blocks)

# ---------------------------------------------------------------- write
data = {
    "meta": {"title": "The Magic Casket", "author": "R. Austin Freeman",
             "words": TOTAL_WORDS, "chars": L, "paragraphs": 154,
             "matches": len(matches), "distinct": len({m['item'] for m in matches}),
             "dictionary": len(dictionary), "units": 487,
             "dialogueWords": dlg_words},
    "dimensions": [{"key": k, "label": v, "subs": SUBTYPES[k]} for k, v in DIMENSIONS],
    "stages": [{"key": k, "label": v, "words": stage_words[k]} for k, v in STAGES],
    "segments": [dict(s, counts={d: seg_dim[s["n"]][d] for d in dim_keys}) for s in segments],
    "stageCounts": {k: {d: stage_dim[k][d] for d in dim_keys} for k, _ in STAGES},
    "dimTotals": {d: dim_totals[d] for d in dim_keys},
    "subTotals": {f"{d}|{s}": sub_totals[(d, s)] for d in dim_keys for s in SUBTYPES[d]},
    "stats": stat_rows,
    "matches": matches,
    "dictionary": dictionary,
    "partial": blocks,
    "parts": parts_spans,
    "paragraphs": para_spans,
    "text": CORPUS,
    "files": {
        "prompt": (ROOT / "prompt.txt").read_text(encoding="utf-8"),
        "themeJson": (ROOT / "Theme_JSON.py").read_text(encoding="utf-8"),
    },
}
out = ROOT / "casket-data.js"
out.write_text("/* generated by build_site_data.py - do not edit by hand */\n"
               "window.CASKET = " + json.dumps(data, ensure_ascii=False) + ";\n", encoding="utf-8")
print(f"wrote {out.relative_to(ROOT)}  ({out.stat().st_size/1024:.0f} KB)")
for r in stat_rows:
    print(r["dim"][:14], r["observed"], "chi2", r["chi2"], "p", f"{r['p_chi']:.4f}",
          "rho", r["rho"], f"{r['p_rho']:.3f}", "centroid", r["centroid"], "dlg", r["dialogue"])
for b in blocks:
    print("part", b["part"], b["mode"], b["words"], "words;",
          sum(p["carried"] for p in b["marked"]), "/", len(b["marked"]), "marked phrases carried into extraction")
