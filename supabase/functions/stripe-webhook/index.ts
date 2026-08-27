// Webhook Stripe — JEDYNE miejsce, w ktorym przyznawany jest platny dostep.
//
// verify_jwt musi byc WYLACZONE: Stripe nie zna tokenow Supabase. Zamiast tego
// autoryzacja opiera sie na podpisie HMAC z naglowka Stripe-Signature, weryfikowanym
// sekretem STRIPE_WEBHOOK_SECRET. Bez tej weryfikacji kazdy moglby wyslac tu POST-a
// i odblokowac sobie dostep za darmo — dlatego zadanie bez poprawnego podpisu
// konczy sie 400 i niczego nie zapisuje.
//
// Sekrety (ustawiane w Supabase, NIE w repo):
//   STRIPE_WEBHOOK_SECRET — whsec_... z konfiguracji endpointu w Stripe

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Stripe podpisuje `timestamp.body`. Okno akceptacji chroni przed powtorzeniem
// przechwyconego, poprawnie podpisanego zadania po czasie (replay).
const TOLERANCJA_S = 5 * 60;

function rownoCzasowo(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function podpisOk(surowe: string, naglowek: string): Promise<boolean> {
  if (!naglowek || !WEBHOOK_SECRET) return false;
  const pola = naglowek.split(",").map((p) => p.trim());
  const t = pola.find((p) => p.startsWith("t="))?.slice(2) ?? "";
  const wiek = Math.abs(Date.now() / 1000 - Number(t));
  if (!t || !Number.isFinite(wiek) || wiek > TOLERANCJA_S) return false;

  const klucz = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", klucz, new TextEncoder().encode(`${t}.${surowe}`));
  const oczekiwany = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // przy rotacji sekretu Stripe wysyla kilka v1= naraz — wystarczy jedno trafienie
  const podane = pola.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return podane.some((p) => rownoCzasowo(p, oczekiwany));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Tylko POST", { status: 405 });
  if (!WEBHOOK_SECRET) {
    console.error("Brak STRIPE_WEBHOOK_SECRET — odrzucam wszystko");
    return new Response("Brak konfiguracji", { status: 500 });
  }

  // surowe cialo, bajt w bajt: kazda zmiana (np. JSON.parse + stringify) psuje podpis
  const surowe = await req.text();
  if (!(await podpisOk(surowe, req.headers.get("Stripe-Signature") ?? ""))) {
    console.warn("Odrzucono zadanie z nieprawidlowym podpisem");
    return new Response("Zly podpis", { status: 400 });
  }

  let zdarzenie: any;
  try {
    zdarzenie = JSON.parse(surowe);
  } catch {
    return new Response("Zle JSON", { status: 400 });
  }

  // Interesuje nas tylko oplacony checkout. Reszta typow ma dostac 200,
  // inaczej Stripe uzna endpoint za zepsuty i zacznie ponawiac w kolko.
  if (zdarzenie?.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ pominieto: zdarzenie?.type }), { status: 200 });
  }

  const s = zdarzenie.data?.object ?? {};
  if (s.payment_status !== "paid") {
    return new Response(JSON.stringify({ pominieto: "nieoplacone" }), { status: 200 });
  }

  const userId = s.client_reference_id || s.metadata?.user_id;
  if (!userId) {
    console.error("Sesja bez user_id:", s.id);
    return new Response(JSON.stringify({ blad: "brak user_id" }), { status: 200 });
  }

  // Podwojna wplata za to samo konto zdarza sie przy dwoch rownoleglych sesjach.
  // Dostep i tak jest jeden, ale trzeba to zobaczyc w logach, zeby zwrocic pieniadze.
  const istnieje = await fetch(
    `${SUPABASE_URL}/rest/v1/entitlements?select=stripe_session_id&user_id=eq.${userId}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  ).then((r) => (r.ok ? r.json() : []))
   .catch(() => []);
  if (Array.isArray(istnieje) && istnieje.length && istnieje[0].stripe_session_id !== s.id) {
    console.warn(`UWAGA: ${userId} zaplacil ponownie (sesja ${s.id}) — rozwaz zwrot`);
    return new Response(JSON.stringify({ pominieto: "juz ma dostep" }), { status: 200 });
  }

  const zapis = await fetch(`${SUPABASE_URL}/rest/v1/entitlements`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      user_id: userId,
      source: "stripe",
      stripe_session_id: s.id,
      amount_minor: s.amount_total ?? null,
      currency: s.currency ?? null,
    }),
  });

  if (!zapis.ok) {
    // 500 = Stripe ponowi. Lepsze niz ciche zgubienie oplaconego dostepu.
    const tresc = await zapis.text().catch(() => "");
    console.error("Nie zapisano dostepu:", zapis.status, tresc);
    return new Response("Blad zapisu", { status: 500 });
  }

  console.log(`Przyznano dostep: ${userId} (sesja ${s.id})`);
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
