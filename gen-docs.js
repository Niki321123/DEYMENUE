// Generuje podstrony regulaminu i polityki prywatnosci z plikow .md do docs/.
// Uruchamianie: node gen-docs.js  (wolane automatycznie przez publish.js)
//
// Tresc trzymamy WYLACZNIE w .md — HTML jest z nich odtwarzany przy kazdej publikacji,
// wiec obie wersje nie moga sie rozjechac. Recznej edycji plikow docs/*.html nie rob:
// zostana nadpisane.
//
// Strony sa samodzielne (bez zaleznosci zewnetrznych) i uzywaja tej samej palety
// co aplikacja, razem z trybem ciemnym wedlug ustawienia systemu.
const fs = require("fs");
const path = require("path");
const root = __dirname;

const STRONY = [
  { zrodlo: "REGULAMIN.md", cel: "regulamin.html", tytul: "Regulamin — Day Menu",
    opis: "Regulamin korzystania z Day Menu: zasady zakładania konta, dostęp do funkcji płatnych, prawo odstąpienia i reklamacje." },
  { zrodlo: "PRIVACY.md", cel: "prywatnosc.html", tytul: "Polityka prywatności — Day Menu",
    opis: "Jakie dane zbiera Day Menu, po co, jak długo je przechowuje i jakie prawa przysługują Ci wobec swoich danych." },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Zamiana wewnetrznych odnosnikow miedzy dokumentami na adresy podstron.
const LINKI = { "PRIVACY.md": "prywatnosc.html", "REGULAMIN.md": "regulamin.html" };

/* Minimalny konwerter Markdown. Obsluguje dokladnie to, czego uzywaja nasze dwa
   dokumenty: naglowki, akapity, listy, tabele, cytaty, pogrubienia, kod i odnosniki.
   Nie jest to pelny parser i nie ma nim byc — mniej kodu znaczy mniej miejsc na blad. */
function inline(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, tekst, adres) =>
      `<a href="${LINKI[adres] || adres}">${tekst}</a>`)
    .replace(/&lt;(https?:\/\/[^&\s]+)&gt;/g, '<a href="$1">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/(^|[\s(])_([^_]+)_/g, "$1<em>$2</em>");
}

function md2html(md) {
  const linie = md.split(/\r?\n/);
  const out = [];
  let akapit = [], lista = null, tabela = null, cytat = [], punkt = null;

  const zamknijAkapit = () => { if (akapit.length) { out.push(`<p>${inline(akapit.join(" "))}</p>`); akapit = []; } };
  /* Punkt listy skladamy z SUROWYCH linii i konwertujemy dopiero przy zamknieciu.
     Konwersja linia po linii gubi pogrubienie rozbite na dwie linie w zrodle
     (`**Stripe Payments Europe,` / `Ltd.**`), bo zadna polowka nie pasuje do wzorca. */
  const zamknijPunkt = () => { if (punkt) { out.push(`<li>${inline(punkt.join(" "))}</li>`); punkt = null; } };
  const zamknijListe = () => { zamknijPunkt(); if (lista) { out.push(`</${lista}>`); lista = null; } };
  const zamknijCytat = () => { if (cytat.length) { out.push(`<blockquote>${inline(cytat.join(" "))}</blockquote>`); cytat = []; } };
  const zamknijTabele = () => {
    if (!tabela) return;
    const [glowa, ...reszta] = tabela;
    out.push("<div class='tabela'><table><thead><tr>" +
      glowa.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>" +
      reszta.map((w) => "<tr>" + w.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
      "</tbody></table></div>");
    tabela = null;
  };
  const zamknijWszystko = () => { zamknijAkapit(); zamknijListe(); zamknijTabele(); zamknijCytat(); };

  for (const l of linie) {
    const t = l.trim();

    if (!t) { zamknijWszystko(); continue; }
    if (/^---+$/.test(t)) { zamknijWszystko(); out.push("<hr>"); continue; }

    const nag = t.match(/^(#{1,4})\s+(.*)$/);
    if (nag) { zamknijWszystko(); const p = nag[1].length; out.push(`<h${p}>${inline(nag[2])}</h${p}>`); continue; }

    if (t.startsWith(">")) { zamknijAkapit(); zamknijListe(); zamknijTabele(); cytat.push(t.replace(/^>\s?/, "")); continue; }

    // tabela: wiersz z pionowymi kreskami; linia oddzielajaca (---|---) jest pomijana
    if (t.startsWith("|") && t.endsWith("|")) {
      zamknijAkapit(); zamknijListe(); zamknijCytat();
      const kom = t.slice(1, -1).split("|").map((c) => c.trim());
      if (kom.every((c) => /^:?-{2,}:?$/.test(c))) continue;
      (tabela = tabela || []).push(kom);
      continue;
    }
    zamknijTabele();

    const li = t.match(/^([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      zamknijAkapit(); zamknijCytat();
      const typ = /^\d/.test(li[1]) ? "ol" : "ul";
      if (lista !== typ) { zamknijListe(); out.push(`<${typ}>`); lista = typ; }
      zamknijPunkt();
      punkt = [li[2]];
      continue;
    }
    // kontynuacja punktu listy (wciecie w zrodle) dokleja sie do biezacego punktu
    if (punkt) { punkt.push(t); continue; }

    zamknijListe(); zamknijCytat();
    akapit.push(t);
  }
  zamknijWszystko();
  return out.join("\n");
}

const STYL = `
:root{--bg:#f6f7f9;--surface:#fff;--surface-2:#eef0f4;--border:#e2e5ea;--text:#1b1f27;
--text-2:#5b6472;--text-3:#9099a6;--primary:#4f63d2;--primary-soft:#e8ebfb;--radius:12px;
--shadow:0 1px 3px rgba(20,24,33,.07),0 4px 16px rgba(20,24,33,.05)}
@media(prefers-color-scheme:dark){:root{--bg:#14161c;--surface:#1d2029;--surface-2:#262a35;
--border:#323744;--text:#eceef2;--text-2:#a7aeba;--text-3:#6e7685;--primary:#7b8cf0;
--primary-soft:#2a3052;--shadow:0 1px 3px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.25)}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.6;
color:var(--text);background:var(--bg);padding:24px 16px 64px}
.strona{max-width:760px;margin:0 auto}
.gora{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.znak{width:34px;height:34px;flex:none}
.marka{font-weight:700;font-size:18px}
.powrot{margin-left:auto;font-size:13px;color:var(--primary);text-decoration:none;
border:1px solid var(--border);background:var(--surface);padding:6px 12px;border-radius:8px}
.powrot:hover{background:var(--surface-2)}
.karta{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
box-shadow:var(--shadow);padding:28px 32px}
h1{font-size:28px;line-height:1.25;margin-bottom:16px}
h2{font-size:20px;margin:32px 0 10px;padding-top:4px}
h3{font-size:16px;margin:20px 0 8px}
h2:first-of-type{margin-top:20px}
p,ul,ol,blockquote,.tabela{margin-bottom:12px}
ul,ol{padding-left:22px}
li{margin-bottom:6px}
a{color:var(--primary)}
code{background:var(--surface-2);padding:1px 5px;border-radius:4px;font-size:13px}
hr{border:none;border-top:1px solid var(--border);margin:28px 0}
blockquote{border-left:3px solid var(--primary);background:var(--primary-soft);
padding:12px 16px;border-radius:0 8px 8px 0;color:var(--text)}
em{color:var(--text-2)}
.tabela{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{border:1px solid var(--border);padding:8px 10px;text-align:left;vertical-align:top}
th{background:var(--surface-2);font-weight:600}
.stopka{margin-top:24px;text-align:center;color:var(--text-3);font-size:13px}
.stopka a{color:var(--text-3)}
@media(max-width:600px){.karta{padding:20px 18px}h1{font-size:23px}body{padding:16px 12px 48px}}
`;

const ZNAK = `<svg class="znak" xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 106 106" aria-hidden="true"><rect x="0" y="11.7" width="100" height="88.3" rx="13.5" fill="#2b3950"/><rect x="19.2" y="-2.5" width="14.8" height="29.7" rx="7.4" fill="#fff"/><rect x="66" y="-2.5" width="14.8" height="29.7" rx="7.4" fill="#fff"/><rect x="21.7" y="0" width="9.8" height="24.5" rx="4.9" fill="#2b3950"/><rect x="68.5" y="0" width="9.8" height="24.5" rx="4.9" fill="#2b3950"/><rect x="11.5" y="31.9" width="77" height="62.8" rx="7.5" fill="#fff"/><rect x="15.9" y="44.9" width="28.7" height="6" rx="3" fill="#4a80d4"/><rect x="15.9" y="60.8" width="28.7" height="6" rx="3" fill="#4a9d52"/><rect x="15.9" y="75.7" width="28.7" height="6" rx="3" fill="#7069e6"/><path d="M51.1 64.9 64.1 74.5 82.6 53.2" fill="none" stroke="#2b3950" stroke-width="7.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

let ile = 0;
for (const s of STRONY) {
  const md = fs.readFileSync(path.join(root, s.zrodlo), "utf8");
  const html = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${s.tytul}</title>
<meta name="description" content="${s.opis}">
<link rel="canonical" href="https://daymenu.pl/${s.cel}">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#2b3950">
<link rel="apple-touch-icon" href="/icon-180.png">
<style>${STYL}</style>
</head>
<body>
<div class="strona">
  <div class="gora">${ZNAK}<span class="marka">Day Menu</span>
    <a class="powrot" href="/app.html">← Wróć do aplikacji</a></div>
  <div class="karta">
${md2html(md)}
  </div>
  <p class="stopka"><a href="/regulamin.html">Regulamin</a> · <a href="/prywatnosc.html">Polityka prywatności</a> · <a href="/">daymenu.pl</a></p>
</div>
</body>
</html>
`;
  fs.writeFileSync(path.join(root, "docs", s.cel), html);
  console.log(`docs/${s.cel} — ${(html.length / 1024).toFixed(1)} kB`);
  ile++;
}
console.log(`Wygenerowano ${ile} podstrony z plikow .md`);

// ---- mapa strony i robots.txt ----
// Wyszukiwarki znajduja strone same, ale mapa mowi im wprost, ktore adresy sa wazne
// i kiedy naprawde sie zmienily. Date bierzemy z pliku zrodlowego, a nie z dnia publikacji:
// inaczej kazdy build zglaszalby regulamin jako zmieniony, choc nikt go nie tknal.
const dzien = (plik) => fs.statSync(path.join(root, plik)).mtime.toISOString().slice(0, 10);
const ADRESY = [
  { loc: "https://daymenu.pl/", zrodlo: "DayMenu.html", waga: "1.0", czesto: "weekly" },
  { loc: "https://daymenu.pl/regulamin.html", zrodlo: "REGULAMIN.md", waga: "0.3", czesto: "yearly" },
  { loc: "https://daymenu.pl/prywatnosc.html", zrodlo: "PRIVACY.md", waga: "0.3", czesto: "yearly" },
];
const mapa = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${ADRESY.map((a) => `  <url>
    <loc>${a.loc}</loc>
    <lastmod>${dzien(a.zrodlo)}</lastmod>
    <changefreq>${a.czesto}</changefreq>
    <priority>${a.waga}</priority>
  </url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(root, "docs", "sitemap.xml"), mapa);
// app.html celowo poza mapa: to ten sam dokument co "/", wskazany juz jako kanoniczny.
fs.writeFileSync(path.join(root, "docs", "robots.txt"),
  "User-agent: *\nAllow: /\n\nSitemap: https://daymenu.pl/sitemap.xml\n");
console.log("docs/sitemap.xml i docs/robots.txt");
