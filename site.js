/* Reading the Magic Casket: shared header, footer, tooltip and helpers.
   Edit SITE below to change the navigation or repository link on every page. */

const SITE = {
  title: "Reading the Magic Casket",
  repo: "https://github.com/Rupeshrajak456/synthetic_work",
  branch: "main",
  pages: [
    ["index.html", "Overview"],
    ["method.html", "Method"],
    ["extraction.html", "Extraction"],
    ["analysis.html", "Analysis"],
    ["interpretation.html", "Interpretation"],
    ["reader.html", "Annotated text"],
    ["about.html", "About"],
  ],
};

const DIMS = {
  investigation_and_observation: { label: "Investigation and observation", short: "Investigation", v: "--s-inv", dash: "" },
  objects_and_material_value: { label: "Objects and material value", short: "Objects", v: "--s-obj", dash: "7 4" },
  deception_and_concealment: { label: "Deception and concealment", short: "Deception", v: "--s-dec", dash: "2 4" },
  knowledge_and_revelation: { label: "Knowledge and revelation", short: "Knowledge", v: "--s-know", dash: "10 3 2 3" },
};
const DIM_KEYS = Object.keys(DIMS);
const STAGE_NAMES = { I: "Discovery and Initial Mystery", II: "Investigation and Suspicion", III: "Examination and Deductive Reasoning", IV: "Revelation and Resolution" };

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const subLabel = (s) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fileUrl = (path) => `${SITE.repo}/blob/${SITE.branch}/${path}`;

const GH_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
const MARK = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="16" cy="16" r="8.5" fill="none" stroke="currentColor" stroke-width=".9" opacity=".55"/><path d="M9 21 L23 11" stroke="var(--gold)" stroke-width="2.2" stroke-linecap="round"/></svg>';

function renderChrome() {
  const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const head = document.getElementById("site-head");
  if (head) {
    head.className = "site-head";
    head.innerHTML = `
      <div class="bar">
        <a class="brand" href="index.html">${MARK}<b>${SITE.title}</b></a>
        <button class="menu-btn" aria-expanded="false" aria-controls="site-nav">Menu</button>
        <nav class="nav" id="site-nav" aria-label="Main">
          ${SITE.pages.map(([href, name]) => `<a href="${href}"${href === here ? ' aria-current="page"' : ""}>${name}</a>`).join("")}
          <a class="gh" href="${SITE.repo}" target="_blank" rel="noopener">${GH_ICON}<span>GitHub</span></a>
        </nav>
      </div>`;
    const btn = head.querySelector(".menu-btn");
    const nav = head.querySelector(".nav");
    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open);
      btn.textContent = open ? "Close" : "Menu";
    });
  }
  const foot = document.getElementById("site-foot");
  if (foot) {
    foot.className = "site-foot";
    foot.innerHTML = `
      <div class="wrap cols">
        <div>
          <h2>${SITE.title}</h2>
          <p>A synthetic reading of R. Austin Freeman's "The Magic Casket": partial reading, LLM-assisted thematic extraction, visualisation and critical interpretation.</p>
          <p><a href="${SITE.repo}" target="_blank" rel="noopener">Source files and data on GitHub</a></p>
        </div>
        <div>
          <h2>Researcher</h2>
          <p>Rupesh Rajak<br>MA, Digital Humanities and Social Sciences<br>Indian Institute of Technology (Indian School of Mines) Dhanbad</p>
          <p><a href="mailto:25ma0009@iitism.ac.in">25ma0009@iitism.ac.in</a></p>
        </div>
        <div>
          <h2>Supervision</h2>
          <p><a href="https://shanmugapriya.com/" target="_blank" rel="noopener">Shanmugapriya T.</a><br><a href="https://linktr.ee/sourav.dh.litcult" target="_blank" rel="noopener">Sourav Ghosh</a></p>
          <p>Department of Humanities and Social Sciences<br>Monsoon Semester 2026</p>
        </div>
      </div>`;
  }
}

/* ------------------------------------------------------------ tooltip */
const Tip = (() => {
  let el;
  const ensure = () => {
    if (!el) { el = document.createElement("div"); el.className = "tip"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    return el;
  };
  return {
    show(html, x, y) {
      const t = ensure();
      t.innerHTML = html;
      t.classList.add("on");
      const r = t.getBoundingClientRect();
      let left = x + 14, top = y + 14;
      if (left + r.width > innerWidth - 8) left = x - r.width - 14;
      if (top + r.height > innerHeight - 8) top = y - r.height - 14;
      t.style.left = Math.max(8, left) + "px";
      t.style.top = Math.max(8, top) + "px";
    },
    hide() { if (el) el.classList.remove("on"); },
  };
})();

function bindTip(node, htmlFn) {
  node.addEventListener("pointermove", (e) => Tip.show(htmlFn(e), e.clientX, e.clientY));
  node.addEventListener("pointerleave", () => Tip.hide());
  node.addEventListener("focus", () => { const r = node.getBoundingClientRect(); Tip.show(htmlFn(), r.right, r.top); });
  node.addEventListener("blur", () => Tip.hide());
}

/* ------------------------------------------------------------ small helpers */
function copyButton(btn, getText) {
  btn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(getText()); btn.textContent = "Copied"; }
    catch { btn.textContent = "Select and copy manually"; }
    setTimeout(() => (btn.textContent = btn.dataset.label || "Copy"), 1800);
  });
}

function legendHTML(keys = DIM_KEYS, kind = "line") {
  return `<ul class="legend">${keys.map((k) => `<li><i class="${kind === "sq" ? "sq" : ""}" style="background:var(${DIMS[k].v})"></i>${DIMS[k].label}</li>`).join("")}</ul>`;
}

document.addEventListener("DOMContentLoaded", renderChrome);
