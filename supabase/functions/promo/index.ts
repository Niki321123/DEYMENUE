// Kody promocyjne: generowanie (tylko admin) i realizacja (kazdy zalogowany).
//
// Cala logika siedzi tutaj, a nie w kliencie, bo obie operacje pisza do tabel, do ktorych
// klient nie ma prawa zapisu. Gdyby sprawdzenie "czy admin" bylo w przegladarce, kazdy
// wygenerowalby sobie kod z konsoli — dlatego uprawnienie czytamy z bazy na service_role,
// na podstawie user_id wyciagnietego z TOKENU, nigdy z ciala zadania.
//
// Zadanie: POST {"akcja":"generuj","ile":1,"note":"dla Julo"} | {"akcja":"uzyj","kod":"DM-..."}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Alfabet bez znakow, ktore myla sie przy przepisywaniu z ekranu: 0/O, 1/I/L, 5/S, 8/B.
const ZNAKI = "ACDEFGHJKMNPQRTUVWXY2346789";
const MAX_NARAZ = 20;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const naglowkiSb = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

function nowyKod(): string {
  const los = crypto.getRandomValues(new Uint8Array(8));
  const czesc = (od: number) =>
    [...los.slice(od, od + 4)].map((b) => ZNAKI[b % ZNAKI.length]).join("");
  return `DM-${czesc(0)}-${czesc(4)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Tylko POST" }, 405);

  // 1. Kto dzwoni — wylacznie z tokenu.
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return json({ error: "Brak tokenu" }, 401);
  const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: SERVICE_KEY },
  });
  if (!uRes.ok) return json({ error: "Nieprawidlowy token" }, 401);
  const user = await uRes.json();
  if (!user?.id) return json({ error: "Nieprawidlowy token" }, 401);

  const body = await req.json().catch(() => ({}));
  const akcja = body?.akcja;

  /* ---------- generowanie: tylko admin ---------- */
  if (akcja === "generuj") {
    const aRes = await fetch(
      `${SUPABASE_URL}/rest/v1/app_admins?select=user_id&user_id=eq.${user.id}`,
      { headers: naglowkiSb },
    );
    const admini = aRes.ok ? await aRes.json() : [];
    if (!Array.isArray(admini) || !admini.length) {
      console.warn(`Proba generowania kodu bez uprawnien: ${user.id}`);
      return json({ error: "Brak uprawnien do generowania kodow" }, 403);
    }

    const ile = Math.min(Math.max(parseInt(body?.ile, 10) || 1, 1), MAX_NARAZ);
    const note = typeof body?.note === "string" ? body.note.slice(0, 120) : null;
    const wiersze = Array.from({ length: ile }, () => ({
      code: nowyKod(),
      created_by: user.id,
      note,
    }));

    const wRes = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes`, {
      method: "POST",
      headers: { ...naglowkiSb, Prefer: "return=representation" },
      body: JSON.stringify(wiersze),
    });
    if (!wRes.ok) {
      console.error("Nie zapisano kodow:", wRes.status, await wRes.text().catch(() => ""));
      return json({ error: "Nie udalo sie zapisac kodow" }, 500);
    }
    const zapisane = await wRes.json();
    return json({ kody: (zapisane ?? []).map((r: any) => r.code) });
  }

  /* ---------- realizacja: kazdy zalogowany ---------- */
  if (akcja === "uzyj") {
    const kod = String(body?.kod ?? "").trim().toUpperCase();
    if (!kod) return json({ error: "Podaj kod" }, 400);

    // Kto juz ma dostep, nie marnuje kodu.
    const eRes = await fetch(
      `${SUPABASE_URL}/rest/v1/entitlements?select=user_id&user_id=eq.${user.id}`,
      { headers: naglowkiSb },
    );
    const ma = eRes.ok ? await eRes.json() : [];
    if (Array.isArray(ma) && ma.length) return json({ juzOplacone: true });

    /* Oznaczenie kodu jako uzytego i sprawdzenie, czy byl wolny, to JEDNA instrukcja UPDATE
       z warunkiem `used_by is null`. Gdyby najpierw czytac, a potem pisac, dwie osoby
       wpisujace ten sam kod w tej samej chwili dostalyby dostep obie. */
    const pRes = await fetch(
      `${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(kod)}&used_by=is.null`,
      {
        method: "PATCH",
        headers: { ...naglowkiSb, Prefer: "return=representation" },
        body: JSON.stringify({ used_by: user.id, used_at: new Date().toISOString() }),
      },
    );
    if (!pRes.ok) {
      console.error("Blad przy realizacji kodu:", pRes.status, await pRes.text().catch(() => ""));
      return json({ error: "Nie udalo sie zrealizowac kodu" }, 500);
    }
    const zajete = await pRes.json();
    if (!Array.isArray(zajete) || !zajete.length) {
      return json({ error: "Kod nieprawidlowy albo juz wykorzystany" }, 400);
    }

    const dRes = await fetch(`${SUPABASE_URL}/rest/v1/entitlements`, {
      method: "POST",
      headers: { ...naglowkiSb, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: user.id, source: "promo" }),
    });
    if (!dRes.ok) {
      // Kod zostal juz spalony, a dostepu nie ma — oddajemy go, zeby nie przepadl.
      await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(kod)}`, {
        method: "PATCH",
        headers: naglowkiSb,
        body: JSON.stringify({ used_by: null, used_at: null }),
      }).catch(() => {});
      console.error("Nie przyznano dostepu z kodu:", dRes.status, await dRes.text().catch(() => ""));
      return json({ error: "Nie udalo sie przyznac dostepu" }, 500);
    }

    console.log(`Kod ${kod} zrealizowany przez ${user.id}`);
    return json({ ok: true });
  }

  return json({ error: "Nieznana akcja" }, 400);
});
