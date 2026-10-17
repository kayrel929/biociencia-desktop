/* BioCiencia — app.js (estilo EndNote) */
"use strict";
const api = window.citewell;
const $ = id => document.getElementById(id);

const TIPOS = ["artículo", "libro", "capítulo", "conferencia", "tesis", "informe", "página web", "prensa", "datos", "software", "otro"];
const ESTILOS = ["APA", "MLA", "Chicago", "Chicago (Autor-Fecha)", "IEEE", "Elsevier", "Vancouver", "AMA", "CSE", "ISO 690", "Harvard", "ABNT NBR 6023", "ACS", "Nature"];

/* ============================ estado ============================ */
let state = { version: 1, grupos: [], gruposInteligentes: [], refs: [] };
let scope = "todas";                 // id de pestaña activa
let openTabs = [{ scope: "todas" }]; // pestañas abiertas
let selectedId = null, detailTab = "resumen";
const multiSel = new Set();          // selección múltiple (Ctrl+/Shift+clic)
let multiSelAncla = null;
let sortKey = "fecha", sortDir = -1;
let estilo = localStorage.getItem("bio-estilo") || "APA";
const ADV = {};
let ONLINE = { fuente: null, q: "", resultados: [], error: null, cargando: false };

/* ============================ utilidades ============================ */
const uid = () => Math.random().toString(36).slice(2, 10);
const ahora = () => { const d = new Date(), p = n => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const parseAutores = s => String(s || "").split(";").map(a => a.trim()).filter(Boolean);
const normT = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
let toastT;
function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }

function pedirTexto(titulo, valor) {
  return new Promise(res => {
    $("prompt-title").textContent = titulo;
    const inp = $("prompt-input"); inp.value = valor ?? "";
    $("prompt-backdrop").classList.add("open"); inp.focus(); inp.select();
    const fin = v => { $("prompt-backdrop").classList.remove("open"); res(v); };
    $("prompt-ok").onclick = () => fin(inp.value.trim());
    $("prompt-cancel").onclick = () => fin(null);
    inp.onkeydown = e => { if (e.key === "Enter") fin(inp.value.trim()); if (e.key === "Escape") fin(null); };
  });
}
async function save() { const ok = await api.saveLibrary(state); if (!ok) toast("⚠️ No se pudo guardar la biblioteca"); }
function refNueva(extra) {
  return Object.assign({
    id: uid(), tipo: "artículo", titulo: "", autores: "", ano: "", revista: "", volumen: "", numero: "",
    paginas: "", doi: "", url: "", editorial: "", direccion: "", resumen: "", palabras_clave: "",
    notas: "", fecha: ahora(), grupos: [], papelera: false, pdf: false
  }, extra || {});
}
const refById = id => state.refs.find(r => r.id === id);
function limpio(r) { return r && !r.papelera; }

/* ============================ citación ============================ */
function autApa(str) {
  const lista = parseAutores(str).map(a => {
    const p = a.split(",").map(x => x.trim());
    if (p.length >= 2 && p[1]) {
      const ini = p.slice(1).join(" ").split(/\s+/).filter(Boolean).map(n => n[0].toUpperCase() + ".").join(" ");
      return `${p[0]}, ${ini}`;
    }
    return a;
  });
  if (lista.length <= 1) return lista[0] || "";
  if (lista.length === 2) return lista.join(" & ");
  return lista.slice(0, -1).join(", ") + ", & " + lista[lista.length - 1];
}
function citar(r, e) {
  const t = r.tipo || "artículo", titulo = r.titulo || "", a = r.autores || "", y = r.ano || "",
    rev = r.revista || "", v = r.volumen || "", n = r.numero || "", p = r.paginas || "",
    ed = r.editorial || "", doi = r.doi ? `https://doi.org/${r.doi}` : "", lnk = doi || r.url || "";
  const plano = s => s.replace(/,\s*,/g, ",").replace(/\.\s*\./g, ".").replace(/\s+/g, " ").trim();
  if (e === "APA") {
    const au = autApa(a);
    if (t === "página web" || t === "datos" || t === "software")
      return plano(`${au} (${y || "s. f."}). ${titulo}${t === "página web" ? " [Sitio web]" : t === "datos" ? " [Base de datos]" : " [Software]"}.${r.url ? " Disponible en: " + r.url : ""}`);
    if (t === "informe")
      return plano(`${au} (${y}). ${titulo} (Informe).${ed ? " " + ed + "." : ""}${r.url ? " " + r.url : ""}`);
    return plano(t === "libro" || t === "tesis"
      ? `${au} (${y}). ${titulo}. ${ed}.${lnk ? " " + lnk : ""}`
      : `${au} (${y}). ${titulo}. ${rev}${v ? ", " + v : ""}${n ? "(" + n + ")" : ""}${p ? ", " + p : ""}${lnk ? ". " + lnk : ""}.`);
  }
  if (e === "MLA") return plano(`${a.replace(/;\s*/g, ", ")} "${titulo}." ${rev}${v ? ", vol. " + v : ""}${n ? ", no. " + n : ""}, ${y}${p ? ", pp. " + p : ""}${lnk ? ". " + lnk : ""}.`);
  if (e === "Chicago") return plano(`${a.replace(/;\s*/g, ", ")} "${titulo}." ${rev} (${y})${lnk ? ". " + lnk : ""}.`);
  if (e === "IEEE") return plano(`${a.replace(/;\s*/g, ", ")}, "${titulo}," ${rev}, vol. ${v}, no. ${n}, pp. ${p}, ${y}.${r.doi ? " doi: " + r.doi + "." : ""}`);
  if (e === "Vancouver") return plano(`${a.replace(/;\s*/g, ", ")}. ${titulo}. ${rev}. ${y};${v}(${n}):${p}.${r.doi ? " doi:" + r.doi : ""}`);
  if (e === "Harvard") return plano(`${a.replace(/;\s*/g, ", ")} (${y}) '${titulo}', ${rev}${v ? ", " + v : ""}${n ? "(" + n + ")" : ""}${p ? ", pp. " + p : ""}${lnk ? ". " + lnk : ""}.`);
  // === estilos de salida ampliados (como EndNote) ===
  const Y = y || "s. f.";
  const esLibro = t === "libro" || t === "tesis";
  const auNombre = () => parseAutores(a).map(x => {
    const p = x.split(",").map(q => q.trim());
    const ini = (p.slice(1).join(" ") || "").replace(/\./g, "").split(/\s+/).filter(Boolean).map(m => m[0].toUpperCase()).join(" ");
    return ini ? `${p[0]} ${ini}` : p[0] || "";
  }).filter(Boolean);
  const auMayus = () => parseAutores(a).map(x => {
    const p = x.split(",").map(q => q.trim());
    const ini = (p.slice(1).join(" ") || "").replace(/\.\s*/g, "").split(/\s+/).filter(Boolean).map(m => m[0].toUpperCase() + ".").join(" ");
    return `${(p[0] || "").toUpperCase()}, ${ini}`.trim();
  }).filter(Boolean);
  const auIni = () => parseAutores(a).map(x => {
    const p = x.split(",").map(q => q.trim());
    const ini = (p.slice(1).join(" ") || "").replace(/\./g, "").split(/\s+/).filter(Boolean).map(m => m[0].toUpperCase() + ".").join(" ");
    return ini ? `${ini} ${p[0]}` : p[0] || "";
  }).filter(Boolean);
  if (e === "Chicago (Autor-Fecha)") {
    return esLibro
      ? plano(`${a.replace(/;\s*/g, ", ")}. ${titulo}. ${direccion ? direccion + ": " : ""}${ed}, ${Y}.${lnk ? " " + lnk : ""}`)
      : plano(`${a.replace(/;\s*/g, ", ")}. ${Y}. "${titulo}". ${rev} ${v}(${n}), ${p}.${r.doi ? " https://doi.org/" + r.doi + "." : ""}`);
  }
  if (e === "Elsevier") {
    const num = state.refs.findIndex(x => x.id === r.id) + 1;
    return esLibro
      ? plano(`[${num}] ${auIni().join(", ")}, ${titulo}, ${direccion ? direccion + ": " : ""}${ed}, ${Y}.`)
      : plano(`[${num}] ${auIni().join(", ")}, "${titulo}", ${rev}, vol. ${v}, no. ${n}, pp. ${p}, ${Y}, doi: ${r.doi || "sin DOI"}.`);
  }
  if (e === "AMA") {
    return esLibro
      ? plano(`${auNombre().join(", ")}. ${titulo}. ${ed}. ${Y}.`)
      : plano(`${auNombre().join(", ")}. ${titulo}. ${rev}. ${Y};${v}(${n}):${p}.${r.doi ? " doi: " + r.doi : ""}`);
  }
  if (e === "CSE") {
    return esLibro
      ? plano(`${auNombre().join(", ")}. ${Y}. ${titulo}. ${ed}.`)
      : plano(`${auNombre().join(", ")}. ${Y}. ${titulo}. ${rev} ${v}(${n}): ${p}.`);
  }
  if (e === "ISO 690") {
    return esLibro
      ? plano(`${auMayus().join(", ")}. ${titulo}. ${direccion ? direccion + ": " : ""}${ed}, ${Y}.`)
      : plano(`${auMayus().join(", ")}. ${titulo}. ${rev}, ${Y}, vol. ${v}, n.º ${n}, ${p}.${r.doi ? " DOI: " + r.doi + "." : ""}`);
  }
  if (e === "ABNT NBR 6023") {
    return esLibro
      ? plano(`${auMayus().join("; ")}. ${titulo}. ${direccion ? direccion + ": " : ""}${ed}, ${Y}.`)
      : plano(`${auMayus().join("; ")}. ${titulo}. ${rev}, v. ${v}, n. ${n}, p. ${p}, ${Y}.${r.doi ? " Disponível em: https://doi.org/" + r.doi : ""}`);
  }
  if (e === "ACS") {
    return esLibro
      ? plano(`${auIni().join("; ")}. ${titulo}. ${ed}, ${Y}.`)
      : plano(`${auIni().join("; ")}. ${titulo}. ${rev} ${Y}, ${v}, ${p}.${r.doi ? " DOI: " + r.doi : ""}`);
  }
  if (e === "Nature") {
    const nat = parseAutores(a);
    const auN = nat.length <= 1 ? nat[0] || "" : nat.slice(0, -1).join(", ") + " & " + nat[nat.length - 1];
    return esLibro
      ? plano(`${auN}. ${titulo}. ${ed}, ${Y}.`)
      : plano(`${auN}. ${titulo}. ${rev} ${v}, ${p}, (${Y}).${r.doi ? " doi: " + r.doi : ""}`);
  }
  return plano(`${a}. (${y}). ${titulo}. ${rev}.`);
}

/* ============================ exportar ============================ */
function aRIS(refs) {
  const T = { "artículo": "JOUR", "libro": "BOOK", "capítulo": "CHAP", "conferencia": "CONF", "tesis": "THES", "informe": "RPRT", "página web": "ELEC", "prensa": "NEWS", "datos": "DATA", "software": "COMP", "otro": "GEN" };
  return refs.map(r => {
    const L = [`TY  - ${T[r.tipo] || "GEN"}`];
    if (r.titulo) L.push(`TI  - ${r.titulo}`);
    parseAutores(r.autores).forEach(a => L.push(`AU  - ${a}`));
    if (r.ano) L.push(`PY  - ${r.ano}`);
    if (r.revista) L.push(`JO  - ${r.revista}`);
    if (r.volumen) L.push(`VL  - ${r.volumen}`);
    if (r.numero) L.push(`IS  - ${r.numero}`);
    if (r.paginas) { const pp = String(r.paginas).split("-"); L.push(`SP  - ${pp[0]}`); if (pp[1]) L.push(`EP  - ${pp[1]}`); }
    if (r.doi) L.push(`DO  - ${r.doi}`);
    if (r.url) L.push(`UR  - ${r.url}`);
    if (r.editorial) L.push(`PB  - ${r.editorial}`);
    if (r.resumen) L.push(`AB  - ${r.resumen}`);
    if (r.notas) L.push(`N1  - ${r.notas}`);
    parseAutores(r.palabras_clave).forEach(k => L.push(`KW  - ${k}`));
    L.push("ER  - ");
    return L.join("\n");
  }).join("\n\n") + "\n\n";
}
function aBibTeX(refs) {
  const T = { "artículo": "article", "libro": "book", "capítulo": "incollection", "conferencia": "inproceedings", "tesis": "phdthesis", "informe": "techreport", "página web": "misc", "prensa": "article", "datos": "misc", "software": "misc", "otro": "misc" };
  return refs.map(r => {
    const base = (parseAutores(r.autores)[0] || "sinautor").split(",")[0].replace(/\s+/g, "");
    const clave = `${base || "sinautor"}${r.ano || "0000"}`;
    const F = [];
    if (r.titulo) F.push(`  title = {${r.titulo}}`);
    if (r.autores) F.push(`  author = {${parseAutores(r.autores).join(" and ")}}`);
    if (r.ano) F.push(`  year = {${r.ano}}`);
    if (r.revista) F.push(`  journal = {${r.revista}}`);
    if (r.volumen) F.push(`  volume = {${r.volumen}}`);
    if (r.numero) F.push(`  number = {${r.numero}}`);
    if (r.paginas) F.push(`  pages = {${r.paginas}}`);
    if (r.doi) F.push(`  doi = {${r.doi}}`);
    if (r.url) F.push(`  url = {${r.url}}`);
    if (r.editorial) F.push(`  publisher = {${r.editorial}}`);
    if (r.resumen) F.push(`  abstract = {${r.resumen}}`);
    if (r.palabras_clave) F.push(`  keywords = {${r.palabras_clave}}`);
    if (r.notas) F.push(`  note = {${r.notas}}`);
    return `@${T[r.tipo] || "misc"}{${clave},\n${F.join(",\n")}\n}`;
  }).join("\n\n") + "\n";
}
async function exportar(fmt, refsOpc) {
  const refs = refsOpc || (scope.startsWith("online") ? state.refs.filter(limpio) : visibles().filter(limpio));
  if (!refs.length) { toast("No hay referencias para exportar"); return; }
  let contenido, nombre, filtros;
  const hoy = new Date().toISOString().slice(0, 10);
  if (fmt === "ris")   { contenido = aRIS(refs);    nombre = `bibliografia-${hoy}.ris`;  filtros = [{ name: "RIS",    extensions: ["ris"] }]; }
  if (fmt === "bib")   { contenido = aBibTeX(refs); nombre = `bibliografia-${hoy}.bib`; filtros = [{ name: "BibTeX", extensions: ["bib"] }]; }
  if (fmt === "json")  { contenido = JSON.stringify(state, null, 2); nombre = `copia-biociencia-${hoy}.json`; filtros = [{ name: "JSON", extensions: ["json"] }]; }
  const ruta = await api.saveFileAs({ defaultName: nombre, filters: filtros });
  if (!ruta) return;
  const ok = await api.writeFile(ruta, contenido);
  toast(ok ? `✅ Exportado: ${ruta.split(/[\\/]/).pop()}` : "Error al guardar");
}

/* ============================ importar ============================ */
function deRIS(txt) {
  const mapa = { TI: "titulo", T1: "titulo", AU: "autores", A1: "autores", PY: "ano", Y1: "ano", JO: "revista", JF: "revista", T2: "revista", VL: "volumen", IS: "numero", DO: "doi", UR: "url", PB: "editorial", AB: "resumen", N2: "resumen", N1: "notas", CY: "direccion" };
  const TYT = { RPRT: "informe", ELEC: "página web", WEB: "página web", NEWS: "prensa", DATA: "datos", COMP: "software" };
  const refs = []; let c = null;
  for (const lin of String(txt).split(/\r?\n/)) {
    const m = lin.match(/^\s*([A-Z0-9]{2})\s+-\s*(.*)$/i);
    if (!m) continue;
    const tag = m[1].toUpperCase(), val = (m[2] || "").trim();
    if (tag === "TY") c = { tipo: TYT[val.toUpperCase()] || "artículo" };
    else if (tag === "ER") { if (c) refs.push(c), c = null; }
    else if (c && tag === "KW") c.palabras_clave = c.palabras_clave ? c.palabras_clave + "; " + val : val;
    else if (c && tag === "SP") c._sp = val;
    else if (c && tag === "EP") c._ep = val;
    else if (c && mapa[tag]) {
      const f = mapa[tag];
      if (f === "autores") c.autores = c.autores ? c.autores + "; " + val : val;
      else c[f] = val;
    }
  }
  return refs;
}
function deBibTeX(txt) {
  const TYB = { article: "artículo", book: "libro", incollection: "capítulo", inbook: "capítulo", inproceedings: "conferencia", conference: "conferencia", phdthesis: "tesis", mastersthesis: "tesis", techreport: "informe", online: "página web", electronic: "página web", dataset: "datos", software: "software", newarticle: "prensa" };
  const CP = { title: "titulo", author: "autores", year: "ano", journal: "revista", booktitle: "revista", volume: "volumen", number: "numero", pages: "paginas", doi: "doi", url: "url", publisher: "editorial", address: "direccion", abstract: "resumen", keywords: "palabras_clave", note: "notas" };
  const refs = []; const re = /@(\w+)\s*\{\s*([^,\s]+)\s*,([\s\S]*?)\n\s*\}/g; let m;
  while ((m = re.exec(txt)) !== null) {
    const r = refNueva({ tipo: TYB[m[1].toLowerCase()] || "artículo" });
    const fr = /(\w+)\s*=\s*(?:\{([\s\S]*?)\}|"([^"]*)")/g; let f;
    while ((f = fr.exec(m[3])) !== null) {
      const k = f[1].toLowerCase(), v = (f[2] ?? f[3] ?? "").replace(/\\[{}]/g, "").trim();
      const campo = CP[k]; if (!campo) continue;
      if (campo === "autores") r.autores = v.replace(/\s+and\s+/gi, "; ");
      else if (campo === "paginas") r.paginas = v.replace(/--/g, "-");
      else r[campo] = v;
    }
    if (r.titulo) refs.push(r);
  }
  return refs;
}
function integrarCrudos(crudos) {
  let add = 0;
  for (const c of crudos) {
    const r = refNueva({});
    Object.assign(r, c); r.id = uid(); r.fecha = ahora(); r.grupos = []; r.papelera = false;
    if (r._sp) { r.paginas = r._ep ? `${r._sp}-${r._ep}` : r._sp; }
    delete r._sp; delete r._ep;
    if (!r.titulo) continue;
    const dup = state.refs.some(x =>
      (r.doi && x.doi && x.doi.toLowerCase() === r.doi.toLowerCase()) ||
      (r.titulo && normT(x.titulo) && normT(x.titulo) === normT(r.titulo)));
    if (dup) continue;
    state.refs.unshift(r); add++;
  }
  return add;
}
async function importar(fmt) {
  const res = await api.openFile({ filters: fmt === "ris" ? [{ name: "RIS", extensions: ["ris", "txt"] }] : [{ name: "BibTeX", extensions: ["bib"] }] });
  if (!res) return;
  const crudos = fmt === "ris" ? deRIS(res.content) : deBibTeX(res.content);
  if (!crudos.length) { toast("⚠️ No se reconocieron referencias en el archivo"); return; }
  const add = integrarCrudos(crudos);
  await save(); renderAll();
  toast(`Importadas ${add} de ${crudos.length} referencias`);
}
// Apertura por doble clic en un archivo .ris / .bib / .enw descargado
async function importarArchivoSuelto(datos) {
  const fmt = (/\.(bib)$/i.test(datos.ruta) || /^\s*@/.test(datos.contenido || "")) ? "bib" : "ris";
  const crudos = fmt === "ris" ? deRIS(datos.contenido) : deBibTeX(datos.contenido);
  if (!crudos.length) { toast("⚠️ El archivo no contiene referencias reconocibles"); return; }
  const add = integrarCrudos(crudos);
  await save();
  await save();
  renderAll();
  if (add > 0) {
    abreTab("todas");
    toast(`📥 ${add} de ${crudos.length} referencias importadas desde «${datos.ruta.split(/[\\/]/).pop()}»`);
  } else {
    abreTab("todas");
    toast("ⓘ Todas las referencias del archivo ya estaban en la biblioteca");
  }
}
function esDuplicado(r, excluyeId) {
  return state.refs.some(x => x.id !== excluyeId &&
    ((r.doi && x.doi && x.doi.toLowerCase() === r.doi.toLowerCase()) ||
     (r.titulo && normT(x.titulo) && normT(x.titulo) === normT(r.titulo))));
}

/* ============================ búsqueda en línea ============================ */
const FUENTES = { openalex: "OpenAlex", crossref: "Crossref", pubmed: "PubMed (NLM)" };
function abstractOpenAlex(inv) {
  if (!inv) return "";
  const p = [];
  for (const [w, pos] of Object.entries(inv)) for (const i of pos) p[i] = w;
  return p.filter(Boolean).join(" ");
}
function deOpenAlex(w) {
  const b = w.biblio || {};
  let doi = (w.doi || "").replace(/^https?:\/\/doi\.org\//, "");
  const autorías = (w.authorships || []).map(a => {
    const au = a.author || {};
    return [au.last_name, au.display_name && !au.last_name ? au.display_name.replace(/^\S+,\s*/, "") : au.first_name]
      .filter(Boolean);
  }).map(([ln, fn]) => fn ? `${ln}, ${fn}` : ln || "").filter(Boolean).join("; ");
  return { titulo: w.title || "", autores: autorías, ano: String(w.publication_year || ""),
    revista: (w.primary_location?.source?.display_name) || "", volumen: b.volume || "",
    numero: b.issue || "", paginas: b.first_page && b.last_page ? `${b.first_page}-${b.last_page}` : "",
    doi, url: doi ? `https://doi.org/${doi}` : (w.primary_location?.landing_page_url || ""),
    resumen: abstractOpenAlex(w.abstract_inverted_index), editorial: "" };
}
function deCrossref(it) {
  const y = it.issued?.["date-parts"]?.[0]?.[0] ?? "";
  const autores = (it.author || []).map(a => `${a.family || a.name || ""}, ${a.given || ""}`.replace(/, $|^,/, "").trim()).filter(Boolean).join("; ");
  return { titulo: it.title?.[0] || "", autores, ano: String(y), revista: it["container-title"]?.[0] || "",
    volumen: it.volume || "", numero: it.issue || "", paginas: it.page || "",
    doi: it.DOI || "", url: it.URL || "", resumen: (it.abstract || "").replace(/<[^>]+>/g, "").trim(), editorial: it.publisher || "" };
}
function dePubMed(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const refs = [];
  doc.querySelectorAll("PubmedArticle").forEach(art => {
    const tit = art.querySelector("ArticleTitle")?.textContent || "";
    const autores = [...art.querySelectorAll("Author")].map(a => {
      const fam = a.querySelector("LastName")?.textContent || "";
      const ini = a.querySelector("Initials")?.textContent || "";
      const col = a.querySelector("CollectiveName")?.textContent || "";
      return fam || ini ? `${fam}, ${ini}` : col;
    }).filter(Boolean).join("; ");
    const j = art.querySelector("Journal");
    const y = j?.querySelector("PubDate Year")?.textContent || "";
    const vol = j?.querySelector("JournalIssue Volume")?.textContent || "";
    const num = j?.querySelector("JournalIssue Issue")?.textContent || "";
    const pagin = art.querySelector("Pagination MedlinePgn")?.textContent || "";
    const rev = j?.querySelector("Title")?.textContent || "";
    let doi = "";
    [...art.querySelectorAll("ArticleId")].forEach(x => { if (x.getAttribute("IdType") === "doi") doi = x.textContent || ""; });
    const abs = [...art.querySelectorAll("AbstractText")].map(x => x.textContent).join(" ");
    refs.push({ titulo: tit, autores, ano: String(y), revista: rev, volumen: vol, numero: num, paginas: pagin, doi, url: doi ? `https://doi.org/${doi}` : "", resumen: abs, editorial: "" });
  });
  return refs;
}
async function buscarOnline(fuente, q) {
  ONLINE = { fuente, q, resultados: [], error: null, cargando: true };
  renderStage();
  try {
    let res = [];
    if (fuente === "openalex") {
      const r = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=15`);
      if (!r.ok) throw new Error("HTTP " + r.status);
      res = (await r.json()).results.map(deOpenAlex);
    } else if (fuente === "crossref") {
      const r = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=15`);
      if (!r.ok) throw new Error("HTTP " + r.status);
      res = (await r.json()).message.items.map(deCrossref);
    } else {
      const es = await (await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=15&term=${encodeURIComponent(q)}`)).json();
      const ids = es?.esearchresult?.idlist || [];
      if (ids.length) {
        const xf = await (await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=${ids.join(",")}`)).text();
        res = dePubMed(xf);
      }
    }
    ONLINE.resultados = res.filter(r => r.titulo);
    ONLINE.cargando = false;
  } catch (e) {
    ONLINE.cargando = false;
    ONLINE.error = "Sin conexión o error de red (" + (e.message || e) + ")";
  }
  renderStage();
}
async function fetchDOI(doi) {
  const limpio = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
  try {
    const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(limpio)}`);
    if (r.ok) return deCrossref((await r.json()).message);
  } catch (e) {}
  try {
    const r = await fetch(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(limpio)}`);
    if (r.ok) { const d = deOpenAlex(await r.json()); if (d.titulo) return d; }
  } catch (e) {}
  return null;
}

/* ============================ filtrado ============================ */
function refsDeScope(sc) {
  sc = sc || scope;
  const hoy = new Date().toISOString().slice(0, 10);
  const hace30 = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  if (sc === "todas") return state.refs.filter(limpio);
  if (sc === "recientes") return state.refs.filter(r => limpio(r) && r.fecha && r.fecha.slice(0, 10) >= hace30);
  if (sc === "sinarchivar") return state.refs.filter(r => limpio(r) && !(r.grupos || []).length);
  if (sc === "papelera") return state.refs.filter(r => r.papelera);
  if (sc.startsWith("col:")) { const gid = sc.slice(4); return state.refs.filter(r => limpio(r) && (r.grupos || []).includes(gid)); }
  if (sc.startsWith("smart:")) {
    const s = state.gruposInteligentes.find(x => x.id === sc.slice(6));
    const q = normT(s?.consulta || "");
    return state.refs.filter(r => limpio(r) && (!q || [r.titulo, r.autores, r.revista, r.palabras_clave, r.resumen].some(f => normT(f).includes(q))));
  }
  if (sc.startsWith("tag:")) { const tg = sc.slice(4).toLowerCase(); return state.refs.filter(r => limpio(r) && parseAutores(r.palabras_clave).some(t => normT(t) === normT(tg))); }
  return [];
}
function aplicarQ(lista) {
  const q = normT($("search").value);
  if (!q || scope.startsWith("online")) return lista;
  const k = ($("q-campo") || {}).value || "";
  const campos = k === "titulo" ? [r => r.titulo] : k === "autores" ? [r => r.autores] : k === "revista" ? [r => r.revista] : k === "etiquetas" ? [r => r.palabras_clave] : null;
  if (campos) return lista.filter(r => campos.some(f => normT(f(r)).includes(q)));
  return lista.filter(r => [r.titulo, r.autores, r.revista, r.doi, r.ano, r.resumen].some(f => normT(f).includes(q)));
}
function aplicaFiltros(lista) {
  lista = aplicarQ(lista);
  const av = [];
  if (ADV.titulo) av.push(r => normT(r.titulo).includes(normT(ADV.titulo)));
  if (ADV.autor) av.push(r => normT(r.autores).includes(normT(ADV.autor)));
  if (ADV.revista) av.push(r => normT(r.revista).includes(normT(ADV.revista)));
  if (ADV.doi) av.push(r => normT(r.doi).includes(normT(ADV.doi)));
  if (ADV.tag) av.push(r => normT(r.palabras_clave).includes(normT(ADV.tag)));
  if (ADV.de) av.push(r => +r.ano >= +ADV.de);
  if (ADV.hasta) av.push(r => +r.ano <= +ADV.hasta);
  if (ADV.tipo) av.push(r => r.tipo === ADV.tipo);
  return lista.filter(r => av.every(f => f(r)));
}
function visibles() {
  if (scope.startsWith("online")) return ONLINE.resultados;
  let lista = refsDeScope();
  lista = aplicaFiltros(lista);
  const K = sortKey, D = sortDir;
  const cmp = {
    autor: (a, b) => normT(a.autores).localeCompare(normT(b.autores), "es"),
    ano: (a, b) => (+a.ano || 0) - (+b.ano || 0),
    titulo: (a, b) => normT(a.titulo).localeCompare(normT(b.titulo), "es"),
    fecha: (a, b) => normT(a.fecha).localeCompare(normT(b.fecha))
  }[K] || ((a, b) => normT(a[K] || "").localeCompare(normT(b[K] || ""), "es"));
  if (cmp) lista = lista.slice().sort((a, b) => cmp(a, b) * D);
  return lista;
}

/* ============================ pestañas ============================ */
function abreTab(sc) {
  const labels = { todas: "Todas las referencias", recientes: "Añadidas recientemente", sinarchivar: "Sin archivar", papelera: "Papelera", dupes: "Duplicados" };
  let label = labels[sc] || (sc.startsWith("col:") ? (state.grupos.find(g => g.id === sc.slice(4))?.nombre || "Colección")
    : sc.startsWith("smart:") ? (state.gruposInteligentes.find(s => s.id === sc.slice(6))?.nombre || "Grupo inteligente")
    : sc.startsWith("tag:") ? ("#" + sc.slice(4))
    : sc.startsWith("online:") ? ("En línea — " + FUENTES[sc.slice(7)]) : sc);
  let t = openTabs.find(x => x.scope === sc);
  if (!t) { t = { scope: sc, label }; openTabs.push(t); }
  t.label = label;
  scope = sc;
  if (!scope.startsWith("online") || ONLINE.fuente !== scope.slice(7)) {
    if (scope.startsWith("online")) ONLINE = { fuente: scope.slice(7), q: "", resultados: [], error: null, cargando: false };
  }
  selectedId = null; detailTab = "resumen";
  multiSel.clear(); multiSelAncla = null;
  renderTabs(); renderAll();
}
function cierraTab(sc) {
  openTabs = openTabs.filter(t => t.scope !== sc);
  if (scope === sc) {
    const alt = openTabs[openTabs.length - 1];
    abreTab(alt ? alt.scope : "todas");
    if (!openTabs.length) openTabs = [{ scope: "todas", label: "Todas las referencias" }];
    return;
  }
  renderTabs();
}

/* ============================ SIDEBAR ============================ */
// Listas de términos (autocompletado estilo EndNote)
function listasTerminos() {
  state.listasTerminos = state.listasTerminos || { autores: [], revistas: [], etiquetas: [] };
  return state.listasTerminos;
}
function updateTermLists() {
  const da = $("dl-autores"), dr = $("dl-revistas"), de = $("dl-etiquetas");
  if (!da) return;
  const lt = listasTerminos();
  const uniq = arr => [...new Set(arr.filter(Boolean).map(s => String(s).trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es")).slice(0, 400);
  da.innerHTML = uniq(state.refs.flatMap(r => parseAutores(r.autores)).concat(lt.autores)).map(v => `<option value="${esc(v)}">`).join("");
  dr.innerHTML = uniq(state.refs.map(r => r.revista).concat(lt.revistas)).map(v => `<option value="${esc(v)}">`).join("");
  de.innerHTML = uniq(state.refs.flatMap(r => parseAutores(r.palabras_clave)).concat(lt.etiquetas)).map(v => `<option value="${esc(v)}">`).join("");
}
// ====== EndNote 25: gestor de listas de términos ======
function gestionarTerminos() {
  const m = $("modal-terms");
  m.classList.add("open");
  pintarTérminos();
}
function pintarTérminos() {
  const lt = listasTerminos();
  const secciones = [
    { k: "autores", titulo: "Nombres de autor", derivados: [...new Set(state.refs.flatMap(r => parseAutores(r.autores)))] },
    { k: "revistas", titulo: "Revistas", derivados: [...new Set(state.refs.map(r => r.revista).filter(Boolean))] },
    { k: "etiquetas", titulo: "Etiquetas", derivados: [...new Set(state.refs.flatMap(r => parseAutores(r.palabras_clave)))] }
  ];
  $("terms-body").innerHTML = secciones.map(s => {
    const total = [...new Set(s.derivados.concat(lt[s.k]))].sort((a, b) => a.localeCompare(b, "es"));
    return `<div class="terms-sec"><b>${s.titulo}</b> <span style="color:var(--muted)">(${total.length})</span>
      <button class="btn sm" data-add="${s.k}" style="float:right">＋ Añadir</button>
      <div class="tagchips">${total.map(t => `<span class="chip">${esc(t)}<button class="chip-x" title="Quitar de la lista" data-tip="${s.k}" data-ter="${esc(t)}">✕</button></span>`).join("") || "<span style='color:var(--muted);font-size:12px'>— vacío —</span>"}</div></div>`;
  }).join("") + `<div class="d-hint">Los términos sugieren autocompletado al escribir. Quitar un término que ya está en uso en las referencias lo elimina de todas ellas.</div>`;
  $("terms-body").querySelectorAll("[data-add]").forEach(b => b.onclick = async () => {
    const v = await pedirTexto("Nuevo término para la lista:", "");
    if (!v) return;
    lt[b.dataset.add].push(v);
    await save(); updateTermLists(); pintarTérminos();
  });
  $("terms-body").querySelectorAll(".chip-x").forEach(b => b.onclick = async () => {
    const tipk = b.dataset.tip, ter = b.dataset.ter;
    const enRefs = tipk === "revistas" ? state.refs.some(r => r.revista === ter)
      : state.refs.some(r => parseAutores(tipk === "etiquetas" ? r.palabras_clave : tipk === "autores" ? r.autores : "").includes(ter));
    if (enRefs && !confirm(`El término «${ter}» está en uso en las referencias.\n¿Eliminarlo de todas ellas también?`)) return;
    lt[tipk] = lt[tipk].filter(x => normT(x) !== normT(ter));
    state.refs.forEach(r => {
      if (tipk === "revistas" && r.revista === ter) r.revista = "";
      if (tipk === "autores") r.autores = parseAutores(r.autores).filter(a => normT(a) !== normT(ter)).join("; ");
      if (tipk === "etiquetas") r.palabras_clave = parseAutores(r.palabras_clave).filter(a => normT(a) !== normT(ter)).join("; ");
    });
    await save(); updateTermLists(); pintarTérminos(); abrirRefresco();
    toast(`Término «${ter}» eliminado de la lista`);
  });
}
// Sets de colecciones (Group Sets) — organización anidada de la sidebar
async function crearSetColecciones() {
  const nn = await pedirTexto("Nombre del set de colecciones:", "");
  if (!nn) return;
  state.sets = state.sets || [];
  if (state.sets.some(s => normT(s.nombre) === normT(nn))) { toast("Ya existe ese set"); return; }
  state.sets.push({ id: uid(), nombre: nn });
  await save(); renderSidebar();
  toast(`Set «${nn}» creado — abre una colección y usa Grupos → Mover… para agruparla`);
}
async function moverColASet() {
  if (!scope.startsWith("col:")) { toast("Abre primero la colección que quieres mover"); return; }
  const g = state.grupos.find(x => x.id === scope.slice(4));
  if (!g) return;
  const nn = await pedirTexto(`Set destino para «${g.nombre}» (existente o nuevo):`, "");
  if (!nn) return;
  state.sets = state.sets || [];
  let s = state.sets.find(x => normT(x.nombre) === normT(nn));
  if (!s) { s = { id: uid(), nombre: nn }; state.sets.push(s); }
  g.set = s.id;
  await save(); renderSidebar();
  toast(`«${g.nombre}» movida al set «${nn}»`);
}
async function quitarColDeSet() {
  if (!scope.startsWith("col:")) { toast("Abre primero la colección"); return; }
  const g = state.grupos.find(x => x.id === scope.slice(4));
  if (!g) return;
  delete g.set;
  await save(); renderSidebar();
  toast("Colección movida al nivel superior");
}
function renderSidebar() {
  const vivas = state.refs.filter(limpio);
  $("cnt-todas").textContent = vivas.length || "";
  $("cnt-rec").textContent = refsDeScope("recientes").length || "";
  $("cnt-sin").textContent = refsDeScope("sinarchivar").length || "";
  $("cnt-pap").textContent = state.refs.filter(r => r.papelera).length || "";
  updateTermLists();

  document.querySelectorAll("#sb-nav .sb-i").forEach(b => b.classList.toggle("active", b.dataset.scope === scope));
  const activo = sc => document.querySelectorAll(`[data-scope="${sc}"]`).forEach(b => b.classList?.toggle("active", true));

  const gfilter = normT($("sb-group-filter").value);
  const cl = $("col-list"); cl.innerHTML = "";
  const btnColeccion = (g, indent) => {
    const n = state.refs.filter(r => limpio(r) && (r.grupos || []).includes(g.id)).length;
    const b = document.createElement("button");
    b.className = "sb-i"; b.title = g.nombre;
    b.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg> <span class="lbl" style="padding-left:${indent ? 24 : 12}px">${esc(g.nombre)}</span><span class="cnt">${n}</span><span class="row-act"><button title="Renombrar">✎</button><button title="Eliminar">✕</button></span>`;
    b.classList.toggle("active", scope === "col:" + g.id);
    b.addEventListener("click", e => {
      const btn = e.target.closest("button");
      if (btn && btn.parentElement.classList.contains("row-act")) return;
      abreTab("col:" + g.id);
    });
    b.querySelector(".row-act").addEventListener("click", async e => {
      e.stopPropagation();
      if (e.target.title === "Renombrar") {
        const nn = await pedirTexto("Renombrar colección:", g.nombre);
        if (nn) { g.nombre = nn; await save(); abrirRefresco(); }
      } else if (e.target.title === "Eliminar" && confirm(`¿Eliminar la colección "${g.nombre}"?\nLas referencias NO se borran.`)) {
        state.grupos = state.grupos.filter(x => x.id !== g.id);
        state.refs.forEach(r => r.grupos = (r.grupos || []).filter(x => x !== g.id));
        if (scope === "col:" + g.id) abrirRefresco();
        await save(); abrirRefresco();
      }
    });
    cl.appendChild(b);
  };
  // sets de colecciones primero, después las colecciones sueltas
  state.sets = state.sets || [];
  state.sets.forEach(s => {
    const hijos = state.grupos.filter(g => g.set === s.id).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .filter(g => !gfilter || normT(g.nombre).includes(gfilter));
    if (gfilter && !normT(s.nombre).includes(gfilter) && !hijos.length) return;
    const h = document.createElement("button");
    h.className = "sb-i sb-set"; h.title = s.nombre;
    h.innerHTML = `<svg viewBox="0 0 24 24"><path d="M5 8a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M3 15V6a2 2 0 0 1 2-2h4l2 2"/></svg> <span class="lbl" style="font-weight:600">${esc(s.nombre)}</span><span class="row-act"><button title="Renombrar set">✎</button><button title="Eliminar set">✕</button></span>`;
    h.addEventListener("click", e => {
      const btn = e.target.closest("button");
      if (btn && btn.parentElement.classList.contains("row-act")) return;
    });
    h.querySelector(".row-act").addEventListener("click", async e => {
      e.stopPropagation();
      if (e.target.title === "Renombrar set") {
        const nn = await pedirTexto("Renombrar set:", s.nombre);
        if (nn) { s.nombre = nn; await save(); renderSidebar(); }
      } else if (e.target.title === "Eliminar set" && confirm(`¿Eliminar el set "${s.nombre}"?\nSus colecciones pasan al nivel superior.`)) {
        state.sets = state.sets.filter(x => x.id !== s.id);
        state.grupos.forEach(g => { if (g.set === s.id) delete g.set; });
        await save(); renderSidebar();
      }
    });
    cl.appendChild(h);
    hijos.forEach(g => btnColeccion(g, true));
  });
  state.grupos.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .filter(g => !g.set && (!gfilter || normT(g.nombre).includes(gfilter))).forEach(g => btnColeccion(g, false));

  const tl = $("tag-list"); tl.innerHTML = "";
  const token = {};
  vivas.forEach(r => parseAutores(r.palabras_clave).forEach(t => token[t] = (token[t] || 0) + 1));
  const tags = Object.entries(token).filter(([t]) => !gfilter || normT(t).includes(gfilter))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).slice(0, 12);
  tags.forEach(([t, n]) => {
    const b = document.createElement("button");
    b.className = "sb-i sb-tag"; b.title = `#${t}`;
    b.innerHTML = `<span class="lbl">◉ ${esc(t)}</span><span class="cnt">${n}</span>`;
    b.classList.toggle("on", scope === "tag:" + t);
    b.onclick = () => abreTab("tag:" + t);
    tl.appendChild(b);
  });
  if (!tags.length) tl.innerHTML = `<div style="padding:6px 14px;font-size:11.5px;color:#7f9db0">Sin etiquetas todavía</div>`;

  $("cnt-dup") ? null : null;
  const dupes = contarDuplicados();
  const bd = $("[data-sec=dup]") ? null : null;
  const btnDup = $("btn-dupes");
  if (btnDup) btnDup.querySelector(".cnt") && (btnDup.querySelector(".cnt").textContent = dupes || "");
}
function abrirRefresco() { renderSidebar(); renderTabs(); renderStage(); renderDetail(); }

/* ============================ DUPLICADOS ============================ */
function gruposDuplicados() {
  const map = new Map();
  state.refs.filter(limpio).forEach(r => {
    const k = r.doi ? "doi:" + normT(r.doi) : normT(r.titulo);
    if (!k || k === "doi:" || normT(r.titulo) === "") return;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  });
  return [...map.values()].filter(a => a.length > 1);
}
function contarDuplicados() { return gruposDuplicados().reduce((s, a) => s + a.length - 1, 0); }

/* ============================ STAGE ============================ */
// Barra de estado inferior (como la de EndNote)
function setStatus(txt) {
  const e = $("sb-left");
  if (e) e.textContent = txt;
  const est = $("sb-est");
  if (est) est.textContent = "Estilo de cita: " + estilo;
}
let panelDetalles = true;
function togglePanelDetalles() {
  panelDetalles = !panelDetalles;
  renderDetail();
  toast(panelDetalles ? "Panel de resumen visible" : "Panel de resumen oculto");
}
function togglePantallaCompleta() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}
const LOGO_MARCA = `<span class="logo-bc lg" style="width:58px;height:58px;font-size:24px;border-radius:12px">BC</span>`;
const ICONOS = {
  clip: '<svg viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M21.4 11.05l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.1a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>',
  cita: '<svg viewBox="0 0 24 24"><path d="M10 11H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v7c0 2.2-1.3 4-3.5 4.5"/><path d="M20 11h-4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v7c0 2.2-1.3 4-3.5 4.5"/></svg>',
  clipPlus: '<svg viewBox="0 0 24 24"><path d="M9 12h6M12 9v6"/><rect x="4" y="4" width="16" height="16" rx="2"/></svg>',
  userPlus: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21v-1a7 7 0 0 1 13-3.5"/><path d="M19 8v6M16 11h6"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/></svg>',
  docPlus: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 12v6M9 15h6"/></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></svg>'
};
/* Columnas visibles configurables (persistidas) */
let colPrefs = Object.assign({ clip: true, rating: true, autor: true, ano: true, tipo: false, etiquetas: false },
  JSON.parse(localStorage.getItem("bio-cols") || "{}"));
function toggleCol(k) {
  colPrefs[k] = !colPrefs[k];
  localStorage.setItem("bio-cols", JSON.stringify(colPrefs));
  abrirRefresco(); construirMenus();
}
// Resalta el término de búsqueda activo dentro del texto de la celda
function resalta(s) {
  const q = normT($("search") && $("search").value || "");
  s = String(s || "");
  if (!q) return esc(s);
  const idx = normT(s).indexOf(q);
  if (idx < 0) return esc(s);
  return esc(s.slice(0, idx)) + "<mark>" + esc(s.slice(idx, idx + q.length)) + "</mark>" + esc(s.slice(idx + q.length));
}
function tituloVista() {
  const labels = { todas: "Todas las referencias", recientes: "Añadidas recientemente", sinarchivar: "Sin archivar", papelera: "Papelera", dupes: "Referencias duplicadas" };
  if (labels[scope]) return labels[scope];
  const t = openTabs.find(x => x.scope === scope);
  return t ? t.label : scope;
}
function renderStage() {
  const st = $("stage");
  if (scope.startsWith("online")) { renderOnline(st); return; }
  if (scope === "dupes") { renderDupes(st); return; }

  const lista = visibles();
  const totalVivas = state.refs.filter(limpio).length;
  const vaciaDesdeCero = scope === "todas" && totalVivas === 0;
  setStatus(`Mostrando ${lista.length} de ${totalVivas} referencia(s)${estadoTexto()}${scope === "papelera" ? " · Papelera" : ""}`);
  st.innerHTML = `
    <div class="st-head">
      <div><h2>${esc(tituloVista())}</h2><div class="refcount">${lista.length} ${(scope === "papelera" ? "en la papelera" : "referencias")}${estadoTexto()}</div></div>
      ${scope !== "papelera" ? `<div class="iconbar">
        <div class="rib-g"><button id="ic-nref" title="Nueva referencia (Ctrl+N)">${ICONOS.docPlus}</button><span class="rib-cap">Nueva ref.</span></div>
        <div class="rib-g"><button id="ic-doi" title="Añadir por DOI">${ICONOS.userPlus}</button><span class="rib-cap">Por DOI</span></div>
        <div class="rib-g"><button id="ic-globe" title="Búsqueda en línea (OpenAlex)">${ICONOS.globe}</button><span class="rib-cap">En línea</span></div>
        <div class="rib-g"><button id="ic-dupe" title="Buscar duplicados">${ICONOS.clipPlus}</button><span class="rib-cap">Duplicados</span></div>
        <div class="rib-g"><button id="ic-cita" title="Copiar cita (estilo actual)">${ICONOS.cita}</button><span class="rib-cap">Copiar cita</span></div>
        <div class="rib-g"><button id="ic-exp" title="Exportar BibTeX">${ICONOS.share}</button><span class="rib-cap">Exportar</span></div>
        <div class="rib-g"><span class="rib-cap" style="margin-bottom:2px">Estilo:</span><select id="rib-estilo" class="rib-sel">${ESTILOS.map(e => `<option${e === estilo ? " selected" : ""}>${e}</option>`).join("")}</select></div>
      </div>` : `<div class="iconbar"><div class="rib-g"><button id="ic-purgar" class="danger-ib" title="Vaciar papelera" style="width:auto;padding:0 12px">Vaciar papelera</button><span class="rib-cap">Papelera</span></div></div>`}
    </div>
    <div class="bulkbar${scope === "papelera" || multiSel.size === 0 ? "" : " open"}" id="bulkbar"></div>
    <table class="rt"><colgroup>
      ${colPrefs.clip ? '<col style="width:40px">' : ""}
      ${colPrefs.rating ? '<col style="width:86px">' : ""}
      ${colPrefs.autor ? '<col style="width:230px">' : ""}
      ${colPrefs.ano ? '<col style="width:72px">' : ""}
      ${colPrefs.tipo ? '<col style="width:100px">' : ""}
      <col>
      ${colPrefs.etiquetas ? '<col style="width:180px">' : ""}
    </colgroup>
    <thead><tr>
      ${colPrefs.clip ? `<th class="c-clp">${ICONOS.clip.replace('<svg', '<svg style="width:13px;height:13px;opacity:.55"')}</th>` : ""}
      ${colPrefs.rating ? '<th class="c-star" title="Clic en las estrellas de una fila para cambiar su clasificación">Clasf.</th>' : ""}
      ${colPrefs.autor ? `<th><button class="sort-btn" data-k="autor">Autor ${flecha("autor")}</button></th>` : ""}
      ${colPrefs.ano ? `<th class="c-ano"><button class="sort-btn" data-k="ano">Año ${flecha("ano")}</button></th>` : ""}
      ${colPrefs.tipo ? "<th>Tipo</th>" : ""}
      <th><button class="sort-btn" data-k="titulo">Título ${flecha("titulo")}</button></th>
      ${colPrefs.etiquetas ? "<th>Etiquetas</th>" : ""}
      <th class="c-acc">${scope === "papelera" ? "Acciones" : ""}</th>
    </tr></thead><tbody id="tbody"></tbody></table>
    ${lista.length === 0 ? (vaciaDesdeCero
      ? `<div class="noresults"><div class="er-logo">${LOGO_MARCA}</div><b>Tu biblioteca está vacía</b>
         <div>Arrastra aquí un archivo <b>.ris</b> o <b>.bib</b> descargado (EndNote, Zotero, Mendeley, Google Scholar)<br>
         — se importará automáticamente. También puedes pulsar <b>Ctrl+N</b> para escribir una<br>
         o usar <b>Archivo → Importar</b>, o buscar por DOI en <b>Referencias → Añadir por DOI…</b></div></div>`
      : `<div class="noresults">${scope === "papelera" ? "La papelera está vacía." : "Sin resultados."}</div>`) : ""}
  `;
  const tb = st.querySelector("#tbody");
  let filaSel = null;
  lista.forEach((r, i) => {
    const tr = document.createElement("tr");
    if (r.id === selectedId) { tr.classList.add("sel"); filaSel = tr; }
    if (multiSel.has(r.id)) tr.classList.add("m-sel");
    if (!r.leido) tr.classList.add("unread");
    tr.dataset.id = r.id;
    const est = r.rating ? "<span class='st-on'>" + "★".repeat(Math.min(5, r.rating)) + "</span>" + "<span class='st-off'>" + "★".repeat(5 - Math.min(5, r.rating)) + "</span>" : "<span class='st-off'>☆</span>";
    tr.innerHTML = `${colPrefs.clip ? `<td class="c-clp">${r.pdf ? ICONOS.clip.replace('<svg', '<svg style="width:14px;height:14px"') : ""}</td>` : ""}
      ${colPrefs.rating ? `<td class="c-star" title="Clic para subir la clasificación (1–5)">${est}</td>` : ""}
      ${colPrefs.autor ? `<td>${resalta(autoresTabla(r))}</td>` : ""}
      ${colPrefs.ano ? `<td class="c-ano">${esc(r.ano)}</td>` : ""}
      ${colPrefs.tipo ? `<td>${esc(r.tipo || "")}</td>` : ""}
      <td class="t-title">${resalta(r.titulo)}${r.revista ? ` <span class="t-full">${esc(r.revista)}</span>` : ""}${r.retractado ? ' <span style="color:#b91c1c" title="Retractado o corregido según Crossref">⚠</span>' : ""}</td>
      ${colPrefs.etiquetas ? `<td style="color:var(--mut);font-size:12px">${esc((r.palabras_clave || "").slice(0, 60))}</td>` : ""}`;
    tr.addEventListener("click", e => {
      const idx = i;
      if (e.ctrlKey || e.metaKey) {
        multiSel.has(r.id) ? multiSel.delete(r.id) : multiSel.add(r.id);
        multiSelAncla = idx;
        renderStage(); return;
      }
      if (e.shiftKey && multiSelAncla !== null) {
        multiSel.clear();
        const [a, b] = [Math.min(multiSelAncla, idx), Math.max(multiSelAncla, idx)];
        for (let j = a; j <= b; j++) multiSel.add(lista[j].id);
        renderStage(); return;
      }
      selectedId = r.id; detailTab = "resumen";
      if (!r.leido) { r.leido = true; save().catch(() => {}); tr.classList.remove("unread"); }
      multiSel.clear(); multiSelAncla = idx;
      renderStage(); renderDetail();
    });
    const tdStar = tr.querySelector("td.c-star");
    if (tdStar) tdStar.addEventListener("click", async e => {
      e.stopPropagation();
      r.rating = ((+r.rating || 0) + 1) % 6;
      await save();
      renderStage();
    });
    if (scope === "papelera") {
      const td = document.createElement("td");
      td.innerHTML = `<button class="btn sm" data-a="restaurar">Restaurar</button> <button class="link-danger" data-a="del-forever">✕</button>`;
      td.querySelector("[data-a=restaurar]").addEventListener("click", async e => {
        e.stopPropagation(); r.papelera = false; await save(); toast("Restaurada a la biblioteca"); abrirRefresco();
      });
      td.querySelector("[data-a=del-forever]").addEventListener("click", async e => {
        e.stopPropagation();
        if (!confirm("¿Borrar definitivamente esta referencia?\n" + (r.titulo || ""))) return;
        await api.deletePdf(r.id);
        state.refs = state.refs.filter(x => x.id !== r.id);
        await save(); toast("Eliminada definitivamente"); abrirRefresco();
      });
      tr.appendChild(td);
    }
    tr.querySelector("td.c-ano") && null;
    tb.appendChild(tr);
  });
  if (filaSel) filaSel.scrollIntoView({ block: "nearest" });
  st.querySelectorAll(".sort-btn").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.k;
    if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = 1; }
    renderStage();
  }));
  const ac = {
    "ic-cita": copiarCitaSel, "ic-dupe": () => abreTab("dupes"), "ic-doi": addPorDOI,
    "ic-nref": () => abrirModal(null), "ic-exp": () => exportar("bib"), "ic-globe": () => abreTab("online:openalex"),
    "ic-purgar": vaciarPapelera
  };
  Object.entries(ac).forEach(([id, fn]) => { const b = st.querySelector("#" + id); if (b) b.addEventListener("click", fn); });
  const rs = st.querySelector("#rib-estilo");
  if (rs) rs.onchange = () => {
    estilo = rs.value;
    localStorage.setItem("bio-estilo", estilo);
    construirMenus();
    setStatus((st.querySelector("h2") || {}).textContent || "");
    toast("Estilo de citación: " + estilo);
  };
  // ==== barra de acciones sobre la selección múltiple ====
  const bb = st.querySelector("#bulkbar");
  if (bb && multiSel.size > 0 && scope !== "papelera") {
    bb.classList.add("open");
    bb.innerHTML = `<b>${multiSel.size} seleccionada(s)</b>
      <button class="btn sm" id="mb-col">＋ Añadir a colección…</button>
      <button class="btn sm" id="mb-copiar">📋 Copiar citas</button>
      <button class="btn sm" id="mb-exp">⬆ Exportar…</button>
      <button class="btn sm danger" id="mb-pap">🗑 Enviar a la papelera</button>
      <button class="btn sm" id="mb-read">👁 Marcar leído / no leído</button>
      <button class="btn sm" id="mb-clear">✕ Quitar selección</button>`;
    const selRefs = () => lista.filter(x => multiSel.has(x.id));
    bb.querySelector("#mb-col").onclick = async () => {
      const nn = await pedirTexto("Nombre de la colección (debe existir; se crea si no):", "");
      if (!nn) return;
      let g = state.grupos.find(x => normT(x.nombre) === normT(nn));
      if (!g) { g = { id: uid(), nombre: nn }; state.grupos.push(g); }
      let n = 0;
      selRefs().forEach(r => { if (!(r.grupos || []).includes(g.id)) { (r.grupos = r.grupos || []).push(g.id); n++; } });
      await save(); renderSidebar(); toast(`${n} referencia(s) añadidas a «${nn}»`);
    };
    bb.querySelector("#mb-copiar").onclick = async () => {
      const texto = selRefs().map(r => citar(r, estilo)).join("\n\n");
      await navigator.clipboard.writeText(texto);
      toast(`${multiSel.size} copiada(s) en formato ${estilo}`);
    };
    bb.querySelector("#mb-exp").onclick = async () => {
      const f = await pedirTexto("Formato: «ris» o «bib»", "ris");
      if (f) exportar(f.toLowerCase(), selRefs());
    };
    bb.querySelector("#mb-pap").onclick = async () => {
      if (!confirm(`¿Enviar ${multiSel.size} referencia(s) a la papelera?`)) return;
      selRefs().forEach(r => { r.papelera = true; });
      await save(); multiSel.clear(); toast("Enviadas a la papelera"); abrirRefresco();
    };
    bb.querySelector("#mb-read").onclick = async () => {
      const algunaSinLeer = selRefs().some(r => !r.leido);
      selRefs().forEach(r => { r.leido = algunaSinLeer; });
      await save(); toast(algunaSinLeer ? "Marcadas como leídas" : "Marcadas como no leídas");
      abrirRefresco();
    };
    bb.querySelector("#mb-clear").onclick = () => { multiSel.clear(); multiSelAncla = null; renderStage(); };
  }
}
function estadoTexto() {
  const q = normT($("search").value);
  const nAv = Object.values(ADV).filter(Boolean).length;
  if (q || nAv) return ` (filtrado${q ? ` por "${q}"` : ""}${nAv ? " + avanzado" : ""})`;
  return "";
}
function autoresTabla(r) {
  const lista = parseAutores(r.autores);
  if (!lista.length) return "—";
  return lista.slice(0, 2).join("; ") + (lista.length > 2 ? "…" : "");
}
function flecha(k) { return sortKey === k ? (sortDir > 0 ? "▴" : "▾") : ""; }
function renderDupes(st) {
  const grupos = gruposDuplicados();
  setStatus(`${grupos.length} grupo(s) con duplicados`);
  st.innerHTML = `
    <div class="st-head"><div><h2>Referencias duplicadas</h2>
    <div class="refcount">${grupos.length ? grupos.length + " grupos con duplicados" : "No se detectaron duplicados"}</div></div></div>`;
  if (!grupos.length) { st.innerHTML += `<div class="noresults">Todo bien: no hay títulos ni DOI repetidos.</div>`; return; }
  grupos.forEach((g, i) => {
    const box = document.createElement("div");
    box.className = "dup-group";
    box.innerHTML = `<h4>Duplicado ${i + 1} — ${g.length} coincidencias</h4>`;
    g.forEach((r, j) => {
      const row = document.createElement("div");
      row.className = "dup-ref";
      row.innerHTML = `<div class="dr-info"><div class="dr-title">${r.doi ? "🔗 " : ""}${esc(r.titulo)}${j === 0 ? "  <span style='color:var(--teal);font-size:11.5px'>(conservada)</span>" : ""}</div>
        <div class="dr-meta">${esc(r.autores)} · ${esc(r.ano)} · agregado ${esc(r.fecha)}</div></div>`;
      const btn = document.createElement("button");
      btn.className = "link-danger"; btn.textContent = "Mover a papelera";
      btn.onclick = async () => { r.papelera = true; await save(); toast("Enviada a la papelera"); abrirRefresco(); };
      row.appendChild(btn);
      box.appendChild(row);
    });
    st.appendChild(box);
  });
}
let OLQ = null;
function renderOnline(st) {
  const fuente = scope.slice(7);
  setStatus(`Búsqueda en línea — ${ONLINE.resultados.length} resultado(s)${ONLINE.q ? ` para "${ONLINE.q}"` : ""}`);
  st.innerHTML = `
    <div class="st-head"><div><h2>Búsqueda en línea — ${esc(FUENTES[fuente] || fuente)}</h2>
    <div class="refcount">Consulta bibliográfica pública; los resultados no se guardan hasta que los importes.</div></div></div>
    <div class="ol-actions">
      <div class="qbox" style="max-width:420px">
        <input id="ol-q" placeholder="Buscar títulos, autores, palabras…">
        <button class="btn primary sm" id="ol-go" style="margin:4px">${ONLINE.cargando ? '<span class="spin"></span>' : "Buscar"}</button>
      </div>
    </div>
    <div class="ol-note">${ONLINE.error ? `<span style="color:#dc2626">${esc(ONLINE.error)}</span>` : (ONLINE.q ? `${ONLINE.resultados.length} resultados para "${esc(ONLINE.q)}"` : "")}</div>
    <div id="ol-list"></div>`;
  const q = st.querySelector("#ol-q");
  q.value = ONLINE.q || OLQ || "";
  q.addEventListener("keydown", e => { if (e.key === "Enter") lanzar(); });
  st.querySelector("#ol-go").addEventListener("click", lanzar);
  function lanzar() { const v = q.value.trim(); if (!v) { toast("Escribe una consulta"); return; } OLQ = v; buscarOnline(fuente, v); }
  const lista = st.querySelector("#ol-list");
  const tabla = document.createElement("table");
  tabla.className = "rt";
  tabla.innerHTML = `<colgroup><col style="width:212px"><col style="width:64px"><col><col style="width:110px"></colgroup>
    <thead><tr><th>Autor</th><th>Año</th><th>Título</th><th></th></tr></thead><tbody></tbody>`;
  const tb = tabla.querySelector("tbody");
  ONLINE.resultados.forEach((r, i) => {
    const yaEsta = state.refs.some(x => limpio(x) && ((r.doi && x.doi && normT(x.doi) === normT(r.doi)) || normT(x.titulo) === normT(r.titulo)));
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${esc(autoresTabla(r))}</td><td class="c-ano">${esc(r.ano)}</td><td>${esc(r.titulo)}</td>`;
    const td = document.createElement("td");
    if (yaEsta) td.innerHTML = `<span style="color:var(--teal);font-size:12px">✓ En biblioteca</span>`;
    else {
      td.innerHTML = `<button class="btn sm primary">＋ Añadir</button>`;
      td.querySelector("button").onclick = async () => {
        const nr = refNueva(r); nr.id = uid(); nr.fecha = ahora(); nr.grupos = []; nr.papelera = false;
        state.refs.unshift(nr);
        await save(); renderSidebar(); renderStage();
        toast("Referencia añadida a la biblioteca");
      };
    }
    tr.appendChild(td);
    tb.appendChild(tr);
  });
  lista.appendChild(tabla);
  if (!ONLINE.cargando && !ONLINE.q && !ONLINE.error)
    lista.insertAdjacentHTML("beforebegin", `<div class="noresults">Escribe una consulta y pulsa «Buscar».</div>`);
}

/* ============================ PANEL DETALLE ============================ */
const selEstilo = () => `<select id="sel-estilo">${ESTILOS.map(e => `<option${e === estilo ? " selected" : ""}>${e}</option>`).join("")}</select>`;
function renderDetail() {
  const d = $("detail");
  const r = refById(selectedId);
  if (!r || !panelDetalles) { d.classList.remove("open"); d.innerHTML = ""; return; }
  d.classList.add("open");
  const mini = `${parseAutores(r.autores)[0]?.split(",")[0] || ""}${parseAutores(r.autores).length > 1 ? " et al." : ""}${r.ano ? ", " + r.ano : ""}`;
  const fichas = [["resumen", "Summary"], ["editar", "Edit"], ["pdf", "PDF"]];
  d.innerHTML = `
    <div class="d-head">
      <span class="d-cite" title="${esc(mini)}">${esc(mini)}…, ${esc(r.ano || "")} …</span>
      <div class="d-tabs">${fichas.map(([k, l]) => `<button class="d-tab${detailTab === k ? " active" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>
      <div class="d-ico">
        ${r.url || r.doi ? `<button id="d-ext" title="Abrir enlace en el navegador">↗</button>` : ""}
        <button id="d-gear" title="Estilo de citación">⚙</button>
        <button id="d-close" title="Cerrar">✕</button>
      </div>
    </div>
    <div id="d-tool"></div>
    <div id="d-scroll"></div>`;
  d.querySelectorAll(".d-tab").forEach(b => b.onclick = () => { detailTab = b.dataset.tab; renderDetail(); });
  $("d-close").onclick = () => { selectedId = null; renderDetail(); renderStage(); };
  const ext = $("d-ext");
  if (ext) ext.onclick = () => { const u = r.doi ? `https://doi.org/${r.doi}` : r.url; window.open(u, "_blank"); };
  $("d-gear").onclick = () => {
    $("detail").querySelector("#d-tool").innerHTML = `<span style="font-size:12px;color:var(--muted)">Estilo:</span> ${selEstilo()}
      <button class="btn sm" id="d-copiar">📋 Copiar cita</button>`;
    armarEstilo(r);
  };
  if (detailTab === "resumen") pestañaResumen(d, r);
  else if (detailTab === "editar") pestañaEditar(d, r);
  else pestañaPdf(d, r);
}
function armarEstilo(r) {
  const s = $("sel-estilo");
  if (!s) return;
  s.value = estilo;
  s.onchange = () => { estilo = s.value; localStorage.setItem("bio-estilo", estilo); if (r) pintarPreview(r); };
  const c = $("d-copiar");
  if (c) c.onclick = copiarCitaSel;
}
function pintarPreview(r) {
  const caja = document.querySelector("#d-scroll .preview");
  if (!caja) return;
  caja.querySelector("p").innerHTML = citaHTML(r, estilo);
  caja.querySelector("select").value = estilo;
}
/* Marcas de texto aplicables a los campos (B/I/U/X¹/X₂ de la barra Edición) */
function renderNotas(t) {
  let h = esc(t);
  h = h.replace(/\^\{([^}]*)\}/g, "<sup>$1</sup>").replace(/~\{([^}]*)\}/g, "<sub>$1</sub>");
  h = h.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  h = h.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<i>$2</i>");
  h = h.replace(/__([^_]+)__/g, "<u>$1</u>");
  return h;
}
function citaHTML(r, e) {
  let c = esc(citar(r, e));
  if (r.revista) c = c.replace(esc(r.revista), `<em>${esc(r.revista)}</em>`);
  if (r.doi) c = c.replace(esc(`https://doi.org/${r.doi}`), `<a href="#" data-ext="https://doi.org/${esc(r.doi)}">${esc(`https://doi.org/${r.doi}`)}</a>`);
  return c;
}
function pestañaResumen(d, r) {
  const dtool = $("d-tool");
  dtool.innerHTML = `<span style="font-size:12px;color:var(--muted)">Estilo:</span> ${selEstilo()} <button class="btn sm" id="d-copiar">📋 Copiar cita</button>`;
  const etiquetasHTML = `<div class="tagchips">${parseAutores(r.palabras_clave).map(t => `<span class="chip">#${esc(t)}</span>`).join("") || "<span style='color:var(--muted);font-size:12px'>—</span>"}</div>`;
  $("d-scroll").innerHTML = `
    <span class="badge">${esc(r.tipo)}</span>${r.retractado ? '<span class="badge" style="background:#fee2e2;color:#b91c1c">⚠ Retractado / corregido</span>' : ""}
    <div class="d-title">${esc(r.titulo) || "(sin título)"}</div>
    <dl class="kv">
      <dt>Autor</dt><dd>${esc(r.autores) || "—"}</dd>
      <dt>Año</dt><dd>${esc(r.ano) || "—"}</dd>
      <dt>Fuente</dt><dd>${esc(r.revista || r.editorial) || "—"}</dd>
      ${r.volumen || r.numero || r.paginas ? `<dt>Vol./N.º/Pág.</dt><dd>${esc(r.volumen || "—")} / ${esc(r.numero || "—")} / ${esc(r.paginas || "—")}</dd>` : ""}
      <dt>URL</dt><dd>${r.doi ? `<a href="#" data-ext="https://doi.org/${esc(r.doi)}">${esc(r.doi)}</a>` : (r.url ? `<a href="#" data-ext="${esc(r.url)}">${esc(r.url)}</a>` : "—")}</dd>
      ${r.editorial && r.revista ? `<dt>Editorial</dt><dd>${esc(r.editorial)}</dd>` : ""}
      ${r.notas ? `<dt>Notas</dt><dd>${renderNotas(r.notas)}</dd>` : ""}
      <dt>Agregado</dt><dd>${esc(r.fecha)}</dd>
      <dt>Clasificación</dt><dd><span class="stars-detail">${[1, 2, 3, 4, 5].map(k => `<button data-star="${k}" title="${k} estrella(s)">${k <= (r.rating || 0) ? "★" : "☆"}</button>`).join("")}</span></dd>
      <dt>Etiquetas</dt><dd>${etiquetasHTML}</dd>
    </dl>
    <div class="d-label">Vista previa (APA por defecto)</div>
    <div class="preview">${selEstilo()}<p id="pv-txt"></p></div>
    ${Object.keys(state.gruposInteligentes || {}).length === 0 ? "" : ""}
    <div class="p-actions">
      <button class="btn primary" id="d-word">📄 Insertar en Word</button>
      <button class="btn" id="d-descargar">⬇ Descargar cita</button>
      <button class="btn" id="d-msread">${r.leido ? "👁 Marcar como NO leída" : "👁 Marcar como leída"}</button>
      <button class="btn danger" id="d-eliminar">🗑 Eliminar (a papelera)</button>
    </div>
    <div class="d-hint">Citas y bibliografías: estilo seleccionable con ⚙ o el selector de arriba.</div>`;
  armarEstilo(r);
  const pv = $("pv-txt"); pv.innerHTML = citaHTML(r, estilo);
  const selE = $("sel-estilo");
  selE.onchange = () => { estilo = selE.value; localStorage.setItem("bio-estilo", estilo); pv.innerHTML = citaHTML(r, estilo); };
  $("d-copiar").onclick = copiarCitaSel;
  document.querySelectorAll("[data-ext]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); window.open(a.dataset.ext, "_blank"); }));
  $("d-word").onclick = async () => {
    const texto = citar(r, estilo);
    const html = `<p style=\"font-family:Georgia,serif\">${citaHTML(r, estilo)}</p>`;
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/plain": new Blob([texto], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" })
      })]);
      toast("Cita lista: pégala en Word con Ctrl+V");
    } catch (e) { await navigator.clipboard.writeText(texto); toast("Cita copiada"); }
  };
  $("d-descargar").onclick = descargarCitaSel;
  $("d-eliminar").onclick = async () => {
    if (!confirm("¿Enviar a la papelera?\n" + (r.titulo || ""))) return;
    r.papelera = true;
    await save();
    selectedId = null;
    toast("Enviada a la papelera");
    abrirRefresco();
  };
  $("d-msread").onclick = toggleLeidoSel;
  $("d-scroll").querySelectorAll("[data-star]").forEach(b => b.onclick = async () => {
    const k = +b.dataset.star;
    r.rating = r.rating === k ? 0 : k;
    await save(); renderDetail(); renderStage();
  });
}
function pestañaEditar(d, r) {
  const edSnap = {};
  ["e-autores", "e-ano", "e-titulo", "e-revista", "e-volumen", "e-numero", "e-paginas", "e-doi", "e-url", "e-editorial", "e-direccion", "e-resumen", "e-notas"].forEach(id => { edSnap[id] = r[{ "e-autores": "autores", "e-ano": "ano", "e-titulo": "titulo", "e-revista": "revista", "e-volumen": "volumen", "e-numero": "numero", "e-paginas": "paginas", "e-doi": "doi", "e-url": "url", "e-editorial": "editorial", "e-direccion": "direccion", "e-resumen": "resumen", "e-notas": "notas" }[id]] ?? ""; });
  $("d-tool").innerHTML = `
    <div class="fmt-bar">
      <button data-f="b" title="Negrita (aplica al campo de texto enfocado, p. ej. Notas)">B</button>
      <button data-f="i" title="Cursiva">I</button>
      <button data-f="u" title="Subrayado">U</button>
      <button data-f="sup" title="Superíndice">X¹</button>
      <button data-f="sub" title="Subíndice">X₂</button>
      <button data-f="find" title="Buscar en la biblioteca (Ctrl+F)">⌕</button>
    </div>
    <button class="btn sm" id="ed-cmp">Ver cambios</button>
    <button class="btn sm" id="ed-cancel">Cancelar</button>
    <button class="btn sm primary" id="ed-save">Guardar</button>`;
  const tagsHTML = parseAutores(r.palabras_clave).map(t => `<span class="chip">#${esc(t)}<button data-tag="${esc(t)}" title="Quitar">✕</button></span>`).join("");
  $("d-scroll").innerHTML = `
    <div class="formrow"><label>Tags</label><div id="tagzone"><div class="tagchips">${tagsHTML}<input id="tag-add" placeholder="＋ etiqueta"></div>
      <div class="d-hint">Enter para añadir · ✕ para quitar</div></div></div>
    <div class="formrow"><label>Reference Type</label><div><select id="e-tipo">${TIPOS.map(t => `<option${t === r.tipo ? " selected" : ""}>${t}</option>`).join("")}</select></div></div>
    <div class="formrow"><label>Author</label><div><input id="e-autores" value="${esc(r.autores)}" placeholder="Apellido, N. — separar con «;»"></div></div>
    <div class="formrow"><label>Year</label><div><input id="e-ano" value="${esc(r.ano)}"></div></div>
    <div class="formrow"><label>Title</label><div><textarea id="e-titulo">${esc(r.titulo)}</textarea></div></div>
    <div class="formrow"><label>Journal</label><div><input id="e-revista" value="${esc(r.revista)}"></div></div>
    <div class="formrow"><label>Volume</label><div><input id="e-volumen" value="${esc(r.volumen)}"></div></div>
    <div class="formrow"><label>Issue</label><div><input id="e-numero" value="${esc(r.numero)}"></div></div>
    <div class="formrow"><label>Pages</label><div><input id="e-paginas" value="${esc(r.paginas)}"></div></div>
    <div class="formrow"><label>DOI</label><div><input id="e-doi" value="${esc(r.doi)}"></div></div>
    <div class="formrow"><label>URL</label><div><input id="e-url" value="${esc(r.url)}"></div></div>
    <div class="formrow"><label>Publisher</label><div><input id="e-editorial" value="${esc(r.editorial)}"></div></div>
    <div class="formrow"><label>Place</label><div><input id="e-direccion" value="${esc(r.direccion)}"></div></div>
    <div class="formrow"><label>Abstract</label><div><textarea id="e-resumen">${esc(r.resumen)}</textarea></div></div>
    <div class="formrow"><label>Notes</label><div><textarea id="e-notas">${esc(r.notas)}</textarea></div></div>`;
  // etiquetas en vivo
  const zone = $("tagzone").querySelector(".tagchips");
  function repinta() {
    zone.innerHTML = parseAutores(r.palabras_clave).map(t => `<span class="chip">#${esc(t)}<button data-tag="${esc(t)}">✕</button></span>`).join("") +
      `<input id="tag-add" placeholder="＋ etiqueta">`;
    const inp = zone.querySelector("#tag-add");
    inp.addEventListener("keydown", async e => {
      if (e.key === "Enter" && inp.value.trim()) {
        const act = parseAutores(r.palabras_clave);
        if (!act.some(t => normT(t) === normT(inp.value))) {
          act.push(inp.value.trim());
          r.palabras_clave = act.join("; ");
          await save(); repinta(); renderSidebar();
        }
      }
    });
    zone.querySelectorAll("[data-tag]").forEach(b => b.addEventListener("click", async () => {
      const act = parseAutores(r.palabras_clave).filter(t => normT(t) !== normT(b.dataset.tag));
      r.palabras_clave = act.join("; ");
      await save(); repinta(); renderSidebar();
    }));
  }
  repinta();
  const MARCAS = { b: ["**", "**"], i: ["*", "*"], u: ["__", "__"], sup: ["^{", "}"], sub: ["~{", "}"] };
  d.querySelectorAll(".fmt-bar [data-f]").forEach(b => {
    b.addEventListener("mousedown", e => e.preventDefault()); // conserva la selección del campo
    b.addEventListener("click", () => {
      const f = b.dataset.f;
      if (f === "find") { $("search").focus(); return; }
      const el = document.activeElement;
      if (!el || (el.tagName !== "INPUT" && el.tagName !== "TEXTAREA")) { toast("Haz clic en un campo de texto primero (p. ej., Notas)"); return; }
      const [m1, m2] = MARCAS[f];
      const ini = el.selectionStart ?? el.value.length, fin = el.selectionEnd ?? ini;
      const v = el.value;
      el.value = v.slice(0, ini) + m1 + v.slice(ini, fin) + m2 + v.slice(fin);
      el.selectionStart = ini + m1.length; el.selectionEnd = fin + m1.length;
      el.focus();
    });
  });
  $("ed-cmp").onclick = () => {
    const campos = [["e-autores", "Autor"], ["e-ano", "Año"], ["e-titulo", "Título"], ["e-revista", "Revista"], ["e-volumen", "Volumen"], ["e-numero", "Número"], ["e-paginas", "Páginas"], ["e-doi", "DOI"], ["e-url", "URL"], ["e-editorial", "Editorial"], ["e-direccion", "Lugar"], ["e-resumen", "Resumen"], ["e-notas", "Notas"]];
    const difs = campos.filter(([id]) => ($(id).value.trim() ?? "") !== String(edSnap[id] ?? "").trim());
    if (!difs.length) { toast("No hay cambios desde que abriste el formulario"); return; }
    alert("Cambios sin guardar:\n\n" + difs.map(([id, n]) => {
      const a = String(edSnap[id] || "(vacío)").slice(0, 60), b = $(id).value.trim() || "(vacío)";
      return `• ${n}: «${a}» → «${String(b).slice(0, 60)}»`;
    }).join("\n"));
  };
  $("ed-save").onclick = async () => {
    const g = id => $(id).value.trim();
    const nuevo = { tipo: $("e-tipo").value, autores: g("e-autores"), ano: g("e-ano"), titulo: g("e-titulo"),
      revista: g("e-revista"), volumen: g("e-volumen"), numero: g("e-numero"), paginas: g("e-paginas"),
      doi: g("e-doi"), url: g("e-url"), editorial: g("e-editorial"), direccion: g("e-direccion"),
      resumen: g("e-resumen"), notas: g("e-notas") };
    if (!nuevo.titulo) { toast("⚠️ El título es obligatorio"); return; }
    if (esDuplicado({ titulo: nuevo.titulo, doi: nuevo.doi }, r.id) &&
        !confirm("Otra referencia tiene ese título o DOI.\n¿Guardar de todas formas?")) return;
    Object.assign(r, nuevo);
    await save(); toast("Cambios guardados"); renderStage(); renderDetail();
  };
  $("ed-cancel").onclick = () => { detailTab = "resumen"; pestañaResumen(d, r); d.querySelectorAll(".d-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === "resumen")); };
}
let pdfBlobURL = null;
function pestañaPdf(d, r) {
  $("d-tool").innerHTML = r.pdf ? `<button class="btn sm" id="pdf-ext">↗ Abrir en visor del sistema</button>
    <button class="btn sm" id="pdf-win">🖥 Ver en ventana</button>
    <button class="btn sm" id="pdf-re">📎 Reemplazar</button> <button class="btn sm" id="pdf-oa">🔎 Buscar en línea</button> <button class="btn sm danger" id="pdf-q">Quitar</button>`
    : `<button class="btn sm primary" id="pdf-add">📎 Adjuntar PDF…</button> ${r.doi ? `<button class="btn sm" id="pdf-oa">🔎 Buscar en línea (acceso abierto)</button>` : ""}`;
  $("d-scroll").innerHTML = r.pdf ? `
    <span class="badge">PDF adjunto</span>
    <div class="d-hint">Guardado como archivo real en la carpeta de datos. Aparece con 📎 en la lista.</div>
    <iframe class="pdfframe" id="pdf-frame"></iframe>`
    : `<div class="pdf-drop" style="margin-top:14px"><div style="font-size:34px">📎</div>
       <div><b>Sin PDF adjunto</b></div><div>Adjunta una copia del artículo; se guarda solo en esta máquina.</div></div>`;
  if (r.pdf) {
    (async () => {
      const buf = await api.readPdf(r.id);
      if (!buf) { toast("No se pudo cargar el PDF"); return; }
      if (pdfBlobURL) URL.revokeObjectURL(pdfBlobURL);
      pdfBlobURL = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
      $("pdf-frame").src = pdfBlobURL;
    })();
    $("pdf-ext").onclick = () => api.openPdf(r.id);
    $("pdf-win").onclick = () => api.pdfWindow(r.id);
    $("pdf-re").onclick = () => adjuntarPdf(r.id);
    $("pdf-q").onclick = async () => {
      if (!confirm("¿Quitar el PDF adjunto? El archivo se borrará.")) return;
      await api.deletePdf(r.id); r.pdf = false; await save(); toast("PDF quitado"); renderAll();
    };
  } else {
    $("pdf-add").onclick = () => adjuntarPdf(r.id);
  }
  const oaBtn = $("pdf-oa");
  if (oaBtn) oaBtn.onclick = () => buscarPdfEnLinea(r);
}
async function copiarCitaSel() {
  const r = refById(selectedId);
  if (!r) { toast("Selecciona una referencia primero"); return; }
  await navigator.clipboard.writeText(citar(r, estilo));
  toast(`Cita copiada (${estilo})`);
}
async function adjuntarPdf(id) {
  const ok = await api.importPdf(id);
  const r = refById(id);
  if (ok && r) { r.pdf = true; await save(); toast("PDF adjuntado"); renderDetail(); renderStage(); detectarDoiEnPdf(id); }
}

/* ============================ acciones globales ============================ */
function abrirModal(ref) {
  editingId = ref ? ref.id : null;
  const m = $("modal");
  m.querySelector("h3").textContent = ref ? "Editar referencia" : "Nueva referencia";
  $("f-tipo").value = ref ? ref.tipo : "artículo";
  ["titulo", "autores", "ano", "revista", "volumen", "numero", "paginas", "doi", "url", "editorial", "direccion", "palabras", "resumen", "notas"].forEach(k => {
    const el = $("f-" + k); if (el) el.value = ref ? (ref[k] ?? "") : "";
  });
  $("modal-backdrop").classList.add("open");
  $("f-titulo").focus();
}
let editingId = null;
async function guardarModal() {
  const g = id => $(id).value.trim();
  const titulo = g("f-titulo");
  if (!titulo) { toast("⚠️ El título es obligatorio"); return; }
  const datos = { tipo: $("f-tipo").value, titulo, autores: g("f-autores"), ano: g("f-ano"), revista: g("f-revista"),
    volumen: g("f-volumen"), numero: g("f-numero"), paginas: g("f-paginas"), doi: g("f-doi"), url: g("f-url"),
    editorial: g("f-editorial"), direccion: g("f-direccion"), palabras_clave: g("f-palabras"),
    resumen: g("f-resumen"), notas: g("f-notas") };
  if (esDuplicado({ titulo, doi: datos.doi }, editingId) && !confirm("Otra referencia tiene ese título o DOI.\n¿Guardar de todas formas?")) return;
  if (editingId) Object.assign(refById(editingId), datos);
  else {
    const r = refNueva(datos);
    if (scope.startsWith("col:")) r.grupos = [scope.slice(4)];
    state.refs.unshift(r);
    selectedId = r.id;
  }
  await save();
  $("modal-backdrop").classList.remove("open");
  toast(editingId ? "Referencia actualizada" : "Referencia añadida");
  abrirRefresco();
}
async function addPorDOI() {
  const doi = await pedirTexto("DOI o enlace https://doi.org/…", "");
  if (!doi) return;
  toast("Buscando metadatos…");
  const met = await fetchDOI(doi);
  if (!met || !met.titulo) { toast("⚠️ No se encontró ese DOI (¿sin conexión?)"); return; }
  abrirModal(null);
  ["titulo", "autores", "ano", "revista", "volumen", "numero", "paginas", "doi", "url", "editorial"].forEach(k => { const el = $("f-" + k); if (el) el.value = met[k] || ""; });
  toast("Metadatos descargados — revisa y guarda");
}
// Find Reference Updates: completa campos vacíos a partir del DOI (CrossRef/OpenAlex)
async function actualizarDesdeDOI() {
  const r = refById(selectedId);
  if (!r) { toast("Selecciona una referencia primero"); return; }
  let doi = r.doi;
  if (!doi) {
    doi = await pedirTexto("DOI para actualizar metadatos:", "");
    if (!doi) return;
    r.doi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
  }
  toast("Consultando metadatos…");
  const met = await fetchDOI(r.doi);
  if (!met || !met.titulo) { toast("⚠️ No se encontraron datos (¿sin conexión?)"); return; }
  let cambios = [];
  ["titulo", "autores", "ano", "revista", "volumen", "numero", "paginas", "editorial", "url"].forEach(k => {
    if (met[k] && !r[k]) { r[k] = met[k]; cambios.push(k); }
  });
  if (!r.resumen && met.resumen) { r.resumen = met.resumen; cambios.push("resumen"); }
  await save();
  toast(cambios.length ? `Metadatos completados: ${cambios.length} campo(s)` : "Todo ya estaba completo");
  abrirRefresco();
  if (selectedId) renderDetail();
}
// Imprimir la vista actual (vista previa de impresión de EndNote)
function imprimirVista() { window.print(); }
// E-mail Reference: envía la cita por correo
function correoReferencia() {
  const r = refById(selectedId);
  if (!r) { toast("Selecciona una referencia primero"); return; }
  const asunto = `${(r.ano || "")} — ${r.titulo || "Referencia"}`.slice(0, 110);
  const cuerpo = `${citar(r, estilo)}\n\n${r.doi ? "https://doi.org/" + r.doi : (r.url || "")}\n\nEnviado desde BioCiencia — Gestor de referencias`;
  window.open(`mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`, "_blank");
}
// Matcher de manuscrito (EndNote 25): sugiere revistas según título+resumen usando OpenAlex
async function sugerirRevista() {
  const r = selectedId ? refById(selectedId) : null;
  let texto = r ? [r.titulo, r.resumen].filter(Boolean).join(". ") : "";
  texto = await pedirTextoMatcher(texto);
  if (!texto || !texto.trim()) return;
  toast("Analizando coincidencias en OpenAlex…");
  try {
    const resp = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(texto.slice(0, 400))}&per-page=75`);
    const j = await resp.json();
    const cuentas = {};
    (j.results || []).forEach(w => {
      const s = w.primary_location && w.primary_location.source;
      if (s && s.display_name) cuentas[s.display_name] = (cuentas[s.display_name] || 0) + 1;
    });
    const top = Object.entries(cuentas).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (!top.length) { toast("Sin resultados suficientes (¿sin conexión?)"); return; }
    const max = top[0][1];
    const listado = top.map(([n, c]) => `${"●".repeat(Math.round(4 * c / max))} ${n} — ${c} trabajo(s) afín(es)`).join("\n");
    const total = top.reduce((s, [, c]) => s + c, 0);
    alert(`Matcher de manuscrito\n\nRevistas donde se publica trabajo similar al tuyo:\n\n${listado}\n\nBasado en ${j.results.length} resultados de OpenAlex; ${total} de ellos en las revistas listadas.`);
  } catch { toast("⚠️ No se pudo consultar OpenAlex (¿sin conexión?)"); }
}
// Pide el texto del manuscrito (usa el de la referencia seleccionada como punto de partida)
async function pedirTextoMatcher(base) {
  return pedirTexto("Matcher de manuscrito — pega aquí el TÍTULO y RESUMEN de tu manuscrito:", base || "");
}
// Comprobación de retracciones / correcciones (Crossref — EndNote 21/25)
async function comprobarRetraccionSel() {
  const r = selectedId ? refById(selectedId) : null;
  if (!r) { toast("Selecciona una referencia primero"); return; }
  if (!r.doi) { toast("Esta referencia no tiene DOI — no se puede comprobar en Crossref"); return; }
  toast("Consultando Crossref…");
  const aviso = await consultaRetraccion(r.doi);
  if (aviso) {
    r.retractado = true;
    await save();
    abrirRefresco();
    alert(`⚠️ ${r.titulo || "Referencia"}\n\n${aviso}`);
  } else {
    if (r.retractado) { delete r.retractado; await save(); abrirRefresco(); }
    toast("✓ Sin retracciones ni correcciones registradas en Crossref");
  }
}
async function consultaRetraccion(doi) {
  try {
    const resp = await fetch(`https://api.crossref.org/works/${encodeURIComponent(String(doi).replace(/^https?:\/\/doi\.org\//i, ""))}`);
    if (!resp.ok) return null;
    const msg = (await resp.json()).message || {};
    const av = [];
    (msg["update-to"] || []).forEach(u => {
      const tipo = String((u.type || "") + " " + (u.label || ""));
      if (/retrac|withdraw/i.test(tipo)) av.push(`Este artículo fue RETRACTADO (${u.label || u.type || ""}).`);
      else if (/correction|erratum|corrigendum/i.test(tipo)) av.push(`Tiene ${u.label || "una corrección/errata"} publicada.`);
    });
    (msg["updated-by"] || []).forEach(u => {
      const tipo = String(u.type || "");
      if (/retrac|withdraw/i.test(tipo)) av.push("Este artículo fue retractado.");
      else if (/correction|erratum|corrigendum|update/i.test(tipo)) av.push("Tiene una corrección/actualización publicada.");
    });
    return [...new Set(av)].join("\n") || null;
  } catch { return null; }
}
// ====== EndNote 25: restaurar respaldo ======
async function restaurarRespaldo() {
  const res = await api.openFile({ filters: [{ name: "Respaldo de BioCiencia (JSON)", extensions: ["json"] }] });
  if (!res) return;
  let lib;
  try { lib = JSON.parse(res.content); } catch { toast("El archivo no es un JSON válido"); return; }
  if (!lib || !Array.isArray(lib.refs)) { toast("No es un respaldo de BioCiencia"); return; }
  if (!confirm(`¿Reemplazar la biblioteca actual (${state.refs.length} referencias) por el respaldo (${lib.refs.length} referencias)?`)) return;
  state = Object.assign({ grupos: [], gruposInteligentes: [], sets: [], listasTerminos: {}, refs: [] }, lib);
  await save(); abrirRefresco();
  toast(`✅ Biblioteca restaurada — ${lib.refs.length} referencia(s)`);
}
// ====== EndNote 25: Cite While You Write (Word) ======
// Copia la «cita temporal» {Autor, Año #N} que Word/formatearDocumento entiende
async function copiarCitaTemporal() {
  const r = refById(selectedId);
  if (!r) { toast("Selecciona una referencia primero"); return; }
  const n = state.refs.indexOf(r) + 1;
  const au = parseAutores(r.autores)[0] || "Autor";
  const marcador = `{${au.split(",")[0]}, ${r.ano || "s. f."} #${n}}`;
  await navigator.clipboard.writeText(marcador);
  toast(`Cita temporal copiada: ${marcador} — pégala en Word y usa «Formatear documento» aquí al terminar`);
}
// Número de registro (posición 1-based en la biblioteca, como en EndNote)
function refsCitedStyle() {
  return /IEEE|Elsevier|Vancouver|Nature|ACS|AMA/.test(estilo);
}
function citaInline(r, n) {
  if (refsCitedStyle()) return `[${n}]`;
  const au = (parseAutores(r.autores)[0] || "Anónimo").split(",")[0];
  return `(${au}, ${r.ano || "s. f."})`;
}
// Convierte un .txt/.md/.rtf con citaciones temporales {Autor, Año #N} en un documento formateado + bibliografía
async function formatearDocumento() {
  const res = await api.openFile({ filters: [{ name: "Documento con citaciones temporales (txt, md, rtf)", extensions: ["txt", "md", "rtf"] }] });
  if (!res) return;
  let texto = res.content;
  const marcador = /\{[^{}]*#\s*([^{}#\s]+)\s*\}/g;
  const vista = [];
  const salida = texto.replace(marcador, (m, idn) => {
    const r = state.refs[+idn - 1];
    if (!r) { toast("⚠️ La referencia #" + idn + " ya no existe en la biblioteca"); return m; }
    if (!vista.includes(+idn)) vista.push(+idn);
    return citaInline(r, vista.length);
  });
  if (!vista.length) { toast("No se encontraron citaciones temporales {Autor, Año #N} en el documento"); return; }
  const citadas = vista.map(n => state.refs[n - 1]);
  const numerada = refsCitedStyle();
  const bibl = citadas.map((r, i) => numerada ? `${i + 1}. ${citar(r, estilo)}` : citar(r, estilo)).join("\n\n");
  const salida2 = salida + `\n\nBibliografía (estilo ${estilo})\n\n${bibl}`;
  const ruta = await api.saveFileAs({ defaultName: res.path.replace(/\.[^.]+$/, "") + `.formateado.${res.path.toLowerCase().endsWith(".rtf") ? "rtf" : "txt"}`, filters: [{ name: "Texto", extensions: ["txt"] }] });
  if (!ruta) return;
  const ok = await api.writeFile(ruta, salida2);
  toast(ok ? `✅ Documento formateado: ${ruta.split(/[\\/]/).pop()} — ${citadas.length} cita(s), estilo ${estilo}` : "Error al guardar el documento formateado");
}
// ====== EndNote 25: Cambiar campos de la selección/ vista ======
async function cambiarCampos() {
  const mapa = { autores: "Autor", revista: "Revista", palabras_clave: "Etiquetas", notas: "Notas", resumen: "Resumen", url: "URL", editorial: "Editorial", direccion: "Lugar", ano: "Año" };
  const campo = await pedirTexto("Campo a cambiar:\n" + Object.entries(mapa).map(([k, v]) => `  ${k} = ${v}`).join("\n"), "palabras_clave");
  if (!campo || !mapa[campo]) { toast("Campo no válido"); return; }
  const op = await pedirTexto("Operación: escribe «antepos» (anteponer texto), «apos» (añadir al final) o «borrar» (vaciar el campo):", "apos");
  if (!op) return;
  const alcance = multiSel.size ? state.refs.filter(r => multiSel.has(r.id)) : visibles();
  if (!alcance.length) { toast("No hay referencias en el alcance"); return; }
  if (op === "borrar") {
    if (!confirm(`¿Vaciar el campo «${mapa[campo]}» de ${alcance.length} referencia(s)?`)) return;
    alcance.forEach(r => r[campo] = "");
    await save(); abrirRefresco();
    toast(`Campo «${mapa[campo]}» vaciado en ${alcance.length} referencia(s)`);
    return;
  }
  const texto = await pedirTexto("Texto a insertar:", "");
  if (!texto) return;
  alcance.forEach(r => r[campo] = op === "antepos" ? (texto + " " + (r[campo] || "")).trim() : ((r[campo] || "") + " " + texto).trim());
  await save(); abrirRefresco();
  toast(`Campo «${mapa[campo]}» actualizado en ${alcance.length} referencia(s)`);
}
// ====== EndNote 25: Ordenar la vista (múltiples campos) ======
async function ordenarVistaDlg() {
  const opciones = { "autores": "autor", "titulo": "titulo", "título": "titulo", "ano": "ano", "año": "ano", "fecha": "fecha", "revista": "revista", "tipo": "tipo", "palabras_clave": "palabras_clave", "etiquetas": "palabras_clave" };
  const nombreCampo = { autor: "autor", titulo: "título", ano: "año", fecha: "fecha de alta", revista: "revista", tipo: "tipo", palabras_clave: "etiquetas" };
  const c = await pedirTexto("Ordenar la vista por:\n  autores · titulo · ano · fecha · revista · tipo · palabras_clave", "fecha");
  if (!c || !opciones[c]) { toast("Campo no válido"); return; }
  const d = await pedirTexto("Dirección: «+» ascendente o «-» descendente:", "+");
  sortKey = opciones[c]; sortDir = d === "-" ? -1 : 1;
  abrirRefresco();
  toast(`Vista ordenada por ${nombreCampo[sortKey]}${d === "-" ? " (descendente)" : ""}`);
}
// ====== EndNote 25: Descarga masiva de PDFs de acceso abierto para la vista ======
async function descargarPdfsVista() {
  const pend = visibles().filter(r => !r.pdf && r.doi && !r.papelera);
  if (!pend.length) { toast("Ninguna referencia de la vista tiene DOI pendiente de PDF"); return; }
  let ok = 0; const manual = [];
  for (let i = 0; i < pend.length; i++) {
    const r = pend[i];
    toast(`Descargando PDFs en acceso abierto… ${i + 1}/${pend.length}`);
    try {
      const resp = await fetch(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(r.doi)}`);
      if (!resp.ok) throw new Error("no");
      const w = await resp.json();
      const oa = w.open_access?.oa_url || (w.primary_location?.pdf_url) || w.best_oa_location?.pdf_url;
      if (oa) {
        const pr = await fetch(oa);
        if (pr.ok) {
          const b = new Uint8Array(await pr.arrayBuffer());
          if (b[0] === 0x25 && b[1] === 0x50) { await api.savePdf(r.id, b.buffer); r.pdf = true; ok++; }
          else manual.push(r);
        } else manual.push(r);
      } else manual.push(r);
    } catch { manual.push(r); }
  }
  await save(); abrirRefresco();
  toast(`✅ ${ok} PDF(s) descargado(s) y adjuntado(s)${manual.length ? ` — ${manual.length} sin copia descargable (búscalos a mano)` : ""}`);
}
// ====== EndNote 25: al adjuntar un PDF, intenta extraer el DOI y completar metadatos ======
async function detectarDoiEnPdf(id) {
  try {
    const buf = await api.readPdf(id);
    if (!buf) return;
    const txt = new TextDecoder("latin1").decode(new Uint8Array(buf));
    const m = txt.match(/10\.\d{4,9}\/[^\s"'<>{}]{4,90}/);
    if (!m) return;
    const doi = m[0].replace(/[.,;]$/, "");
    const r = refById(id);
    if (!r || r.doi) return;
    if (confirm(`Se detectó el DOI «${doi}» dentro del PDF.\n¿Completar los metadatos de la referencia desde este DOI?`)) {
      r.doi = doi; await save(); selectedId = id; await actualizarDesdeDOI();
    }
  } catch { /* best effort */ }
}
/* ====== funciones ENDNOTE extra ====== */
// Ayuda del flujo Cite While You Write con Microsoft Word
function ayudaCWYW() {
  alert(`Cite While You Write — BioCiencia con Microsoft Word

1. En BioCiencia, selecciona la referencia y usa
   Referencias → «Copiar cita temporal para Word».
   Se copia un marcador de la forma  {García, 2020 #N}  — pégalo
   en tu documento de Word donde corresponda la cita.

2. Puedes pegar tantas citas temporales como necesites.
   El número #N identifica la referencia en tu biblioteca.

3. Al terminar el documento, guarda una copia como .txt
   (o guarda el .rtf tal cual) y en BioCiencia usa
   Herramientas → «Formatear documento de Word con citaciones temporales…»:
   cada marcador {…#N} se convierte en la cita definitiva
   del estilo seleccionado y se añade la bibliografía al final.

Consejo: conserva siempre el documento original sin formatear.`);
}
// Genera la bibliografía formateada de la vista actual (o de toda la biblioteca)
async function generarBibliografia() {
  let lista = scope.startsWith("online") ? [] : visibles().filter(limpio);
  if (!lista.length) lista = state.refs.filter(limpio);
  if (!lista.length) { toast("No hay referencias"); return; }
  const num = (estilo === "Elsevier" || estilo === "IEEE" || estilo === "Vancouver");
  const texto = lista.map((r, i) => (num ? `[${i + 1}] ` : "") + citar(r, estilo) + (num && r.doi && estilo !== "Elsevier" ? ` [Acceso: https://doi.org/${r.doi}]` : "")).join("\n\n");
  const titulo = `BIBLIOGRAFÍA — ${estilo} — ${lista.length} referencias — BioCiencia\n\n`;
  const copiaOk = await navigator.clipboard.writeText(titulo + texto).catch(() => false);
  const ruta = await api.saveFileAs({ defaultName: `bibliografia-${estilo.replace(/[^A-Za-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.txt`, filters: [{ name: "Texto", extensions: ["txt"] }] });
  if (ruta) {
    const ok = await api.writeFile(ruta, titulo + texto);
    toast(ok ? `Bibliografía (${lista.length}) guardada${copiaOk ? " y copiada al portapapeles" : ""}` : "Error al guardar");
  } else if (copiaOk) {
    toast(`Bibliografía de ${lista.length} referencias copiada al portapapeles (${estilo})`);
  }
}
// Buscar y reemplazar en toda la biblioteca (como Change Field / Find & Replace)
async function buscarYReemplazar() {
  const mapa = { titulo: "Título", autores: "Autores", revista: "Revista", editorial: "Editorial", direccion: "Lugar", palabras_clave: "Etiquetas", notas: "Notas", resumen: "Resumen", url: "URL" };
  const campo = await pedirTexto("Campo: " + Object.entries(mapa).map(([k, v]) => `${v} (${k})`).join(", "), "");
  if (!campo) return;
  if (!mapa[campo]) { toast("⚠️ Campo no válido"); return; }
  const buscar = await pedirTexto("Texto a buscar:", "");
  if (!buscar) return;
  const reemp = await pedirTexto("Reemplazar por:", "");
  if (reemp === null) return;
  const rx = new RegExp(buscar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  let n = 0, refs = 0;
  state.refs.filter(limpio).forEach(r => {
    const antes = r[campo];
    if (!antes) return;
    const desp = antes.replace(rx, reemp);
    if (desp !== antes) { refs++; n += (antes.match(rx) || []).length; r[campo] = desp; }
  });
  if (!refs) { toast("Sin coincidencias en «" + mapa[campo] + "»"); return; }
  if (!confirm(`Se reemplazará «${buscar}» por «${reemp}» en ${n} aparición(es) de ${refs} referencia(s).\n¿Continuar?`)) return;
  await save(); renderAll();
  toast(`${n} reemplazo(s) en ${refs} referencia(s)`);
}
// Marcar leído/no leído la referencia seleccionada
function toggleLeidoSel() {
  const r = refById(selectedId);
  if (!r) { toast("Selecciona una referencia primero"); return; }
  r.leido = !r.leido;
  save().then(() => { toast(r.leido ? "Marcada como leída" : "Marcada como no leída"); abrirRefresco(); });
}
// Consolida duplicados: conserva la más reciente de cada grupo
async function consolidarDuplicados() {
  const grupos = gruposDuplicados();
  if (!grupos.length) { toast("No hay duplicados"); return; }
  let n = 0;
  if (!confirm(`Se conservará la más reciente de cada grupo de duplicados y el resto irá a la papelera.\nGrupos: ${grupos.length}\n¿Continuar?`)) return;
  grupos.forEach(g => {
    const orden = g.slice().sort((x, y2) => String(y2.fecha).localeCompare(String(x.fecha)));
    orden.slice(1).forEach(r => { r.papelera = true; n++; });
  });
  await save(); abrirRefresco();
  toast(`${n} duplicado(s) enviados a la papelera`);
}
// Busca el PDF en acceso abierto a partir del DOI (OpenAlex → oa_url)
async function buscarPdfEnLinea(r) {
  if (!r.doi) { toast("Esta referencia no tiene DOI"); return; }
  toast("Buscando copia en acceso abierto…");
  try {
    const resp = await fetch(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(r.doi)}`);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const w = await resp.json();
    const oa = w.open_access?.oa_url || (w.primary_location?.pdf_url) || w.best_oa_location?.pdf_url || w.best_oa_location?.landing_page_url;
    if (oa) { window.open(oa, "_blank"); toast("Acceso abierto encontrado — descarga el PDF y usa «Adjuntar PDF…»"); }
    else toast("No hay copia de acceso abierto para este DOI");
  } catch (e) {
    toast("⚠️ Sin conexión o error de red");
  }
}

async function vaciarPapelera() {
  const n = state.refs.filter(r => r.papelera).length;
  if (!n) { toast("La papelera está vacía"); return; }
  if (!confirm(`¿Borrar definitivamente ${n} referencia(s) de la papelera?`)) return;
  for (const r of state.refs.filter(x => x.papelera)) await api.deletePdf(r.id);
  state.refs = state.refs.filter(x => !x.papelera);
  await save(); toast("Papelera vaciada"); abrirRefresco();
}

/* ============================ render general ============================ */
function renderTabs() {
  const tb = $("tabs");
  tb.innerHTML = "";
  openTabs.forEach(t => {
    const b = document.createElement("button");
    b.className = "tab" + (t.scope === scope ? " active" : "");
    b.innerHTML = `<span>${esc(t.label)}</span><span class="tx" title="Cerrar pestaña">✕</span>`;
    b.addEventListener("click", e => {
      if (e.target.classList.contains("tx")) { e.stopPropagation(); cierraTab(t.scope); return; }
      abreTab(t.scope);
    });
    tb.appendChild(b);
  });
  const plus = document.createElement("button");
  plus.className = "tab plus"; plus.title = "Nueva colección"; plus.textContent = "＋";
  plus.onclick = async () => {
    const nn = await pedirTexto("Nombre de la nueva colección:", "");
    if (!nn) return;
    if (state.grupos.some(g => normT(g.nombre) === normT(nn))) { toast("Ya existe una colección con ese nombre"); return; }
    const g = { id: uid(), nombre: nn };
    state.grupos.push(g);
    await save(); renderSidebar(); abreTab("col:" + g.id);
  };
  tb.appendChild(plus);
}
function renderAll() {
  $("search").value = $("search").value;
  renderSidebar(); renderTabs(); renderStage(); renderDetail(); updateTermLists();
}

/* ============================ menú y eventos ============================ */
/* Acciones sueltas reutilizadas por los menús y atajos */
function nuevaColeccionDlg() {
  return pedirTexto("Crear colección — nombre:", "").then(async nn => {
    if (!nn) return;
    if (state.grupos.some(g => normT(g.nombre) === normT(nn))) { toast("Ya existe una colección con ese nombre"); return; }
    const g = { id: uid(), nombre: nn };
    state.grupos.push(g);
    await save(); renderSidebar(); abreTab("col:" + g.id);
    toast(`Colección «${nn}» creada`);
  });
}
function nuevoSmartDlg() {
  return pedirTexto("Crear grupo inteligente — nombre:", "").then(nn => {
    if (!nn) return null;
    return pedirTexto("Consulta (palabra que deben contener título/autor/revista/etiquetas):", "").then(async q => {
      if (q === null) return;
      state.gruposInteligentes = state.gruposInteligentes || [];
      state.gruposInteligentes.push({ id: uid(), nombre: nn, consulta: q });
      await save(); renderSidebar(); abreTab("smart:" + state.gruposInteligentes[state.gruposInteligentes.length - 1].id);
    });
  });
}
function editarSeleccionada() {
  if (!selectedId) { toast("Selecciona una referencia primero"); return; }
  detailTab = "editar"; renderDetail();
}
function papeleraSeleccionada() {
  const r = refById(selectedId);
  if (!r) { toast("Selecciona una referencia primero"); return; }
  if (!confirm("¿Enviar a la papelera?\n" + (r.titulo || ""))) return;
  r.papelera = true;
  save().then(() => { selectedId = null; toast("Enviada a la papelera"); abrirRefresco(); });
}
async function descargarCitaSel() {
  const r = refById(selectedId);
  if (!r) { toast("Selecciona una referencia primero"); return; }
  const nombre = `cita-${(r.ano || "nd")}-${(r.titulo || "ref").slice(0, 24).replace(/[^\w]+/g, "-")}.txt`;
  const ruta = await api.saveFileAs({ defaultName: nombre, filters: [{ name: "Texto", extensions: ["txt"] }] });
  if (ruta) { await api.writeFile(ruta, citar(r, estilo)); toast("Cita guardada"); }
}
async function renombrarEtiqueta() {
  const vieja = await pedirTexto("Etiqueta a renombrar (se aplica a toda la biblioteca):", "");
  if (!vieja) return;
  const nueva = await pedirTexto(`Nuevo nombre para «${vieja}»:`, vieja);
  if (!nueva) return;
  let n = 0;
  state.refs.forEach(r => {
    const lista = parseAutores(r.palabras_clave);
    const nuevaLista = lista.map(t => {
      if (normT(t) === normT(vieja)) { n++; return nueva; }
      return t;
    });
    r.palabras_clave = nuevaLista.join("; ");
  });
  if (!n) { toast("Esa etiqueta no existe"); return; }
  await save(); renderAll();
  toast(`Etiqueta renombrada en ${n} referencia(s)`);
}
async function eliminarEtiqueta() {
  const vieja = await pedirTexto("Etiqueta a eliminar (de todas las referencias):", "");
  if (!vieja) return;
  let n = 0;
  state.refs.forEach(r => {
    const lista = parseAutores(r.palabras_clave).filter(t => normT(t) !== normT(vieja));
    if (lista.length !== parseAutores(r.palabras_clave).length) { n++; r.palabras_clave = lista.join("; "); }
  });
  if (!n) { toast("Esa etiqueta no existe"); return; }
  await save(); renderAll();
  toast(`Etiqueta quitada de ${n} referencia(s)`);
}
function abrirBusquedaAvanzada() { $("adv-panel").classList.add("open"); }
function cambiarTema() {
  document.body.classList.toggle("dark");
  localStorage.setItem("bio-dark", document.body.classList.contains("dark") ? "1" : "0");
}
async function resumenBiblioteca() {
  const vivas = state.refs.filter(limpio).length;
  const pdfs = state.refs.filter(r => limpio(r) && r.pdf).length;
  const pap = state.refs.filter(r => r.papelera).length;
  const cols = state.grupos.length;
  const tags = new Set(state.refs.filter(limpio).flatMap(r => parseAutores(r.palabras_clave))).size;
  alert("BioCiencia — Resumen de la biblioteca\n\n" +
    `Referencias: ${vivas}\nColecciones: ${cols}\nEtiquetas distintas: ${tags}\nCon PDF adjunto: ${pdfs}\nEn la papelera: ${pap}\n\nBiblioteca guardada solo en esta máquina.`);
}
async function acerca() {
  const dir = await api.dataDir();
  alert("BioCiencia — Gestor de referencias\n\n" +
    "¿Qué es un gestor de referencias?\n" +
    "Un programa que guarda, organiza y cita tus fuentes bibliográficas\n" +
    "(artículos, libros, tesis, conferencias…). Sustituye las fichas de papel\n" +
    "y evita escribir las citas a mano.\n\n" +
    "Qué hace BioCiencia:\n" +
    "• Guarda tus referencias y las organiza en colecciones y etiquetas.\n" +
    "• Adjunta los PDF de tus trabajos y los abren al instante.\n" +
    "• Importa y exporta RIS / BibTeX (EndNote, Zotero, Mendeley, Google Scholar).\n" +
    "• Busca por DOI y en línea (OpenAlex, Crossref, PubMed).\n" +
    "• Genera citas y bibliografías en APA, MLA, Chicago, IEEE, Vancouver, Harvard.\n" +
    "• Todo se guarda solo en esta máquina: sin cuentas ni nube.\n\n" +
    "Carpeta de datos:\n" + dir);
}
function atajosAyuda() {
  alert("Atajos de teclado\n\n" +
    "Ctrl+N — Nueva referencia\nCtrl+F — Buscar en la biblioteca\nCtrl+I — Importar RIS\nCtrl+Alt+F — Búsqueda avanzada\n" +
    "Ctrl+E — Editar referencia seleccionada\nCtrl+K — Copiar cita formateada\nCtrl+D — Enviar a la papelera\nCtrl+R — Buscar y reemplazar en la biblioteca\n\n" +
    "En la lista: clic abre · Ctrl+clic añade a la selección · Shift+clic rango ·\n" +
    "clic en “Clasf.” sube la clasificación (1–5); las no leídas van en negrita.");
}
/* Estructura de menús (estilo EndNote) */
let MENUS = null;
function construirMenus() {
  MENUS = [
    { t: "Archivo", items: [
      { l: "Importar RIS… (EndNote, Zotero, Mendeley…)", k: "Ctrl+I", a: () => importar("ris") },
      { l: "Importar BibTeX…", a: () => importar("bib") },
      { sep: true },
      { l: "Exportar RIS…", a: () => exportar("ris") },
      { l: "Exportar BibTeX…", a: () => exportar("bib") },
      { l: "Respaldo de la biblioteca (JSON)…", a: () => exportar("json") },
      { sep: true },
      { l: "Imprimir la vista…", k: "Ctrl+P", a: imprimirVista },
      { sep: true },
      { l: "Terminar BioCiencia", a: () => window.close() }
    ]},
    { t: "Editar", items: [
      { l: "Buscar en la biblioteca", k: "Ctrl+F", a: () => $("search").focus() },
      { l: "Búsqueda avanzada", k: "Ctrl+Alt+F", a: abrirBusquedaAvanzada },
      { sep: true },
      { l: "Copiar cita formateada", k: "Ctrl+K", a: copiarCitaSel },
      { l: "Editar referencia", k: "Ctrl+E", a: editarSeleccionada },
      { l: "Mover a la papelera", k: "Ctrl+D", a: papeleraSeleccionada }
    ]},
    { t: "Referencias", items: [
      { l: "Nueva referencia…", k: "Ctrl+N", a: () => abrirModal(null) },
      { l: "Añadir por DOI…", a: addPorDOI },
      { sep: true },
      { l: "Actualizar metadatos desde DOI…", a: actualizarDesdeDOI },
      { l: "Descargar PDFs de la vista (acceso abierto)…", a: descargarPdfsVista },
      { l: "Adjuntar PDF…", a: () => { if (!selectedId) { toast("Selecciona una referencia primero"); return; } detailTab = "pdf"; renderDetail(); } },
      { l: "Copiar cita temporal para Word {Autor, Año #N}", a: copiarCitaTemporal },
      { l: "Descargar cita…", a: descargarCitaSel },
      { l: "Enviar por correo…", a: correoReferencia },
      { sep: true },
      { l: "Marcar como leída / no leída", a: toggleLeidoSel },
      { l: "Generar bibliografía de la vista…", a: generarBibliografia },
      { sep: true },
      { l: "Buscar duplicados", a: () => abreTab("dupes") }
    ]},
    { t: "Grupos", items: [
      { l: "Crear colección…", a: nuevaColeccionDlg },
      { l: "Crear grupo inteligente…", a: nuevoSmartDlg },
      { sep: true },
      { l: "Crear set de colecciones…", a: crearSetColecciones },
      { l: "Mover la colección abierta a un set…", a: moverColASet },
      { l: "Quitar la colección abierta de su set", a: quitarColDeSet }
    ]},
    { t: "Etiquetas", items: [
      { l: "Renombrar etiqueta… (toda la biblioteca)", a: renombrarEtiqueta },
      { l: "Eliminar etiqueta… (de todas las referencias)", a: eliminarEtiqueta },
      { sep: true },
      { l: "Filtrar por etiqueta en la barra lateral", a: () => toast("Haz clic en una etiqueta ◉ de la barra lateral") }
    ]},
    { t: "Biblioteca", items: [
      { l: "Búsqueda avanzada", k: "Ctrl+Alt+F", a: abrirBusquedaAvanzada },
      { l: "Buscar duplicados", a: () => abreTab("dupes") },
      { l: "Consolidar duplicados automáticamente…", a: consolidarDuplicados },
      { sep: true },
      { l: "Buscar y reemplazar…", k: "Ctrl+R", a: buscarYReemplazar },
      { l: "Cambiar campos de la selección / vista…", a: cambiarCampos },
      { sep: true },
      { l: "Ordenar la vista…", a: ordenarVistaDlg },
      { l: "Gestionar listas de términos…", a: gestionarTerminos },
      { sep: true },
      { st: "Columnas visibles" },
      { l: (colPrefs.clip ? "✓ " : "") + "Columna: PDF adjunto", a: () => toggleCol("clip") },
      { l: (colPrefs.rating ? "✓ " : "") + "Columna: Clasificación", a: () => toggleCol("rating") },
      { l: (colPrefs.autor ? "✓ " : "") + "Columna: Autor", a: () => toggleCol("autor") },
      { l: (colPrefs.ano ? "✓ " : "") + "Columna: Año", a: () => toggleCol("ano") },
      { l: (colPrefs.tipo ? "✓ " : "") + "Columna: Tipo", a: () => toggleCol("tipo") },
      { l: (colPrefs.etiquetas ? "✓ " : "") + "Columna: Etiquetas", a: () => toggleCol("etiquetas") },
      { sep: true },
      { l: "Resumen de la biblioteca", a: resumenBiblioteca },
      { l: "Vaciar papelera…", a: vaciarPapelera },
      { sep: true },
      { l: "Respaldo de la biblioteca (JSON)…", a: () => exportar("json") },
      { l: "Restaurar respaldo (JSON)…", a: restaurarRespaldo }
    ]},
    { t: "Herramientas", items: [
      { st: "Estilo de salida" },
      ...ESTILOS.map(e => ({ l: (e === estilo ? "✓ " : "") + e, a: () => { estilo = e; localStorage.setItem("bio-estilo", estilo); construirMenus(); toast("Estilo de citación: " + e); } })),
      { sep: true },
      { l: "Matcher de manuscrito (sugerir revista)…", a: sugerirRevista },
      { l: "Comprobar retractaciones / correcciones", a: comprobarRetraccionSel },
      { l: "Formatear documento de Word con citaciones temporales…", a: formatearDocumento },
      { sep: true },
      { l: "Buscar en línea — OpenAlex", a: () => abreTab("online:openalex") },
      { l: "Buscar en línea — Crossref", a: () => abreTab("online:crossref") },
      { l: "Buscar en línea — PubMed (NLM)", a: () => abreTab("online:pubmed") },
      { sep: true },
      { l: "Cambiar tema claro / oscuro", a: cambiarTema }
    ]},
    { t: "Ventana", items: [
      { l: "Pantalla completa — F11", a: togglePantallaCompleta },
      { l: "Refrescar la vista — F5", a: abrirRefresco },
      { l: (panelDetalles ? "✓ " : "") + "Mostrar / ocultar panel de resumen — F9", a: togglePanelDetalles },
      { sep: true },
      { l: "Búsqueda en línea — OpenAlex", a: () => abreTab("online:openalex") }
    ]},
    { t: "Ayuda", items: [
      { l: "Atajos de teclado…", a: atajosAyuda },
      { l: "Cite While You Write — usar BioCiencia con Microsoft Word…", a: ayudaCWYW },
      { l: "Importar por arrastre: suelta un .ris/.bib aquí", a: () => toast("Arrastra un archivo .ris o .bib descargado a cualquier zona") },
      { sep: true },
      { l: "Acerca de BioCiencia…", a: acerca }
    ]}
  ];
}
function renderMenus() {
  construirMenus();
  $("menubar").querySelectorAll(".mb-item").forEach(n => n.remove());
  MENUS.forEach(m => {
    const d = document.createElement("div"); d.className = "mb-item";
    const b = document.createElement("button"); b.className = "mb-btn"; b.textContent = m.t;
    const pop = document.createElement("div"); pop.className = "mb-pop";
    m.items.forEach(it => {
      if (it.sep) { pop.appendChild(document.createElement("hr")); return; }
      if (it.st) {
        const s = document.createElement("div"); s.className = "st-sec"; s.textContent = it.st;
        pop.appendChild(s); return;
      }
      const btn = document.createElement("button");
      btn.style.display = "flex";
      btn.innerHTML = `<span>${esc(it.l)}</span>${it.k ? `<span class="mi-key">${it.k}</span>` : ""}`;
      btn.onclick = () => { document.querySelectorAll(".mb-item.open").forEach(x => x.classList.remove("open")); it.a(); };
      pop.appendChild(btn);
    });
    b.addEventListener("click", e => {
      e.stopPropagation();
      const abierto = d.classList.contains("open");
      document.querySelectorAll(".mb-item.open").forEach(x => x.classList.remove("open"));
      if (!abierto) d.classList.add("open");
    });
    d.appendChild(b); d.appendChild(pop);
    $("menubar").appendChild(d);
  });
}
function wire() {
  document.addEventListener("click", () => document.querySelectorAll(".mb-item.open").forEach(x => x.classList.remove("open")));
  // secciones plegables
  ["sec-col", "sec-tags", "sec-online"].forEach(id => {
    const sec = $(id);
    const lista = sec.nextElementSibling;
    sec.addEventListener("click", e => {
      if (e.target.dataset.plus) return;
      sec.classList.toggle("closed");
      lista.classList.toggle("closed");
    });
  });
  document.querySelectorAll("[data-plus]").forEach(p => p.addEventListener("click", async e => {
    e.stopPropagation();
    const nn = await pedirTexto("Nombre de la nueva colección:", "");
    if (!nn) return;
    state.grupos.push({ id: uid(), nombre: nn });
    await save(); renderSidebar();
    toast(`Colección «${nn}» creada`);
  }));
  // navegación y filtro de colecciones
  document.querySelectorAll("#sb-nav .sb-i").forEach(b => b.addEventListener("click", () => abreTab(b.dataset.scope)));
  document.querySelectorAll("[data-online]").forEach(b => b.addEventListener("click", () => abreTab("online:" + b.dataset.online)));
  $("sb-group-filter").addEventListener("input", renderSidebar);
  $("search").addEventListener("input", renderStage);
  $("btn-adv").addEventListener("click", () => $("adv-panel").classList.toggle("open"));
  $("adv-ok").addEventListener("click", () => {
    ["titulo", "autor", "revista", "doi", "tag", "de", "hasta", "tipo"].forEach(k => ADV[k] = $("adv-" + k).value.trim());
    renderStage();
  });
  $("adv-clear").addEventListener("click", () => {
    ["titulo", "autor", "revista", "doi", "tag", "de", "hasta", "tipo"].forEach(k => { ADV[k] = ""; $("adv-" + k).value = ""; });
    renderStage();
  });
  $("btn-cancel").addEventListener("click", () => $("modal-backdrop").classList.remove("open"));
  $("btn-save").addEventListener("click", guardarModal);
  $("modal-backdrop").addEventListener("mousedown", e => { if (e.target.id === "modal-backdrop") $("modal-backdrop").classList.remove("open"); });
  $("terms-close").addEventListener("click", () => $("modal-terms").classList.remove("open"));
  $("modal-terms").addEventListener("mousedown", e => { if (e.target.id === "modal-terms") $("modal-terms").classList.remove("open"); });
  const qcampo = $("q-campo");
  if (qcampo) qcampo.onchange = () => abrirRefresco();
  // atajos
  document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key.toLowerCase() === "n") { e.preventDefault(); abrirModal(null); }
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "f") { e.preventDefault(); abrirBusquedaAvanzada(); }
    else if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === "f") { e.preventDefault(); $("search").focus(); }
    if (e.ctrlKey && e.key.toLowerCase() === "i") { e.preventDefault(); importar("ris"); }
    if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === "e") { e.preventDefault(); editarSeleccionada(); }
    if (e.ctrlKey && e.key.toLowerCase() === "k") { e.preventDefault(); copiarCitaSel(); }
    if (e.ctrlKey && e.key.toLowerCase() === "d") { e.preventDefault(); papeleraSeleccionada(); }
    if (e.ctrlKey && e.key.toLowerCase() === "r") { e.preventDefault(); buscarYReemplazar(); }
    if (e.ctrlKey && e.key.toLowerCase() === "p") { e.preventDefault(); imprimirVista(); }
    if (e.key === "F11") { e.preventDefault(); togglePantallaCompleta(); }
    if (e.key === "F5") { e.preventDefault(); abrirRefresco(); }
    if (e.key === "F9") { e.preventDefault(); togglePanelDetalles(); }
    if (e.key === "Escape") {
      $("modal-backdrop").classList.remove("open");
      $("prompt-backdrop").classList.remove("open");
      $("modal-terms").classList.remove("open");
    }
    // navegación de la tabla con las flechas (↑/↓), como EndNote
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (scope.startsWith("online")) return;
      const lista = visibles();
      if (!lista.length) return;
      e.preventDefault();
      const i = lista.findIndex(x => x.id === selectedId);
      const ni = Math.max(0, Math.min(lista.length - 1, i < 0 ? 0 : i + (e.key === "ArrowDown" ? 1 : -1)));
      selectedId = lista[ni].id; detailTab = "resumen";
      if (!lista[ni].leido) { lista[ni].leido = true; save().catch(() => {}); }
      multiSel.clear(); multiSelAncla = ni;
      renderStage(); renderDetail();
    }
  });
}
async function importarRapido() {
  const f = await pedirTexto("Formato del archivo: escribe «ris» o «bib»", "ris");
  if (!f) return;
  const fmt = f.toLowerCase();
  if (fmt === "ris" || fmt === "bib") importar(fmt);
  else toast("⚠️ Escribe ris o bib");
}
async function exportarRapido() {
  const f = await pedirTexto("Formato de exportación: escribe «ris», «bib» o «json»", "ris");
  if (!f) return;
  const fmt = f.toLowerCase();
  if (fmt === "ris" || fmt === "bib" || fmt === "json") exportar(fmt);
  else toast("⚠️ Escribe ris, bib o json");
}

/* ============================ arranque ============================ */
(async function init() {
  // doble clic en archivo .ris/.bib descargado → importar automáticamente
  api.onArchivoAbierto && api.onArchivoAbierto(datos => {
    importarArchivoSuelto(datos).catch(e => { console.error("[import falló]", e); toast("⚠️ Error al importar: " + (e && e.message || e)); });
  });
  // arrastrar y soltar archivos .ris / .bib para importarlos
  ["dragover", "dragenter"].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); }));
  document.addEventListener("drop", async e => {
    e.preventDefault();
    const archivos = [...(e.dataTransfer?.files || [])].filter(f => /\.(ris|bib|txt)$/i.test(f.name));
    if (!archivos.length) return;
    for (const f of archivos) {
      try { await importarArchivoSuelto({ ruta: f.name, contenido: await f.text() }); }
      catch (err) { toast("⚠️ Error al importar " + f.name); }
    }
  });
  const lib = await api.loadLibrary();
  if (lib && Array.isArray(lib.refs)) state = Object.assign({ grupos: [], gruposInteligentes: [], sets: [], refs: [] }, lib);
  state.sets = Array.isArray(state.sets) ? state.sets : [];
  for (const g of state.gruposInteligentes || []) void g;
  state.refs.forEach(r => {
    r.grupos = r.grupos || [];
    r.papelera = !!r.papelera;
    if (typeof r.pdf !== "boolean") r.pdf = !!r.pdf;
    if (typeof r.leido !== "boolean") r.leido = !!r.leido;
    r.rating = +r.rating || 0;
  });
  if (localStorage.getItem("bio-dark") === "1") document.body.classList.add("dark");
  wire();
  renderMenus();
  abreTab("todas");
  api.dataDir().then(dir => { $("sb-status").textContent = "Biblioteca local — " + dir.split(/[\\/]/).pop(); });
})();
