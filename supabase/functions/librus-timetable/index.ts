// Monitor planu lekcji z Librus Synergia.
//
// Odtwarza flow biblioteki `librusapi` (github.com/ravensiris/librusapi) w Deno:
// logowanie OAuth na api.librus.pl -> cookie DZIENNIKSID -> POST przegladaj_plan_lekcji.
// Pythona uzyc sie nie da (Edge Runtime to Deno), wiec logika jest przepisana 1:1.
//
// Wywolywane co godzine przez pg_cron. Nigdy nie rzuca wyjatkiem na zewnatrz —
// blad ladnie laduje w librus_snapshot.last_error i w logach.

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

/** "YYYY-MM-DD_YYYY-MM-DD" — poniedzialek..niedziela tygodnia zawierajacego `ymd`. */
function weekRange(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  const mondayOffset = (d.getUTCDay() + 6) % 7;
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() - mondayOffset);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  const fmt = (x: Date) => x.toISOString().slice(0, 10);
  return `${fmt(mon)}_${fmt(sun)}`;
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

async function processAccount(acc: { user_id: string; login: string; pass_cipher: string; pass_iv: string }, force: boolean) {
  const snap = await loadSnapshot(acc.user_id);
  // rate-limit per uzytkownik — max raz na godzine
  if (!force && snap?.fetched_at && Date.now() - new Date(snap.fetched_at).getTime() < MIN_INTERVAL_MS) {
    return { skipped: true };
  }
  const password = await decryptPass(acc.pass_cipher, acc.pass_iv);
  const week = weekRange(warsawToday());
  const jar = await librusLogin(acc.login, password);
  const units = await fetchTimetable(jar, week);

  const prev: Unit[] = snap && snap.week === week ? (snap.units ?? []) : [];
  const firstRun = !snap || snap.week !== week;
  // Bezpiecznik: pusty plan tam, gdzie wczesniej byly lekcje = podejrzana zmiana strony.
  if (units.length === 0 && prev.length > 0) {
    await accountError(acc.user_id, "structure", "Pusty plan mimo wczesniejszych lekcji — snapshot nietkniety");
    return { error: true };
  }
  const messages = firstRun ? [] : diff(prev, units);
  await pushEvents(acc.user_id, messages);
  await saveSnapshot(acc.user_id, { week, units, fetched_at: new Date().toISOString(), last_error: null, last_error_at: null });
  await fetch(`${SB_URL}/rest/v1/librus_accounts?user_id=eq.${acc.user_id}`, {
    method: "PATCH", headers: { ...svc, Prefer: "return=minimal" },
    body: JSON.stringify({ status: "ok", last_sync_at: new Date().toISOString(), last_error: null, last_error_at: null }),
  }).catch(() => {});
  return { changed: messages.length };
}

Deno.serve(async (req) => {
  const ok = (body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
  const deny = (error: string, status: number) =>
    new Response(JSON.stringify({ ok: false, error }), { status, headers: { "Content-Type": "application/json" } });

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
      const week = weekRange(warsawToday());
      const units = await fetchTimetable(jar, week);
      await saveSnapshot(userId, { week, units, fetched_at: new Date().toISOString(), last_error: null, last_error_at: null });
      return ok({ ok: true, connected: true, units: units.length });
    } catch {
      return ok({ ok: true, connected: true, units: 0, warn: "first_fetch_failed" });
    }
  }

  /* ===== TRYB CRON: petla po wszystkich kontach (klucz w naglowku) ===== */
  const cronKey = Deno.env.get("LIBRUS_CRON_KEY");
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
