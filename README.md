# Reading the Magic Casket

**A synthetic reading of R. Austin Freeman's “The Magic Casket” (1927)**

Rupesh Rajak · MA Digital Humanities and Social Sciences
Indian Institute of Technology (Indian School of Mines) Dhanbad · Monsoon Semester 2026
Supervision: [Shanmugapriya T.](https://shanmugapriya.com/) and [Sourav Ghosh](https://linktr.ee/sourav.dh.litcult)

**Project website:** https://rupeshrajak456.github.io/synthetic_work/

---

## Research question

How does R. Austin Freeman use material clues, concealment and deductive reasoning to transform an apparently mysterious object into a source of knowledge?

## Claim tested

The narrative moves from the observation of suspicious objects and events towards the interpretation of concealed material evidence, with Thorndyke's deductive reasoning ultimately revealing the secret of the casket.

## Main finding

The four themes arrive in the predicted order. Their mean positions in the text are investigation 37%, objects 49%, concealment 61% and knowledge 87%. Three qualifications refine the claim:

1. **Objects never recede.** They make up 40% of all matches and are spread evenly across the stages (χ² = 5.10, p = 0.165). What changes is the register: possession in stage II, material in stages III–IV.
2. **Concealment peaks twice.** It appears first as crime (Brodribb's report, segment 6) and then as craft (Thorndyke's explanation, segment 13). The fullest language of hiding comes when the hiding is undone.
3. **The treasure comes before the reasoning.** The pearls are found in segment 10; the explanation follows in segments 12–13, and Thorndyke stages it that way on purpose.

Revised claim: the story moves its object from possession to matter to message, and gives each register to a different voice. Jervis looks, Brodribb reports, Thorndyke explains.

---

## The seven steps and their files

| Step | What | Files |
|---|---|---|
| 1 | Partial reading: 487 units in 3 parts (162/162/163); one 32-unit block read from each (first, random seed 42, last) | `partial_reading.txt`, `marked_phrase_audit.csv` |
| 2 | Initial impression, positionality, research problem, thematic framework | `initial_impression.md` |
| 3 | Full corpus (9,122 words, 154 paragraphs) | `magic_casket.txt` |
| 4 | Extraction prompt and model output | `prompt.txt`, `full_prompt.txt`, `raw_llm_output.json`, `llm_output.json` |
| 5 | Verified theme dictionary (131 phrases; 128 counted) | `Theme_JSON.py`, `phrase_audit.csv`, `removed_phrases.csv` |
| 6 | Matching and visualisation (154 occurrences) | `matches.csv`, `*_counts.csv`, `report.html`, website `analysis.html` |
| 7 | Interpretation | `interpretation.md`, website `interpretation.html` |

## Thematic framework

| Dimension | Sub-types |
|---|---|
| Investigation and observation | physical_observation · suspicion_and_inquiry · evidence_and_inspection |
| Objects and material value | objects_and_possessions · appearance_and_material · ownership_and_exchange |
| Deception and concealment | theft_and_intrusion · secrecy_and_hidden_information · misleading_appearances |
| Knowledge and revelation | reasoning_and_deduction · language_and_decoding · discovery_and_resolution |

## Model and verification

- Model: Claude (Anthropic), claude.ai chat, 5 November 2026. The full prompt and the raw answer are stored, so the record is the stored output, not a rerun.
- Checks: exact occurrence after Unicode, case and whitespace normalisation; whole-phrase boundaries; no duplicates across categories; researcher rejection list (empty).
- All 131 phrases occur in the text. Three are present but absorbed by longer overlapping phrases, which leaves 128 counted phrases and 154 occurrences.

---

## The website

A static site with no build step. Every file sits in one folder, the repository root, and GitHub Pages serves it from there.

```
index.html               Overview, the magic-mirror opening, headline finding, file map
method.html              Steps 1–3: partial reading, positionality, framework, lenses, segmentation
extraction.html          Steps 4–5: prompt, model run, verification, dictionary browser
analysis.html            Step 6: eight interactive figures and the statistics table
interpretation.html      Step 7: critical interpretation and works cited
reader.html              The full story with all 154 matches highlighted and filterable
about.html               Researcher and supervision
site.css                 Styles (light and dark)
site.js                  Shared header, footer, navigation and GitHub link (edit SITE here)
charts.js                Hand-built SVG charts
casket-data.js           Generated data used by every page
favicon.svg              Browser-tab icon
build_site_data.py       Rebuilds casket-data.js from the project files
report.html              Plotly report exported from Google Colab
visualisations.html      Plotly figures exported from Google Colab
extraction_README.md     Extraction record (model, date, checks)
```

### Rebuilding the data

If you change the corpus, the dictionary or `matches.csv`, regenerate the site data from the folder that holds all the files:

```bash
pip install scipy
python build_site_data.py
```

The script re-anchors every match in the original corpus. It places longer phrases first and does not let shorter ones overlap them, which is the same rule the Colab notebook used. It also computes the exploratory statistics (chi-square across stages, Spearman trend, mean positions) and a heuristic count of matches inside quotation marks.

### Colour and accessibility

The four theme colours were checked with a colour-vision-deficiency validator in both light and dark mode. Lines also differ by dash pattern, every chart has direct labels or a table, and the site follows the reader's light or dark setting.

## Source text and acknowledgements

R. Austin Freeman (1862–1943), “The Magic Casket”, in *The Magic Casket* (Hodder and Stoughton, 1927). Public domain in India and the United States.

Method modelled on Sourav Ghosh's [Wifes_Letter_JSON_themes](https://github.com/SouravGhosh-digital-humanities/Wifes_Letter_JSON_themes).
