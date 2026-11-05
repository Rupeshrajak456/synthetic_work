/* Reading the Magic Casket: hand-built SVG charts drawn from window.CASKET.
   Every chart redraws at the width of its container, keeps text in ink
   colours, uses the dimension colour only for marks, and ships a data table. */

const D = window.CASKET;
const NS = "http://www.w3.org/2000/svg";
const SEG_BY_N = Object.fromEntries(D.segments.map((s) => [s.n, s]));
const STAT_BY_DIM = Object.fromEntries(D.stats.map((s) => [s.dim, s]));

function S(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}
function T(parent, x, y, text, attrs = {}) {
  const n = S("text", { x, y, ...attrs }, parent);
  n.textContent = text;
  return n;
}
/* wrap a footnote into lines that fit maxW (approx. 6.1px per character at 11.5px) */
function TW(parent, x, y, text, maxW, attrs = {}) {
  const per = Math.max(10, Math.floor(maxW / 6.1));
  const lines = [];
  text.split(" ").forEach((w) => {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= per) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
  });
  const n = T(parent, x, y, "", attrs);
  lines.forEach((l, i) => { const t = S("tspan", { x, dy: i ? 15 : 0 }, n); t.textContent = l; });
  return lines.length;
}
const pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;
const f2 = (x) => x.toFixed(2);
const pval = (p) => (p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`);
const dens = (seg, dim) => (100 * seg.counts[dim]) / seg.words;

function stageSpans(scale = "chars") {
  return ["I", "II", "III", "IV"].map((k) => {
    const segs = D.segments.filter((s) => s.stage === k);
    return scale === "chars"
      ? { k, a: segs[0].start, b: segs[segs.length - 1].end }
      : { k, a: segs[0].n, b: segs[segs.length - 1].n };
  });
}

function makeSvg(el, w, h, label) {
  el.innerHTML = "";
  const svg = S("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: "img", "aria-label": label });
  el.appendChild(svg);
  return svg;
}

/* spread labels vertically so none overlap */
function spread(items, minGap, lo, hi) {
  items.sort((a, b) => a.y - b.y);
  for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < minGap) items[i].y = items[i - 1].y + minGap;
  const over = items.length ? items[items.length - 1].y - hi : 0;
  if (over > 0) items.forEach((it) => (it.y -= over));
  for (let i = items.length - 2; i >= 0; i--) if (items[i + 1].y - items[i].y < minGap) items[i].y = items[i + 1].y - minGap;
  items.forEach((it) => (it.y = Math.max(lo, it.y)));
  return items;
}

/* ================================================================ 1. dispersion + centroid */
function chartDispersion(el, opts = {}) {
  const W = el.clientWidth || 800;
  const narrow = W < 640;
  const L = narrow ? 8 : 200, R = 18, top = 34;
  const rowH = narrow ? 64 : 54;
  const H = top + rowH * 4 + 40;
  const svg = makeSvg(el, W, H, "Position of every matched phrase across the story, by theme, with the mean position marked");
  const x = (c) => L + (c / D.meta.chars) * (W - L - R);

  stageSpans().forEach((s, i) => {
    if (i % 2 === 1) S("rect", { class: "band", x: x(s.a), y: top - 22, width: x(s.b) - x(s.a), height: rowH * 4 + 22 }, svg);
    const name = narrow ? s.k : `${s.k}. ${STAGE_NAMES[s.k]}`;
    const mid = (x(s.a) + x(s.b)) / 2;
    const tw = x(s.b) - x(s.a);
    T(svg, mid, top - 8, name.length * 6.4 > tw - 8 ? s.k : name, { class: "band-label", "text-anchor": "middle" });
  });

  DIM_KEYS.forEach((dim, r) => {
    const y0 = top + r * rowH + (narrow ? 20 : 8);
    const st = STAT_BY_DIM[dim];
    if (narrow) T(svg, L, y0 - 6, `${DIMS[dim].label}: mean at ${pct(st.centroid)}`, { class: "lbl-strong" });
    else {
      T(svg, L - 14, y0 + 13, DIMS[dim].label, { class: "lbl-strong", "text-anchor": "end" });
      T(svg, L - 14, y0 + 29, `mean position ${pct(st.centroid)}`, { "text-anchor": "end", style: "font-size:11.5px" });
    }
    S("line", { x1: x(0), x2: x(D.meta.chars), y1: y0 + 26, y2: y0 + 26, stroke: "var(--rule)" }, svg);
    D.matches.forEach((m, i) => {
      if (m.dim !== dim) return;
      const cx = x((m.s + m.e) / 2);
      S("line", { x1: cx, x2: cx, y1: y0 + 4, y2: y0 + 26, style: `stroke:var(${DIMS[dim].v})`, "stroke-width": 2, "stroke-linecap": "round", opacity: 0.85 }, svg);
      const hit = S("rect", { class: "hit", x: cx - 4, y: y0, width: 8, height: 30, tabindex: 0, "aria-label": m.item }, svg);
      bindTip(hit, () => `<b>“${esc(m.item)}”</b><br>${subLabel(m.sub)}<br>Segment ${m.seg} · ${pct((m.s + m.e) / 2 / D.meta.chars)} through the story${m.dlg ? "<br>Inside dialogue" : ""}`);
      hit.addEventListener("click", () => (location.href = `reader.html#m${i}`));
    });
    // interquartile range + mean
    const yb = y0 + 36;
    S("line", { x1: x(st.q1 * D.meta.chars), x2: x(st.q3 * D.meta.chars), y1: yb, y2: yb, stroke: "var(--ink-2)", "stroke-width": 2, "stroke-linecap": "round" }, svg);
    const c = S("circle", { cx: x(st.centroid * D.meta.chars), cy: yb, r: 5.5, style: `fill:var(${DIMS[dim].v})`, stroke: "var(--paper)", "stroke-width": 2 }, svg);
    bindTip(c, () => `<b>${DIMS[dim].label}</b><br>Mean position ${pct(st.centroid, 1)}<br>Middle half of matches: ${pct(st.q1)} to ${pct(st.q3)}`);
  });

  const ya = top + rowH * 4 + 10;
  [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
    const xx = x(p * D.meta.chars);
    S("line", { x1: xx, x2: xx, y1: ya - 4, y2: ya, stroke: "var(--ink-3)" }, svg);
    T(svg, xx, ya + 15, p === 0 ? "Opening" : p === 1 ? "Last line" : pct(p), { "text-anchor": p === 0 ? "start" : p === 1 ? "end" : "middle" });
  });
}

/* ================================================================ 2. density lines */
function chartLines(el) {
  const W = el.clientWidth || 800;
  const narrow = W < 640;
  const L = 42, R = narrow ? 16 : 128, top = 34, B = 40;
  const H = narrow ? 300 : 360;
  const svg = makeSvg(el, W, H, "Matches per 100 words for each theme across the thirteen segments");
  const max = Math.max(...D.segments.flatMap((s) => DIM_KEYS.map((d) => dens(s, d))));
  const yMax = Math.ceil(max * 2) / 2;
  const x = (n) => L + ((n - 1) / 12) * (W - L - R);
  const y = (v) => H - B - (v / yMax) * (H - B - top);

  stageSpans("seg").forEach((s, i) => {
    const a = s.a === 1 ? x(1) : x(s.a - 0.5), b = s.b === 13 ? x(13) : x(s.b + 0.5);
    if (i % 2 === 1) S("rect", { class: "band", x: a, y: top - 22, width: b - a, height: H - B - top + 22 }, svg);
    const nm = `${s.k}. ${STAGE_NAMES[s.k]}`;
    T(svg, (a + b) / 2, top - 8, narrow || nm.length * 6.4 > b - a - 8 ? s.k : nm, { class: "band-label", "text-anchor": "middle" });
  });
  const g = S("g", { class: "grid" }, svg);
  for (let v = 0; v <= yMax + 1e-9; v += 0.5) {
    S("line", { x1: L, x2: W - R, y1: y(v), y2: y(v) }, g);
    T(svg, L - 8, y(v) + 4, v.toFixed(1), { "text-anchor": "end" });
  }
  D.segments.forEach((s) => T(svg, x(s.n), H - B + 18, s.n, { "text-anchor": "middle" }));
  T(svg, (L + W - R) / 2, H - 6, "Segment of the story (1 = opening, 13 = close)", { "text-anchor": "middle", style: "font-size:11.5px;fill:var(--ink-3)" });

  const ends = [];
  DIM_KEYS.forEach((dim) => {
    const pts = D.segments.map((s) => [x(s.n), y(dens(s, dim))]);
    S("path", { d: "M" + pts.map((p) => p.join(",")).join("L"), fill: "none", style: `stroke:var(${DIMS[dim].v})`, "stroke-width": 2, "stroke-dasharray": DIMS[dim].dash, "stroke-linejoin": "round" }, svg);
    pts.forEach((p) => S("circle", { cx: p[0], cy: p[1], r: 4, style: `fill:var(${DIMS[dim].v})`, stroke: "var(--paper)", "stroke-width": 2 }, svg));
    ends.push({ dim, y: pts[12][1] });
  });
  if (!narrow) spread(ends, 15, top, H - B).forEach((e) => T(svg, x(13) + 12, e.y + 4, DIMS[e.dim].short, { class: "lbl-strong" }));

  // crosshair
  const cross = S("line", { y1: top - 4, y2: H - B, stroke: "var(--ink-3)", "stroke-width": 1, opacity: 0 }, svg);
  const ov = S("rect", { x: L, y: top, width: W - L - R, height: H - B - top, fill: "transparent" }, svg);
  const pick = (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    return Math.min(13, Math.max(1, Math.round(1 + ((px - L) / (W - L - R)) * 12)));
  };
  ov.addEventListener("pointermove", (e) => {
    const n = pick(e), s = SEG_BY_N[n];
    cross.setAttribute("x1", x(n)); cross.setAttribute("x2", x(n)); cross.setAttribute("opacity", 1);
    Tip.show(`<b>Segment ${n}</b> · stage ${s.stage} · ${s.words} words<br><span style="opacity:.8">${esc(s.note)}</span>` +
      DIM_KEYS.map((d) => `<div class="row"><span><i class="sw" style="background:var(${DIMS[d].v})"></i>${DIMS[d].short}</span><b>${f2(dens(s, d))} (${s.counts[d]})</b></div>`).join(""), e.clientX, e.clientY);
  });
  ov.addEventListener("pointerleave", () => { cross.setAttribute("opacity", 0); Tip.hide(); });
}

/* ================================================================ 3. heatmap */
function chartHeatmap(el) {
  const W = el.clientWidth || 800;
  const narrow = W < 640;
  const L = narrow ? 84 : 210, R = 4, top = 40, cellH = 46;
  const H = top + cellH * 4 + (narrow ? 56 : 26);
  const svg = makeSvg(el, W, H, "Heatmap of matches per 100 words, theme by segment");
  const cw = (W - L - R) / 13;
  const max = Math.max(...D.segments.flatMap((s) => DIM_KEYS.map((d) => dens(s, d))));
  stageSpans("seg").forEach((s) => {
    const a = L + (s.a - 1) * cw, b = L + s.b * cw;
    S("line", { x1: a + 2, x2: b - 2, y1: top - 26, y2: top - 26, stroke: "var(--ink-3)" }, svg);
    T(svg, (a + b) / 2, top - 30, s.k, { class: "band-label", "text-anchor": "middle" });
  });
  D.segments.forEach((s) => T(svg, L + (s.n - 0.5) * cw, top - 8, s.n, { "text-anchor": "middle" }));
  DIM_KEYS.forEach((dim, r) => {
    const yy = top + r * cellH;
    T(svg, L - 12, yy + cellH / 2 + 4, narrow ? DIMS[dim].short : DIMS[dim].label, { "text-anchor": "end", class: "lbl-strong" });
    D.segments.forEach((s) => {
      const v = dens(s, dim), o = v / max;
      const xx = L + (s.n - 1) * cw;
      S("rect", { x: xx + 1, y: yy + 1, width: cw - 2, height: cellH - 2, rx: 3, fill: "var(--paper-2)" }, svg);
      const cell = S("rect", { x: xx + 1, y: yy + 1, width: cw - 2, height: cellH - 2, rx: 3, fill: "var(--seq)", "fill-opacity": o.toFixed(3), tabindex: 0 }, svg);
      if (s.counts[dim]) T(svg, xx + cw / 2, yy + cellH / 2 + 4, s.counts[dim], { "text-anchor": "middle", style: `fill:${o > 0.5 ? "#fff" : "var(--ink)"};font-weight:600;pointer-events:none` });
      bindTip(cell, () => `<b>${DIMS[dim].label}</b><br>Segment ${s.n}: ${s.counts[dim]} matches in ${s.words} words<br>${f2(v)} per 100 words<br><span style="opacity:.8">${esc(s.note)}</span>`);
    });
  });
  TW(svg, narrow ? 0 : L, H - (narrow ? 34 : 4), "Number in each cell: matches. Shade: matches per 100 words (darker is denser).", narrow ? W : W - L, { style: "font-size:11.5px;fill:var(--ink-3)" });
}

/* ================================================================ 4. observed vs expected by stage */
function chartStages(el) {
  el.innerHTML = "";
  el.style.display = "grid";
  el.style.gridTemplateColumns = `repeat(auto-fit, minmax(${el.clientWidth < 640 ? 240 : 250}px, 1fr))`;
  el.style.gap = "18px 26px";
  const holders = [];
  DIM_KEYS.forEach((dim) => {
    const st = STAT_BY_DIM[dim];
    const box = document.createElement("div");
    box.innerHTML = `<div class="ui" style="font-size:.9rem;font-weight:600">${DIMS[dim].label}</div>
      <div class="ui small muted">χ² = ${st.chi2}, ${pval(st.p_chi)}</div>`;
    const holder = document.createElement("div");
    holder.className = "chart";
    box.appendChild(holder);
    el.appendChild(box);
    holders.push([dim, st, holder]);
  });
  holders.forEach(([dim, st, holder]) => {
    const W = holder.clientWidth || 260, H = 190, L = 28, B = 34, top = 14;
    const svg = makeSvg(holder, W, H, `${DIMS[dim].label}: observed and expected matches per stage`);
    const max = Math.max(...st.observed, ...st.expected);
    const yMax = Math.ceil(max / 5) * 5;
    const y = (v) => H - B - (v / yMax) * (H - B - top);
    const bw = (W - L) / 4;
    const g = S("g", { class: "grid" }, svg);
    [0, yMax / 2, yMax].forEach((v) => { S("line", { x1: L, x2: W, y1: y(v), y2: y(v) }, g); T(svg, L - 6, y(v) + 4, v, { "text-anchor": "end" }); });
    ["I", "II", "III", "IV"].forEach((k, i) => {
      const cx = L + bw * i + bw / 2, w = Math.min(34, bw * 0.5);
      const o = st.observed[i], ex = st.expected[i];
      if (o > 0) {
        const h = H - B - y(o), r = Math.min(4, h);
        S("path", { d: `M${cx - w / 2},${H - B} V${y(o) + r} q0,-${r} ${r},-${r} H${cx + w / 2 - r} q${r},0 ${r},${r} V${H - B} Z`, style: `fill:var(${DIMS[dim].v})` }, svg);
      }
      S("line", { x1: cx - w / 2 - 6, x2: cx + w / 2 + 6, y1: y(ex), y2: y(ex), stroke: "var(--ink)", "stroke-width": 2, "stroke-dasharray": "4 2" }, svg);
      T(svg, cx, H - B + 16, k, { "text-anchor": "middle" });
      T(svg, cx, Math.min(y(o), y(ex)) - 6, o, { "text-anchor": "middle", class: "lbl-strong" });
      const hit = S("rect", { class: "hit", x: cx - bw / 2, y: top, width: bw, height: H - B - top, tabindex: 0 }, svg);
      bindTip(hit, () => `<b>${DIMS[dim].short}, stage ${k}</b><br>${STAGE_NAMES[k]}<br>Observed ${o} · expected ${ex.toFixed(1)}<br>${o > ex ? "More" : "Fewer"} than the stage's length predicts`);
    });
  });
}

/* ================================================================ 5. horizontal bars (sub-types, phrases) */
function hbars(el, rows, { labelW = 230, label = "", valueFmt = (v) => v, groupHeads = false } = {}) {
  const W = el.clientWidth || 800;
  const narrow = W < 640;
  const LW = narrow ? Math.min(labelW, W * 0.48) : labelW;
  const rowH = 26, top = 4;
  const heads = groupHeads ? rows.filter((r) => r.head).length : 0;
  const H = top + rows.length * rowH + heads * 8 + 10;
  const svg = makeSvg(el, W, H, label);
  const max = Math.max(...rows.filter((r) => !r.head).map((r) => r.v));
  const x = (v) => (v / max) * (W - LW - 44);
  let yy = top;
  rows.forEach((r) => {
    if (r.head) {
      yy += 8;
      T(svg, 0, yy + 16, r.label, { class: "lbl-strong", style: "font-size:12.5px" });
      yy += rowH;
      return;
    }
    const lab = T(svg, LW - 10, yy + 17, r.label.length > (narrow ? 26 : 44) ? r.label.slice(0, narrow ? 24 : 42) + "…" : r.label, { "text-anchor": "end", style: r.serif ? "font-family:var(--f-text);font-size:13.5px;fill:var(--ink)" : "" });
    const w = Math.max(2, x(r.v));
    S("path", { d: `M${LW},${yy + 5} H${LW + w - 4} q4,0 4,4 V${yy + 17} q0,4 -4,4 H${LW} Z`, style: `fill:var(${DIMS[r.dim].v})` }, svg);
    T(svg, LW + w + 6, yy + 17, valueFmt(r.v), { class: "lbl-strong" });
    const hit = S("rect", { class: "hit", x: 0, y: yy, width: W, height: rowH, tabindex: 0 }, svg);
    bindTip(hit, () => r.tip || `<b>${esc(r.label)}</b><br>${valueFmt(r.v)}`);
    yy += rowH;
  });
  return svg;
}

function chartSubtypes(el) {
  const rows = [];
  D.dimensions.forEach((d) => {
    rows.push({ head: true, label: d.label });
    d.subs.forEach((s) => {
      const v = D.subTotals[`${d.key}|${s}`];
      rows.push({ label: subLabel(s), v, dim: d.key, tip: `<b>${subLabel(s)}</b><br>${DIMS[d.key].label}<br>${v} matches (${pct(v / D.meta.matches, 1)} of all)` });
    });
  });
  hbars(el, rows, { labelW: 230, label: "Matches per sub-type", groupHeads: true });
}

function chartTopPhrases(el, n = 15) {
  const counts = {};
  D.matches.forEach((m) => { const k = m.item; counts[k] = counts[k] || { v: 0, dim: m.dim, sub: m.sub, first: m.s }; counts[k].v++; });
  const rows = Object.entries(counts).sort((a, b) => b[1].v - a[1].v || a[1].first - b[1].first).slice(0, n)
    .map(([k, c]) => ({ label: k, v: c.v, dim: c.dim, serif: true, tip: `<b>“${esc(k)}”</b><br>${DIMS[c.dim].short} · ${subLabel(c.sub)}<br>${c.v} occurrence${c.v > 1 ? "s" : ""}` }));
  hbars(el, rows, { labelW: 300, label: "Most frequent extracted phrases" });
}

/* ================================================================ 6. narration vs dialogue */
function chartVoice(el) {
  const W = el.clientWidth || 800;
  const narrow = W < 640;
  const L = narrow ? 0 : 210, R = 50, top = 30, rowH = narrow ? 58 : 40;
  const H = top + rowH * 4 + (narrow ? 50 : 30);
  const svg = makeSvg(el, W, H, "Share of each theme's matches that fall inside dialogue");
  const base = D.meta.dialogueWords / D.meta.words;
  const x = (p) => L + p * (W - L - R);
  DIM_KEYS.forEach((dim, r) => {
    const st = STAT_BY_DIM[dim], tot = D.dimTotals[dim], p = st.dialogue / tot;
    const yy = top + r * rowH + (narrow ? 18 : 0);
    if (narrow) T(svg, 0, yy - 6, DIMS[dim].label, { class: "lbl-strong" });
    else T(svg, L - 12, yy + 17, DIMS[dim].label, { "text-anchor": "end", class: "lbl-strong" });
    S("rect", { x: x(0), y: yy + 4, width: x(p) - x(0) - 1, height: 18, rx: 3, style: `fill:var(${DIMS[dim].v})` }, svg);
    S("rect", { x: x(p) + 1, y: yy + 4, width: x(1) - x(p) - 1, height: 18, rx: 3, fill: "var(--paper-3)" }, svg);
    T(svg, x(1) + 8, yy + 18, pct(p), { class: "lbl-strong" });
    const hit = S("rect", { class: "hit", x: x(0), y: yy, width: x(1) - x(0), height: 26, tabindex: 0 }, svg);
    bindTip(hit, () => `<b>${DIMS[dim].label}</b><br>${st.dialogue} of ${tot} matches inside dialogue (${pct(p)})<br>${tot - st.dialogue} in Jervis's narration`);
  });
  const bx = x(base);
  S("line", { x1: bx, x2: bx, y1: top - 14, y2: top + rowH * 4 + (narrow ? 14 : 0), stroke: "var(--ink)", "stroke-width": 1.5, "stroke-dasharray": "4 3" }, svg);
  T(svg, bx, top - 18, narrow ? `Whole story: ${pct(base)} dialogue` : `Share of the whole story in dialogue: ${pct(base)}`, { "text-anchor": narrow ? "end" : bx > W * 0.6 ? "end" : "middle", style: "font-size:11.5px;fill:var(--ink)" });
  TW(svg, x(0), H - (narrow ? 21 : 6), "Coloured: inside quotation marks (a character speaking). Grey: the narrator, Jervis.", W - 4, { style: "font-size:11.5px;fill:var(--ink-3)" });
}

/* ================================================================ 7. partial reading map */
function chartPartial(el) {
  const W = el.clientWidth || 800;
  const narrow = W < 640;
  const L = 8, R = 8, top = 30;
  const H = narrow ? 215 : 170;
  const svg = makeSvg(el, W, H, "The three parts of the story, the sampled block in each, and where the final matches fall");
  const x = (c) => L + (c / D.meta.chars) * (W - L - R);
  const barY = top + 18, barH = 30;
  D.parts.forEach(([a, b], i) => {
    S("rect", { x: x(a) + (i ? 2 : 0), y: barY, width: x(b) - x(a) - (i ? 2 : 0), height: barH, rx: 3, fill: "var(--paper-2)" }, svg);
    T(svg, x(a) + (i ? 6 : 0), top + 8, narrow ? `Part ${i + 1}` : `Part ${i + 1} · ${[162, 162, 163][i]} units`, { class: "band-label" });
  });
  D.partial.forEach((b) => {
    const r = S("rect", { x: x(b.start), y: barY, width: Math.max(3, x(b.end) - x(b.start)), height: barH, rx: 3, fill: "var(--gold)", tabindex: 0 }, svg);
    bindTip(r, () => `<b>Part ${b.part}: ${b.mode} block</b><br>32 units · ${b.words} words<br>${b.marked.length} phrases marked during partial reading`);
    T(svg, (x(b.start) + x(b.end)) / 2, barY + barH + 16, b.mode, { "text-anchor": b.part === 1 ? "start" : b.part === 3 ? "end" : "middle", style: "font-size:11.5px;fill:var(--ink)" });
  });
  const ty = barY + barH + 30;
  TW(svg, L, ty + 34, "Each tick is one of the 154 matches found later in the full text; dark ticks fall inside a sampled block.", W - L - R, { style: "font-size:11.5px;fill:var(--ink-3)" });
  D.matches.forEach((m) => {
    const cx = x(m.s);
    S("line", { x1: cx, x2: cx, y1: ty, y2: ty + 16, stroke: m.inSample ? "var(--ink)" : "var(--ink-3)", "stroke-width": m.inSample ? 1.6 : 1, opacity: m.inSample ? 1 : 0.45 }, svg);
  });
}

/* ================================================================ 8. sub-type by stage matrix */
function chartSubStage(el) {
  const W = el.clientWidth || 800;
  const narrow = W < 640;
  const L = narrow ? 150 : 250, R = 10, top = 40, rowH = 30, gap = 14;
  const H = top + 12 * rowH + 3 * gap + 10;
  const svg = makeSvg(el, W, H, "Matches for each sub-type in each narrative stage");
  const cnt = {};
  D.matches.forEach((m) => { const k = `${m.sub}|${m.stage}`; cnt[k] = (cnt[k] || 0) + 1; });
  const max = Math.max(...Object.values(cnt));
  const cw = (W - L - R) / 4;
  ["I", "II", "III", "IV"].forEach((k, i) => {
    const cx = L + cw * i + cw / 2;
    T(svg, cx, top - 22, k, { "text-anchor": "middle", class: "lbl-strong" });
    if (!narrow) T(svg, cx, top - 8, STAGE_NAMES[k].split(" ")[0], { "text-anchor": "middle", class: "band-label" });
    if (i % 2) S("rect", { class: "band", x: L + cw * i, y: top - 2, width: cw, height: H - top - 6 }, svg);
  });
  let yy = top;
  D.dimensions.forEach((d, di) => {
    if (di) yy += gap;
    d.subs.forEach((sub) => {
      T(svg, L - 12, yy + rowH / 2 + 4, subLabel(sub), { "text-anchor": "end" });
      S("line", { x1: L, x2: W - R, y1: yy + rowH, y2: yy + rowH, stroke: "var(--rule)" }, svg);
      ["I", "II", "III", "IV"].forEach((k, i) => {
        const v = cnt[`${sub}|${k}`] || 0;
        const cx = L + cw * i + cw / 2, cy = yy + rowH / 2;
        if (v) {
          const r = 3 + 10 * Math.sqrt(v / max);
          S("circle", { cx: cx - 8, cy, r, style: `fill:var(${DIMS[d.key].v})`, stroke: "var(--paper)", "stroke-width": 1.5 }, svg);
          T(svg, cx - 8 + r + 5, cy + 4, v, { class: "lbl-strong" });
        } else T(svg, cx - 8, cy + 4, "·", { "text-anchor": "middle", style: "fill:var(--ink-3)" });
        const hit = S("rect", { class: "hit", x: L + cw * i, y: yy, width: cw, height: rowH, tabindex: v ? 0 : -1 }, svg);
        bindTip(hit, () => {
          const ex = D.matches.filter((m) => m.sub === sub && m.stage === k).slice(0, 4).map((m) => `“${esc(m.item)}”`).join("<br>");
          return `<b>${subLabel(sub)}, stage ${k}</b><br>${v} match${v === 1 ? "" : "es"}${ex ? "<br><span style='opacity:.85'>" + ex + "</span>" : ""}`;
        });
      });
      yy += rowH;
    });
  });
}

/* ================================================================ tables */
function tableSegments() {
  return `<div class="tbl-wrap"><table class="t"><thead><tr><th>Seg.</th><th>Stage</th><th class="r">Words</th>${DIM_KEYS.map((d) => `<th class="r">${DIMS[d].short}</th>`).join("")}<th>What happens</th></tr></thead><tbody>${D.segments
    .map((s) => `<tr><td>${s.n}</td><td>${s.stage}</td><td class="r">${s.words}</td>${DIM_KEYS.map((d) => `<td class="r">${s.counts[d]} <span class="muted">(${f2(dens(s, d))})</span></td>`).join("")}<td>${esc(s.note)}</td></tr>`)
    .join("")}</tbody></table></div><p class="small muted">Counts, with matches per 100 words in brackets.</p>`;
}
function tableStats() {
  return `<div class="tbl-wrap"><table class="t"><thead><tr><th>Theme</th><th class="r">Matches</th><th class="r">Observed I / II / III / IV</th><th class="r">Expected by length</th><th class="r">χ² (df = 3)</th><th class="r">p</th><th class="r">Spearman ρ</th><th class="r">p</th><th class="r">Mean position</th></tr></thead><tbody>${D.stats
    .map((s) => `<tr><td><span class="dim d-${s.dim}">${DIMS[s.dim].label}</span></td><td class="r">${D.dimTotals[s.dim]}</td><td class="r">${s.observed.join(" / ")}</td><td class="r">${s.expected.map((v) => v.toFixed(1)).join(" / ")}</td><td class="r">${s.chi2}</td><td class="r">${s.p_chi < 0.001 ? "&lt; 0.001" : s.p_chi.toFixed(3)}</td><td class="r">${s.rho.toFixed(2)}</td><td class="r">${s.p_rho.toFixed(3)}</td><td class="r">${pct(s.centroid, 1)}</td></tr>`)
    .join("")}</tbody></table></div>`;
}

/* ================================================================ mount + redraw on resize */
const CHARTS = { substage: chartSubStage, dispersion: chartDispersion, lines: chartLines, heatmap: chartHeatmap, stages: chartStages, subtypes: chartSubtypes, phrases: chartTopPhrases, voice: chartVoice, partial: chartPartial };
function mountCharts() {
  document.querySelectorAll("[data-chart]").forEach((el) => CHARTS[el.dataset.chart]?.(el));
  document.querySelectorAll("[data-table]").forEach((el) => {
    el.innerHTML = { segments: tableSegments, stats: tableStats }[el.dataset.table]?.() || "";
  });
  document.querySelectorAll("[data-legend]").forEach((el) => (el.innerHTML = legendHTML(DIM_KEYS, el.dataset.legend)));
}
let lastW = 0;
window.addEventListener("resize", () => {
  if (Math.abs(innerWidth - lastW) < 30) return;
  clearTimeout(window.__rz);
  window.__rz = setTimeout(() => { lastW = innerWidth; document.querySelectorAll("[data-chart]").forEach((el) => CHARTS[el.dataset.chart]?.(el)); }, 150);
});
document.addEventListener("DOMContentLoaded", () => { lastW = innerWidth; mountCharts(); });
