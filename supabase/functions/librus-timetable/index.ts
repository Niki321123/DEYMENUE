// Monitor planu lekcji i zapowiedzi sprawdzianow z Librus Synergia.
//
// Odtwarza flow biblioteki `librusapi` (github.com/ravensiris/librusapi) w Deno:
// logowanie OAuth na api.librus.pl -> cookie DZIENNIKSID -> POST przegladaj_plan_lekcji.
// Pythona uzyc sie nie da (Edge Runtime to Deno), wiec logika jest przepisana 1:1.
// W tej samej sesji logowania pobieramy tez terminarz (sprawdziany, kartkowki itp.),
// zrealizowane lekcje (frekwencja) i oceny (srednia wazona).
//
// Wywolywane co godzine przez pg_cron. Nigdy nie rzuca wyjatkiem na zewnatrz —
// blad ladnie laduje w librus_snapshot.last_error / .exams_error / .attendance_error /
// .grades_error i w logach.

import { DOMParser, type Element } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const UA = "Mozilla/5.0 (Windows NT x.y; Win64; x64; rv:10.0) Gecko/20100101 Firefox/10.0";
const API_BASE = "https://api.librus.pl/";
const HANDSHAKE = `${API_BASE}OAuth/Authorization?client_id=46&response_type=code&scope=mydata`;
const AUTHORIZE = `${API_BASE}OAuth/Authorization?client_id=46`;
const INDEX_URL = "https://synergia.librus.pl/uczen/index";
const TIMETABLE_URL = "https://synergia.librus.pl/przegladaj_plan_lekcji";

// Rate-limit: nie odpytujemy Librusa czesciej niz raz na godzine.
// 59 min, a nie 60, zeby jitter crona nie gubil co drugiego przebiegu.
const MIN_INTERVAL_MS = 59 * 60 * 1000;

// Limit wall-clock Edge Function to ~150 s na CALY przebieg (wszystkie konta), a Librus
// potrafi odpowiadac wolno albo wcale. Bez tych budzetow jedna zawieszona podstrona
// zabija przebieg w polowie i nie zapisujemy NICZEGO.
const REQ_TIMEOUT_MS = 20 * 1000;  // jedno zapytanie do Librusa
const RUN_BUDGET_MS = 95 * 1000;   // caly przebieg jednego konta
const EXAMS_MIN_MS = 35 * 1000;    // terminarz (do 45 podstron) startuje tylko z zapasem

// CORS — bez tego przegladarka blokuje odpowiedz na POST z Authorization
// (preflight OPTIONS bez naglowkow CORS = fetch() w kliencie rzuca "Blad sieci").
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-librus-key",
};

class LibrusError extends Error {
  constructor(msg: string, readonly kind: string) {
    super(msg);
  }
}
const authError = (m: string) => new LibrusError(m, "auth");
const sessionError = (m: string) => new LibrusError(m, "session");
const structureError = (m: string) => new LibrusError(m, "structure");

/* ------------------------------ HTTP + cookies ------------------------------ */

/** Plaski cookie jar. Deno fetch nie trzyma ciasteczek, a DZIENNIKSID pojawia
 *  sie dopiero w trakcie przekierowan miedzy api.librus.pl a synergia.librus.pl. */
class Jar {
  private jar = new Map<string, string>();
  absorb(res: Response) {
    for (const raw of res.headers.getSetCookie()) {
      const pair = raw.split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > 0) this.jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }
  header() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  get(name: string) {
    return this.jar.get(name);
  }
}

/** fetch z recznym sledzeniem przekierowan, zbierajacy cookies na kazdym hopie. */
async function hop(jar: Jar, url: string, init: RequestInit = {}, max = 10): Promise<Response> {
  let target = url;
  let opts = init;
  for (let i = 0; i <= max; i++) {
    const cookie = jar.header();
    const res = await fetch(target, {
      ...opts,
      redirect: "manual",
      // Bez signal jedna wiszaca odpowiedz Librusa zjada caly wall-clock funkcji.
      signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
      headers: {
        "User-Agent": UA,
        ...(opts.headers ?? {}),
        ...(cookie ? { cookie } : {}),
      },
    });
    jar.absorb(res);
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      target = new URL(loc, target).toString();
      opts = { method: "GET" }; // po redirectcie gubimy metode i body, jak przegladarka
      continue;
    }
    return res;
  }
  throw new LibrusError("Zbyt wiele przekierowan z Librusa", "structure");
}

/* --------------------------------- logowanie -------------------------------- */

async function librusLogin(user: string, pass: string): Promise<Jar> {
  const jar = new Jar();
  await hop(jar, HANDSHAKE);

  const res = await hop(jar, AUTHORIZE, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ action: "login", login: user, pass }),
  });

  let json: Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    throw authError("Librus nie zwrocil JSON-a przy logowaniu (zly login/haslo?)");
  }

  if (json.status === "error") {
    const errs = (json.errors as { message?: string }[] | undefined) ?? [];
    throw authError(errs.map((e) => e.message).filter(Boolean).join("; ") || "Blad logowania");
  }
  if (!json.goTo) throw authError("Brak 'goTo' w odpowiedzi Librusa");

  await hop(jar, new URL(String(json.goTo), API_BASE).toString());
  await hop(jar, INDEX_URL);

  if (!jar.get("DZIENNIKSID")) throw authError("Nie dostalismy cookie DZIENNIKSID");
  return jar;
}

/* ------------------------------- plan lekcji -------------------------------- */

export interface Unit {
  date: string; // YYYY-MM-DD
  from: string; // HH:MM
  to: string;
  name: string;
  teacher: string;
  classroom: string | null;
  info: string | null;
}

/** Poniedzialek i niedziela (YYYY-MM-DD) tygodnia zawierajacego `ymd`. */
function weekMonSun(ymd: string): { mon: string; sun: string } {
  const d = new Date(`${ymd}T00:00:00Z`);
  const mondayOffset = (d.getUTCDay() + 6) % 7;
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() - mondayOffset);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return { mon: fmt(mon), sun: fmt(sun) };
}
/** "YYYY-MM-DD_YYYY-MM-DD" — poniedzialek..niedziela tygodnia zawierajacego `ymd`. */
function weekRange(ymd: string): string {
  const { mon, sun } = weekMonSun(ymd);
  return `${mon}_${sun}`;
}

function warsawToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseTimetable(html: string): Unit[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw structureError("Nie udalo sie sparsowac HTML planu lekcji");

  const h2 = doc.querySelector("h2");
  if (h2 && /^brak dost[eę]pu$/i.test(h2.textContent.trim())) {
    throw sessionError("Sesja Librusa wygasla lub token odrzucony (Brak dostępu)");
  }

  const boxes = doc.querySelectorAll('td[id="timetableEntryBox"]');

  // Pusty tydzien (ferie) jest legalny — ale brak calej tabeli planu oznacza,
  // ze Librus przebudowal strone i nasz parser jest do wyrzucenia.
  if (boxes.length === 0 && !doc.querySelector("table.decorated, .plan-lekcji")) {
    throw structureError("Nie znaleziono tabeli planu lekcji — Librus zmienil strukture strony");
  }

  const units: Unit[] = [];
  for (const node of boxes) {
    const td = node as unknown as Element;
    const text = td.querySelector("div.text");
    if (!text) continue; // wolne okienko

    const infoEl = td.querySelector("div.plan-lekcji-info");
    const info = infoEl ? infoEl.textContent.trim() || null : null;
    // info bywa zagniezdzone w div.text — usuwamy, zeby nie zasmiecilo nazwy/nauczyciela
    text.querySelector("div.plan-lekcji-info")?.remove();

    const parts = text.textContent.split("\n").map((s) => s.trim()).filter(Boolean);
    if (parts.length < 1) continue;
    const name = parts[0];
    const rest = parts[1] ?? "";

    let teacher = rest;
    let classroom: string | null = null;
    const sep = rest.indexOf(" s. ");
    if (sep >= 0) {
      teacher = rest.slice(0, sep);
      classroom = rest.slice(sep + 4).trim() || null;
    }
    teacher = teacher.replace(/^[-–\s]+/, "").trim();

    const date = td.getAttribute("data-date");
    const from = td.getAttribute("data-time_from");
    const to = td.getAttribute("data-time_to");
    if (!date || !from || !to) {
      throw structureError("Brak atrybutow data-date/data-time_* — Librus zmienil strukture strony");
    }
    units.push({ date, from, to, name, teacher, classroom, info });
  }
  return units;
}

async function fetchTimetable(jar: Jar, week: string): Promise<Unit[]> {
  const res = await hop(jar, TIMETABLE_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ tydzien: week }),
  });
  if (res.status === 401 || res.status === 403) throw sessionError("Librus odrzucil sesje");
  if (!res.ok) throw new LibrusError(`Librus zwrocil HTTP ${res.status}`, "http");
  return parseTimetable(await res.text());
}

/* ------------------- frekwencja: zrealizowane lekcje ------------------- */
// Endpoint i uklad tabeli wg biblioteki referencyjnej librus-apix (zrealizowane_lekcje) —
// ta sama strona co uczen widzi w Librusie jako "Zrealizowane lekcje": per-lekcja
// przedmiot/nauczyciel/temat + symbol obecnosci (pusty = obecny, kod = wyjatek).
// Jedna strona = do 15 lekcji, paginacja jak w terminarzu wielostronicowym.

const COMPLETED_LESSONS_URL = "https://synergia.librus.pl/zrealizowane_lekcje";
const MAX_COMPLETED_PAGES = 15; // bezpiecznik: 15 stron x 15 lekcji = 225, z naddatkiem na tydzien

export interface CompletedLesson {
  date: string;      // YYYY-MM-DD
  weekday: string;
  lessonNumber: number;
  subject: string;
  teacher: string;
  topic: string;
  attendance: string; // "" = obecny; kod (nb/u/sp/zw/...) = wyjatek
}

function normPolishDate(s: string): string {
  const m = s.trim().match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function parseCompletedLessonsPage(html: string): { lessons: CompletedLesson[]; maxPage: number } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw structureError("Nie udalo sie sparsowac strony zrealizowanych lekcji");

  const h2 = doc.querySelector("h2");
  if (h2 && /^brak dost[eę]pu$/i.test(h2.textContent.trim())) {
    throw sessionError("Sesja Librusa wygasla lub token odrzucony (Brak dostępu)");
  }

  let maxPage = 1;
  const pag = doc.querySelector("div.pagination > span");
  if (pag) {
    const m = pag.textContent.replace(/ /g, "").match(/z(\d+)/);
    if (m) maxPage = parseInt(m[1], 10) || 1;
  }

  const rows = doc.querySelectorAll("table.decorated tbody tr");
  // Brak tabeli/wierszy przy istniejacej stronie = zwyczajnie pusty tydzien (wakacje,
  // ferie) — to nie jest bezpiecznik jak przy planie lekcji, bo tu nie nadpisujemy
  // niczego bezpowrotnie, tylko doliczamy do licznika.
  const lessons: CompletedLesson[] = [];
  for (const node of rows) {
    const tr = node as unknown as Element;
    const dateCell = tr.querySelector('td[class="center small"]');
    const weekdayCell = tr.querySelector("td.tiny");
    const cells: string[] = [];
    for (const c of tr.querySelectorAll("td")) {
      const el = c as unknown as Element;
      if (!el.getAttribute("class")) cells.push(el.textContent.trim());
    }
    if (cells.length < 5) continue; // nie wiersz danych (np. naglowek) — pomijamy
    const [lessonNumberRaw, subjectTeacher, topic, , attendance] = cells;
    const parts = subjectTeacher.split(",").map((s) => s.trim());
    lessons.push({
      date: normPolishDate(dateCell ? dateCell.textContent : ""),
      weekday: weekdayCell ? weekdayCell.textContent.trim() : "",
      lessonNumber: parseInt(lessonNumberRaw, 10) || 0,
      subject: parts[0] || "",
      teacher: parts.length > 1 ? parts.slice(1).join(", ") : parts[0] || "",
      topic: topic || "",
      attendance: (attendance || "").trim(),
    });
  }
  return { lessons, maxPage };
}

async function fetchCompletedLessons(jar: Jar, dateFrom: string, dateTo: string, deadline = Infinity): Promise<CompletedLesson[]> {
  const body = (page: number) => new URLSearchParams({
    data1: dateFrom, data2: dateTo,
    filtruj_id_przedmiotu: "-1",
    numer_strony1001: String(page),
    porcjowanie_pojemnik1001: "1001",
  });
  const res0 = await hop(jar, COMPLETED_LESSONS_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body(0),
  });
  if (res0.status === 401 || res0.status === 403) throw sessionError("Librus odrzucil sesje");
  if (!res0.ok) throw new LibrusError(`Librus zwrocil HTTP ${res0.status}`, "http");
  const first = parseCompletedLessonsPage(await res0.text());
  const all = [...first.lessons];
  const pages = Math.min(first.maxPage, MAX_COMPLETED_PAGES);
  for (let p = 1; p < pages; p++) {
    if (Date.now() > deadline) break; // reszta stron dojdzie w nastepnym cronie
    const res = await hop(jar, COMPLETED_LESSONS_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body(p),
    });
    if (!res.ok) break;
    all.push(...parseCompletedLessonsPage(await res.text()).lessons);
  }
  return all;
}

/** Dolicza NOWE (jeszcze nie widziane) lekcje do kumulatywnych licznikow per przedmiot.
 *  Klucz "date|lessonNumber|subject" chroni przed powtornym zliczeniem tej samej lekcji
 *  przy kazdym godzinnym cronie w trakcie tygodnia. */
function accumulateAttendance(
  lessons: CompletedLesson[],
  prevFreq: Record<string, { present: number; absent: number; total: number }> | null,
  prevSeenKeys: string[] | null,
) {
  const freq = prevFreq && typeof prevFreq === "object" ? { ...prevFreq } : {};
  const seen = new Set(Array.isArray(prevSeenKeys) ? prevSeenKeys : []);
  for (const l of lessons) {
    if (!l.subject || !l.date) continue;
    const k = `${l.date}|${l.lessonNumber}|${l.subject}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const bucket = freq[l.subject] || (freq[l.subject] = { present: 0, absent: 0, total: 0 });
    bucket.total++;
    if (l.attendance) bucket.absent++; else bucket.present++;
  }
  return { freq, seenKeys: [...seen] };
}

/** Jak safeExams — blad frekwencji nie moze przewrocic synchronizacji planu/terminarza. */
async function safeAttendance(
  jar: Jar,
  weekDates: { mon: string; sun: string },
  prevFreq: Record<string, { present: number; absent: number; total: number }> | null,
  prevSeenKeys: string[] | null,
  deadline = Infinity,
) {
  try {
    const lessons = await fetchCompletedLessons(jar, weekDates.mon, weekDates.sun, deadline);
    const { freq, seenKeys } = accumulateAttendance(lessons, prevFreq, prevSeenKeys);
    return { lessons, freq, seenKeys, fetchedAt: new Date().toISOString(), error: null as string | null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[librus] frekwencja: ${msg}`);
    return {
      lessons: [] as CompletedLesson[],
      freq: prevFreq || {}, seenKeys: prevSeenKeys || [],
      fetchedAt: null as string | null, error: msg.slice(0, 500),
    };
  }
}

/* ----------------------------- oceny (srednia) -----------------------------
   Strona "Oceny" (przegladaj_oceny/uczen): tabela przedmiot -> komorki z ocenami,
   gdzie kazda ocena to <a title="..."> z tooltipem "Kategoria: ... Waga: ... Data: ...".
   Parser jest z zalozenia tolerancyjny — nie opiera sie na klasach CSS ani na
   kolejnosci kolumn (Librus zmienia je czesciej niz sam uklad tabeli): szuka
   linkow z tooltipem, a nazwe przedmiotu bierze z pierwszej tekstowej komorki
   wiersza. Kolumny ze srednimi Librusa lapiemy osobno (avgCells) jako liczby. */

const GRADES_URL = "https://synergia.librus.pl/przegladaj_oceny/uczen";

export interface Grade {
  subject: string;
  raw: string;           // "4", "5+", "np"
  value: number | null;  // 4, 5.5 — null dla ocen nienumerycznych (np, bz, +, -)
  weight: number;        // waga z tooltipa, domyslnie 1
  category: string;
  date: string;          // YYYY-MM-DD albo ""
  counts: boolean;       // "Licz do sredniej: tak"
  semester: 1 | 2 | null;
}
export interface GradeSubject {
  avgCells: string[];    // srednie policzone przez Librusa (sem I / sem II / roczna)
}

/** Ocena -> liczba, wg domyslnej konfiguracji Librusa: "+" = +0,5, "-" = -0,25.
 *  Szkola moze miec inne wagi plusow, dlatego obok trzymamy tez srednie
 *  wyliczone przez samego Librusa (GradeSubject.avgCells). */
function gradeValue(raw: string): number | null {
  const m = raw.trim().match(/^([1-6])\s*([+-])?$/);
  if (!m) return null;
  const base = Number(m[1]);
  return m[2] === "+" ? base + 0.5 : m[2] === "-" ? base - 0.25 : base;
}

/** Tooltip oceny to HTML z <br> i wierszami "Etykieta: wartosc". */
function parseTooltip(title: string): Record<string, string> {
  const out: Record<string, string> = {};
  const flat = title.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "");
  for (const line of flat.split("\n")) {
    const t = line.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    const i = t.indexOf(":");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim().toLowerCase();
    const v = t.slice(i + 1).trim();
    if (k && v && !(k in out)) out[k] = v;
  }
  return out;
}

/** Semestr z daty oceny: wrzesien..styczen = I, luty..sierpien = II.
 *  Kolumny sem. I / sem. II w HTML-u sa nie do odczytania w sposob odporny na
 *  zmiany strony, a data w tooltipie jest. */
function semesterOf(ymd: string): 1 | 2 | null {
  const m = ymd.match(/^\d{4}-(\d{2})/);
  if (!m) return null;
  const mo = Number(m[1]);
  return mo >= 9 || mo === 1 ? 1 : 2;
}

function parseGrades(html: string): { grades: Grade[]; subjects: Record<string, GradeSubject> } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) throw structureError("Nie udalo sie sparsowac strony ocen");

  const h2 = doc.querySelector("h2");
  if (h2 && /^brak dost[eę]pu$/i.test(h2.textContent.trim())) {
    throw sessionError("Sesja Librusa wygasla lub token odrzucony (Brak dostępu)");
  }

  const grades: Grade[] = [];
  const subjects: Record<string, GradeSubject> = {};
  let lastSubject = "";

  for (const node of doc.querySelectorAll("table.decorated tr")) {
    const tr = node as unknown as Element;
    const tds = [...tr.querySelectorAll("td")] as unknown as Element[];
    if (tds.length < 2) continue;

    // Komorki z ocenami: te, ktore zawieraja link z tooltipem. Sprawdzamy atrybut
    // recznie, bo selektor obecnosci atrybutu ("a[title]") to za duze zaufanie
    // do silnika selektorow w deno_dom.
    const gradeCells: Element[] = [];
    const anchors: Element[] = [];
    for (const td of tds) {
      const found: Element[] = [];
      for (const a of td.querySelectorAll("a")) {
        const el = a as unknown as Element;
        if (el.getAttribute("title")) found.push(el);
      }
      if (found.length) { gradeCells.push(td); anchors.push(...found); }
    }

    // Nazwa przedmiotu: pierwsza komorka z tekstem, ktora nie jest liczba porzadkowa
    // ani komorka z ocenami. Wiersze-kontynuacje (puste) dziedzicza poprzedni przedmiot.
    let subject = "";
    const avgCells: string[] = [];
    for (const td of tds) {
      if (gradeCells.includes(td)) continue;
      const t = td.textContent.replace(/\s+/g, " ").trim();
      if (!t) continue;
      if (/^\d+[.,]\d+$/.test(t)) { avgCells.push(t.replace(",", ".")); continue; } // srednia Librusa
      if (/^\d+\.?$/.test(t)) continue;                                             // Lp.
      if (!subject) subject = t;
    }
    if (!anchors.length) continue;
    if (!subject) subject = lastSubject;
    if (!subject) continue;
    lastSubject = subject;

    const sub = subjects[subject] || (subjects[subject] = { avgCells: [] });
    for (const a of avgCells) if (!sub.avgCells.includes(a)) sub.avgCells.push(a);

    for (const a of anchors) {
      const raw = a.textContent.replace(/\s+/g, " ").trim();
      if (!raw || raw.length > 4) continue; // linki nawigacyjne, nie oceny
      const meta = parseTooltip(a.getAttribute("title") || "");
      const get = (...needles: string[]) => {
        for (const n of needles) for (const [k, v] of Object.entries(meta)) if (k.includes(n)) return v;
        return "";
      };
      const weight = parseFloat((get("waga") || "1").replace(",", ".")) || 1;
      const date = normDate(get("data", "dodano"));
      const licz = get("licz do średniej", "licz do sredniej", "licz do");
      grades.push({
        subject,
        raw,
        value: gradeValue(raw),
        weight,
        category: get("kategoria", "rodzaj"),
        date,
        counts: licz ? /tak|1/i.test(licz) : true,
        semester: semesterOf(date),
      });
    }
  }
  return { grades, subjects };
}

async function fetchGrades(jar: Jar) {
  const res = await hop(jar, GRADES_URL);
  if (res.status === 401 || res.status === 403) throw sessionError("Librus odrzucil sesje");
  if (!res.ok) throw new LibrusError(`Librus zwrocil HTTP ${res.status}`, "http");
  return parseGrades(await res.text());
}

/** Jak safeExams/safeAttendance — blad ocen nie moze przewrocic reszty synchronizacji.
 *  Pusta lista tam, gdzie wczesniej byly oceny, traktujemy jak zmiane strony
 *  (a nie jak wyczyszczenie dziennika) i zostawiamy poprzedni snapshot. */
async function safeGrades(
  jar: Jar,
  prevGrades: Grade[],
  prevSubjects: Record<string, GradeSubject> | null,
  prevFetchedAt: string | null,
) {
  const keepPrev = (error: string | null) => ({
    grades: prevGrades, subjects: prevSubjects || {}, fetchedAt: prevFetchedAt, error,
  });
  try {
    const { grades, subjects } = await fetchGrades(jar);
    if (!grades.length && prevGrades.length) {
      return keepPrev("structure: brak ocen mimo wczesniej pobranych");
    }
    return { grades, subjects, fetchedAt: new Date().toISOString(), error: null as string | null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[librus] oceny: ${msg}`);
    return keepPrev(msg.slice(0, 500));
  }
}

/* ------------------- terminarz: sprawdziany i kartkowki -------------------- */

const TERMINARZ_URL = "https://synergia.librus.pl/terminarz";
// Kazde wydarzenie w terminarzu linkuje do wlasnej strony szczegolow, a wariantow
// sciezki jest kilka (szczegoly, szczegoly_wydarzenia, szczegoly_sprawdzianu...).
// Lapiemy je regexem po calym HTML zamiast parsowac siatke kalendarza: numer dnia
// w komorce i klasy CSS Librus zmienia znacznie czesciej niz te adresy, a i tak
// pelna date bierzemy ze strony szczegolow.
const EVENT_LINK_RE = /terminarz\/(szczegoly[a-z_]*)\/(\d+)/gi;
const MAX_EVENT_DETAILS = 45;   // bezpiecznik na dlugosc przebiegu
const EVENT_CONCURRENCY = 4;
const EXAM_RE =
  /sprawdzian|kartk[oó]wk|praca klasowa|klas[oó]wk|\btest|dyktando|wypracowan|egzamin|pr[oó]bn|odpowied[zź]|recytacj|referat/i;

export interface Exam {
  id: string;
  path: string;
  date: string;        // YYYY-MM-DD, "" gdy nie udalo sie odczytac
  time: string | null;
  type: string;        // "Sprawdzian" / "Kartkówka" / ...
  subject: string;
  teacher: string;
  desc: string;
  exam: boolean;       // sprawdzian/kartkowka, a nie zwykle wydarzenie klasowe
}

/** Strony szczegolow w Librusie to tabelki etykieta->wartosc. Czytamy je generycznie
 *  (th+td albo dwa td), wiec zmiana nazw klas CSS nic nam nie robi. */
function parseDetail(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return out;
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  for (const row of doc.querySelectorAll("tr")) {
    const tr = row as unknown as Element;
    const th = tr.querySelector("th");
    const tds = [...tr.querySelectorAll("td")] as unknown as Element[];
    let label = "", value = "";
    if (th && tds.length >= 1) { label = clean(th.textContent); value = clean(tds[0].textContent); }
    else if (tds.length === 2) { label = clean(tds[0].textContent); value = clean(tds[1].textContent); }
    label = label.replace(/:\s*$/, "").toLowerCase();
    if (label && value && !(label in out)) out[label] = value;
  }
  return out;
}

/** Pierwsza wartosc, ktorej etykieta zawiera ktorys z podanych fragmentow. */
function pick(map: Record<string, string>, ...needles: string[]): string {
  for (const n of needles) for (const [k, v] of Object.entries(map)) if (k.includes(n)) return v;
  return "";
}

function normDate(s: string): string {
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/); // 14.09.2026
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}
function normTime(s: string): string | null {
  const m = s.match(/\b(\d{1,2}):(\d{2})\b/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

async function fetchEventDetail(jar: Jar, path: string, id: string): Promise<Exam | null> {
  const res = await hop(jar, `${TERMINARZ_URL}/${path}/${id}`);
  if (!res.ok) return null;
  const map = parseDetail(await res.text());
  if (!Object.keys(map).length) return null;

  const type = pick(map, "rodzaj", "typ ", "kategoria") || (/sprawdzian/i.test(path) ? "Sprawdzian" : "");
  const subject = pick(map, "przedmiot");
  const teacher = pick(map, "nauczyciel", "prowadz", "dodał", "dodal");
  const desc = pick(map, "opis", "treść", "tresc", "temat", "informacj");
  const date = normDate(pick(map, "data", "termin", "dzień", "dzien"));
  const time = normTime(pick(map, "godzin", "czas")) ?? null;
  const hay = `${type} ${desc} ${path}`;

  return { id, path, date, time, type, subject, teacher, desc, exam: EXAM_RE.test(hay) };
}

async function fetchCalendarHtml(jar: Jar, year: number, month: number, current: boolean): Promise<string> {
  // Biezacy miesiac to zwykly GET. Dla kolejnego Librus oczekuje POST-a z miesiacem —
  // nazwy pol bywaly rozne miedzy wersjami, wiec wysylamy wszystkie znane naraz
  // (PHP ignoruje nadmiarowe). Jesli nawigacja nie zadziala, dostaniemy ten sam
  // miesiac co wyzej i po prostu zdeduplikujemy wydarzenia po id.
  const res = current
    ? await hop(jar, TERMINARZ_URL)
    : await hop(jar, TERMINARZ_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        rok: String(year),
        miesiac: String(month),
        dzien: "1",
        data: `${year}-${String(month).padStart(2, "0")}-01`,
      }),
    });
  return res.ok ? await res.text() : "";
}

/** Zapowiedzi z biezacego i nastepnego miesiaca. `truncated` = trafilismy w limit
 *  stron szczegolow (albo w deadline), wiec lista jest niepelna i nie wolno z niej
 *  wnioskowac o odwolanych sprawdzianach. */
async function fetchExams(jar: Jar, deadline = Infinity): Promise<{ exams: Exam[]; truncated: boolean }> {
  const [y, m] = warsawToday().split("-").map(Number);
  const months: [number, number][] = [[y, m], m === 12 ? [y + 1, 1] : [y, m + 1]];

  const found = new Map<string, string>(); // id -> path
  for (let i = 0; i < months.length; i++) {
    let html = "";
    try { html = await fetchCalendarHtml(jar, months[i][0], months[i][1], i === 0); } catch { continue; }
    for (const mt of html.matchAll(EVENT_LINK_RE)) if (!found.has(mt[2])) found.set(mt[2], mt[1]);
  }

  const entries = [...found];
  const truncated = entries.length > MAX_EVENT_DETAILS;
  const todo = entries.slice(0, MAX_EVENT_DETAILS);

  const exams: Exam[] = [];
  let next = 0;
  let ranOut = false;
  const worker = async () => {
    while (next < todo.length) {
      // Po deadline konczymy i oznaczamy liste jako urwana (truncated), zeby nikomu
      // nie wyslac "Odwolana zapowiedz" tylko dlatego, ze zabraklo czasu.
      if (Date.now() > deadline) { ranOut = true; return; }
      const [id, path] = todo[next++];
      // Jedno niedostepne wydarzenie nie moze przerwac pobierania reszty.
      try { const e = await fetchEventDetail(jar, path, id); if (e) exams.push(e); } catch { /* ignore */ }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(EVENT_CONCURRENCY, todo.length) }, worker),
  );
  exams.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return { exams, truncated: truncated || ranOut };
}

/* ----------------------------------- diff ----------------------------------- */

const DNI = ["pon", "wt", "śr", "czw", "pt", "sob", "ndz"];
const key = (u: Unit) => `${u.date}T${u.from}`;

function when(u: Unit) {
  const d = new Date(`${u.date}T00:00:00Z`);
  const dow = DNI[(d.getUTCDay() + 6) % 7];
  const [, m, day] = u.date.split("-");
  return `${dow} ${day}.${m}`;
}
const where = (u: Unit) => (u.classroom ? `s. ${u.classroom}` : "bez sali");
const cancelled = (u: Unit) => !!u.info && /odwoł|wolne od|nie odbęd/i.test(u.info);

/** Krotkie, czytelne komunikaty o roznicach miedzy dwoma wersjami planu. */
export function diff(prev: Unit[], next: Unit[]): string[] {
  const prevMap = new Map(prev.map((u) => [key(u), u]));
  const nextMap = new Map(next.map((u) => [key(u), u]));
  const msgs: string[] = [];

  const removed = prev.filter((u) => !nextMap.has(key(u)));
  const added = next.filter((u) => !prevMap.has(key(u)));

  // Ta sama lekcja tego samego dnia, inna godzina => przeniesiona, nie usunieta+dodana.
  const movedFrom = new Set<string>();
  const movedTo = new Set<string>();
  for (const r of removed) {
    const a = added.find(
      (x) => !movedTo.has(key(x)) && x.date === r.date && x.name === r.name,
    );
    if (!a) continue;
    movedFrom.add(key(r));
    movedTo.add(key(a));
    msgs.push(`Zmiana godziny: ${r.name}, ${when(r)}: ${r.from} → ${a.from}`);
  }

  for (const r of removed) {
    if (movedFrom.has(key(r))) continue;
    msgs.push(`Lekcja zniknęła z planu: ${r.name}, ${when(r)} ${r.from}`);
  }
  for (const a of added) {
    if (movedTo.has(key(a))) continue;
    msgs.push(
      cancelled(a)
        ? `Odwołane: ${a.name}, ${when(a)} ${a.from}`
        : `Nowa lekcja: ${a.name}, ${when(a)} ${a.from}, ${where(a)}`,
    );
  }

  for (const [k, a] of nextMap) {
    const b = prevMap.get(k);
    if (!b) continue;
    const at = `${a.name}, ${when(a)} ${a.from}`;
    if (!cancelled(b) && cancelled(a)) msgs.push(`Odwołane: ${at}`);
    else if (cancelled(b) && !cancelled(a)) msgs.push(`Lekcja znów się odbędzie: ${at}`);
    if (a.classroom !== b.classroom) msgs.push(`Zmiana sali: ${at}: ${where(b)} → ${where(a)}`);
    if (a.teacher !== b.teacher) msgs.push(`Zmiana nauczyciela: ${at}: ${b.teacher} → ${a.teacher}`);
    if (a.to !== b.to) msgs.push(`Zmiana końca lekcji: ${at}: ${b.to} → ${a.to}`);
  }
  return msgs;
}

/** Komunikaty o zmianach w zapowiedzianych sprawdzianach. Milczymy o wydarzeniach,
 *  ktore nie sa sprawdzianem, i o terminach, ktore juz minely. */
export function diffExams(prev: Exam[], next: Exam[], todayYmd: string, truncated = false): string[] {
  const prevMap = new Map(prev.map((e) => [e.id, e]));
  const nextMap = new Map(next.map((e) => [e.id, e]));
  const msgs: string[] = [];
  const ahead = (e: Exam) => !e.date || e.date >= todayYmd;
  const label = (e: Exam) => `${e.type || "Sprawdzian"}${e.subject ? ` — ${e.subject}` : ""}`;
  const whenExam = (d: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "termin nieznany";
    const dt = new Date(`${d}T00:00:00Z`);
    const [, mo, day] = d.split("-");
    return `${DNI[(dt.getUTCDay() + 6) % 7]} ${day}.${mo}`;
  };

  for (const e of next) {
    if (!e.exam || !ahead(e)) continue;
    const old = prevMap.get(e.id);
    if (!old) msgs.push(`Nowa zapowiedź: ${label(e)}, ${whenExam(e.date)}`);
    else if (old.date !== e.date) {
      msgs.push(`Zmiana terminu: ${label(e)}: ${whenExam(old.date)} → ${whenExam(e.date)}`);
    }
  }
  // Przy urwanej liscie brak wydarzenia nie znaczy, ze zostalo odwolane.
  if (!truncated) {
    for (const e of prev) {
      if (!e.exam || !ahead(e) || nextMap.has(e.id)) continue;
      msgs.push(`Odwołana zapowiedź: ${label(e)}, ${whenExam(e.date)}`);
    }
  }
  return msgs;
}

/* ---------------------------------- storage --------------------------------- */

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const svc = {
  apikey: SB_SERVICE,
  Authorization: `Bearer ${SB_SERVICE}`,
  "Content-Type": "application/json",
};

/* ---- szyfrowanie hasla Librusa (AES-GCM, klucz z sekretu LIBRUS_ENC_KEY) ----
   W bazie lezy tylko szyfrogram; klucz jest wylacznie w env funkcji, nie w Postgresie. */
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64 = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
let _key: CryptoKey | null = null;
async function encKey(): Promise<CryptoKey> {
  if (_key) return _key;
  const raw = unb64(Deno.env.get("LIBRUS_ENC_KEY")!);
  _key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  return _key;
}
async function encryptPass(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, await encKey(), new TextEncoder().encode(plain),
  );
  return { cipher: b64(ct), iv: b64(iv) };
}
async function decryptPass(cipher: string, iv: string) {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(iv) }, await encKey(), unb64(cipher),
  );
  return new TextDecoder().decode(pt);
}

/* ---- weryfikacja JWT uzytkownika -> user_id (funkcja ma verify_jwt=false) ---- */
async function userFromJwt(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  const r = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_ANON || SB_SERVICE, Authorization: authHeader },
  });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u?.id ?? null;
}

/* ---- storage per uzytkownik ---- */
async function loadSnapshot(userId: string) {
  const r = await fetch(`${SB_URL}/rest/v1/librus_snapshot?user_id=eq.${userId}&select=*`, { headers: svc });
  if (!r.ok) throw new Error(`snapshot read: HTTP ${r.status}`);
  return (await r.json())[0] ?? null;
}
async function saveSnapshot(userId: string, row: Record<string, unknown>) {
  const r = await fetch(`${SB_URL}/rest/v1/librus_snapshot`, {
    method: "POST",
    headers: { ...svc, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: userId, ...row }),
  });
  if (!r.ok) throw new Error(`snapshot write: HTTP ${r.status} ${await r.text()}`);
}
async function pushEvents(userId: string, messages: string[]) {
  if (!messages.length) return;
  const r = await fetch(`${SB_URL}/rest/v1/librus_events`, {
    method: "POST",
    headers: { ...svc, Prefer: "return=minimal" },
    body: JSON.stringify(messages.map((message) => ({ user_id: userId, message }))),
  });
  if (!r.ok) throw new Error(`events write: HTTP ${r.status} ${await r.text()}`);
}
async function accountError(userId: string, kind: string, message: string) {
  console.error(`[librus] user=${userId} ${kind}: ${message}`);
  await fetch(`${SB_URL}/rest/v1/librus_accounts?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...svc, Prefer: "return=minimal" },
    body: JSON.stringify({ status: kind, last_error: `${kind}: ${message}`, last_error_at: new Date().toISOString() }),
  }).catch(() => {});
}

/* ---------------------------------- handler --------------------------------- */

/** Pobiera zapowiedzi tak, zeby zaden blad terminarza nie przewrocil synchronizacji
 *  planu lekcji: przy awarii zostaje poprzednia lista, a powod laduje w exams_error. */
async function safeExams(jar: Jar, prevExams: Exam[], prevFetchedAt: string | null, deadline = Infinity) {
  const keepPrev = (error: string | null) => ({
    exams: prevExams, fetchedAt: prevFetchedAt, error, messages: [] as string[],
  });
  try {
    const { exams, truncated } = await fetchExams(jar, deadline);
    // Pusty terminarz tam, gdzie wczesniej byly zapowiedzi, to raczej zmiana strony
    // niz skasowanie wszystkiego — ten sam bezpiecznik co przy planie lekcji.
    if (!exams.length && prevExams.length) {
      return keepPrev("structure: pusty terminarz mimo wczesniejszych zapowiedzi");
    }
    return {
      exams,
      fetchedAt: new Date().toISOString(),
      error: null as string | null,
      messages: prevFetchedAt ? diffExams(prevExams, exams, warsawToday(), truncated) : [],
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[librus] terminarz: ${msg}`);
    return keepPrev(msg.slice(0, 500));
  }
}

async function processAccount(acc: { user_id: string; login: string; pass_cipher: string; pass_iv: string }, force: boolean) {
  const snap = await loadSnapshot(acc.user_id);
  // rate-limit per uzytkownik — max raz na godzine
  if (!force && snap?.fetched_at && Date.now() - new Date(snap.fetched_at).getTime() < MIN_INTERVAL_MS) {
    return { skipped: true };
  }
  const password = await decryptPass(acc.pass_cipher, acc.pass_iv);
  const week = weekRange(warsawToday());
  const deadline = Date.now() + RUN_BUDGET_MS;
  const jar = await librusLogin(acc.login, password);

  const prev: Unit[] = snap && snap.week === week ? (snap.units ?? []) : [];
  const firstRun = !snap || snap.week !== week;

  // Plan lekcji potrafi byc chwilowo niedostepny (wakacje, "Brak dostępu" na stronie
  // planu) — a to nie moze blokowac zbierania ocen i frekwencji, ktore siedza na
  // innych stronach Librusa. Dlatego blad planu tylko odklada plan na nastepny cron:
  // units zostaja nietkniete w snapshocie, reszta danych i tak sie zapisze.
  let units: Unit[] | null = null;
  let planError: string | null = null;
  try {
    units = await fetchTimetable(jar, week);
    // Bezpiecznik: pusty plan tam, gdzie wczesniej byly lekcje = podejrzana zmiana strony.
    if (units.length === 0 && prev.length > 0) {
      planError = "Pusty plan mimo wczesniejszych lekcji — snapshot nietkniety";
      units = null;
    }
  } catch (e) {
    planError = e instanceof Error ? e.message : String(e);
  }
  const messages: string[] = units && !firstRun ? diff(prev, units) : [];

  // Oceny — tania strona (jedno zapytanie), wiec leci zaraz po planie. Wlasny try/catch
  // i wlasne pole bledu (grades_error), jak przy terminarzu.
  const gr = await safeGrades(
    jar,
    Array.isArray(snap?.grades) ? (snap.grades as Grade[]) : [],
    (snap?.grades_subjects as Record<string, GradeSubject>) ?? null,
    snap?.grades_fetched_at ?? null,
  );

  // Frekwencja (zrealizowane lekcje biezacego tygodnia) — kilka podstron, wiec z deadline.
  const att = await safeAttendance(
    jar, weekMonSun(warsawToday()),
    (snap?.attendance_freq as Record<string, { present: number; absent: number; total: number }>) ?? null,
    (snap?.attendance_seen_keys as string[]) ?? null,
    deadline,
  );

  // Powiadomienia o planie wysylamy od razu — gdyby terminarz przekroczyl czas,
  // nie chcemy ich zgubic razem z przebiegiem.
  await pushEvents(acc.user_id, messages);

  // Zapis PRZED terminarzem: terminarz to do 45 podstron i najlatwiej na nim przekroczyc
  // wall-clock funkcji. Gdy nas ubija, oceny i frekwencja sa juz w bazie.
  await saveSnapshot(acc.user_id, {
    attendance_lessons: att.lessons, attendance_freq: att.freq, attendance_seen_keys: att.seenKeys,
    attendance_fetched_at: att.fetchedAt, attendance_error: att.error,
    grades: gr.grades, grades_subjects: gr.subjects,
    grades_fetched_at: gr.fetchedAt, grades_error: gr.error,
    // Plan tylko wtedy, gdy sie udal — fetched_at trzyma rate-limit, wiec przy bledzie
    // planu nie ruszamy go i nastepny cron probuje od nowa.
    ...(units
      ? { week, units, fetched_at: new Date().toISOString(), last_error: null, last_error_at: null }
      : {}),
  });

  // Zapowiedzi sprawdzianow na koniec — i tylko jesli zostal sensowny zapas czasu.
  const prevExams: Exam[] = Array.isArray(snap?.exams) ? snap.exams : [];
  const exams = Date.now() + EXAMS_MIN_MS < deadline
    ? await safeExams(jar, prevExams, snap?.exams_fetched_at ?? null, deadline)
    : {
      exams: prevExams, fetchedAt: snap?.exams_fetched_at ?? null,
      error: "skipped: zabraklo czasu w tym przebiegu", messages: [] as string[],
    };
  await pushEvents(acc.user_id, exams.messages);
  await saveSnapshot(acc.user_id, {
    exams: exams.exams, exams_fetched_at: exams.fetchedAt, exams_error: exams.error,
  });
  if (planError) {
    await accountError(acc.user_id, "plan", planError);
    return { error: true };
  }
  await fetch(`${SB_URL}/rest/v1/librus_accounts?user_id=eq.${acc.user_id}`, {
    method: "PATCH", headers: { ...svc, Prefer: "return=minimal" },
    body: JSON.stringify({ status: "ok", last_sync_at: new Date().toISOString(), last_error: null, last_error_at: null }),
  }).catch(() => {});
  return { changed: messages.length + exams.messages.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const ok = (body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const deny = (error: string, status: number) =>
    new Response(JSON.stringify({ ok: false, error }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const encReady = !!Deno.env.get("LIBRUS_ENC_KEY");

  /* ===== TRYB APKI: connect / disconnect (uwierzytelnienie JWT uzytkownika) ===== */
  let body: { action?: string; login?: string; password?: string } | null = null;
  if (req.method === "POST") { try { body = await req.clone().json(); } catch { /* nie-JSON = tryb cron */ } }

  if (body && (body.action === "connect" || body.action === "disconnect")) {
    if (!encReady) return deny("not_configured", 503);
    const userId = await userFromJwt(req.headers.get("Authorization"));
    if (!userId) return deny("unauthorized", 401); // user_id ZAWSZE z JWT, nigdy z body

    if (body.action === "disconnect") {
      await fetch(`${SB_URL}/rest/v1/librus_accounts?user_id=eq.${userId}`, { method: "DELETE", headers: svc }).catch(() => {});
      await fetch(`${SB_URL}/rest/v1/librus_snapshot?user_id=eq.${userId}`, { method: "DELETE", headers: svc }).catch(() => {});
      return ok({ ok: true, disconnected: true });
    }

    const loginName = String(body.login || "").trim();
    const password = String(body.password || "");
    if (!loginName || !password) return ok({ ok: false, error: "missing_fields" });

    // Zweryfikuj dane logujac sie do Librusa, dopiero potem zapisz (zaszyfrowane).
    let jar: Jar;
    try { jar = await librusLogin(loginName, password); }
    catch (e) { return ok({ ok: false, error: "librus_auth", detail: e instanceof Error ? e.message : String(e) }); }

    const { cipher, iv } = await encryptPass(password);
    const w = await fetch(`${SB_URL}/rest/v1/librus_accounts`, {
      method: "POST", headers: { ...svc, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: userId, login: loginName, pass_cipher: cipher, pass_iv: iv, status: "ok", last_error: null, last_error_at: null }),
    });
    if (!w.ok) return ok({ ok: false, error: "save_failed" });

    // Pierwsze pobranie od razu, zeby harmonogram wypelnil sie bez czekania na crona.
    try {
      const today = warsawToday();
      const week = weekRange(today);
      const deadline = Date.now() + RUN_BUDGET_MS;
      let units: Unit[] = [];
      try { units = await fetchTimetable(jar, week); } catch { /* plan dojdzie z cronem */ }
      const gr = await safeGrades(jar, [], null, null);
      const att = await safeAttendance(jar, weekMonSun(today), null, null, deadline); // pierwszy raz = od zera
      const exams = await safeExams(jar, [], null, deadline); // pierwszy raz = bez powiadomien
      await saveSnapshot(userId, {
        week, units, fetched_at: new Date().toISOString(), last_error: null, last_error_at: null,
        exams: exams.exams, exams_fetched_at: exams.fetchedAt, exams_error: exams.error,
        attendance_lessons: att.lessons, attendance_freq: att.freq, attendance_seen_keys: att.seenKeys,
        attendance_fetched_at: att.fetchedAt, attendance_error: att.error,
        grades: gr.grades, grades_subjects: gr.subjects,
        grades_fetched_at: gr.fetchedAt, grades_error: gr.error,
      });
      return ok({ ok: true, connected: true, units: units.length, exams: exams.exams.length, attendance: att.lessons.length, grades: gr.grades.length });
    } catch {
      return ok({ ok: true, connected: true, units: 0, warn: "first_fetch_failed" });
    }
  }

  /* ===== TRYB CRON: petla po wszystkich kontach (klucz w naglowku) =====
     Oczekiwany klucz czytamy z tabeli librus_cron_secret (RLS bez polityk =
     tylko service_role) — to samo zrodlo, z ktorego pg_cron bierze naglowek
     (zasiane z Vault), wiec nie ma jak sie rozjechac. Env LIBRUS_CRON_KEY
     zostaje jako fallback, gdyby tabela byla pusta. */
  let cronKey: string | null = null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/librus_cron_secret?select=key`, { headers: svc });
    if (r.ok) cronKey = ((await r.json())[0]?.key as string | undefined) ?? null;
  } catch { /* fallback nizej */ }
  if (!cronKey) cronKey = Deno.env.get("LIBRUS_CRON_KEY") ?? null;
  if (!cronKey || !encReady) return deny("not_configured", 503);
  if (req.headers.get("x-librus-key") !== cronKey) return deny("unauthorized", 401);
  const force = new URL(req.url).searchParams.get("force") === "1";

  let accounts: { user_id: string; login: string; pass_cipher: string; pass_iv: string }[] = [];
  try {
    const r = await fetch(`${SB_URL}/rest/v1/librus_accounts?select=user_id,login,pass_cipher,pass_iv`, { headers: svc });
    if (!r.ok) return ok({ ok: false, error: "accounts_read" });
    accounts = await r.json();
  } catch { return ok({ ok: false, error: "accounts_read" }); }

  let processed = 0, changed = 0, errors = 0, skipped = 0;
  for (const acc of accounts) {
    // Jeden padniety uzytkownik nie moze zatrzymac reszty.
    try {
      const res = await processAccount(acc, force);
      if (res.skipped) skipped++;
      else if (res.error) errors++;
      else { processed++; changed += res.changed ?? 0; }
    } catch (e) {
      const kind = e instanceof LibrusError ? e.kind : e instanceof TypeError ? "network" : "unknown";
      await accountError(acc.user_id, kind, e instanceof Error ? e.message : String(e));
      errors++;
    }
  }
  console.log(`[librus] cron accounts=${accounts.length} processed=${processed} changed=${changed} skipped=${skipped} errors=${errors}`);
  return ok({ ok: true, accounts: accounts.length, processed, changed, skipped, errors });
});
