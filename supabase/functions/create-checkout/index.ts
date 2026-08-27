// Tworzy sesje Stripe Checkout na jednorazowa oplate za pelny dostep do Day Menu.
//
// Wywolywane z aplikacji przez zalogowanego uzytkownika (verify_jwt=true). Kwota i waluta
// SA USTALANE TU, na serwerze — gdyby przychodzily z klienta, kazdy kupilby dostep za grosz.
// Sam fakt oplacenia zapisuje dopiero webhook (stripe-webhook), nie ta funkcja: powrot
// na success_url to tylko przekierowanie przegladarki i mozna go wywolac recznie.
//
// Sekrety (ustawiane w Supabase, NIE w repo):
//   STRIPE_SECRET_KEY  — klucz sekretny Stripe (sk_test_... / sk_live_...)
//   DAYMENU_APP_URL    — opcjonalnie, adres powrotu; domyslnie wersja webowa

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("DAYMENU_APP_URL") ?? "https://niki321123.github.io/DEYMENUE/app.html";

// Cena w groszach. Zmiana ceny = zmiana tej jednej liczby (i redeploy funkcji).
const KWOTA_GROSZE = 300;
const WALUTA = "pln";
const NAZWA_PRODUKTU = "Day Menu — pelny dostep";

// BLIK i Przelewy24 obok karty: wiekszosc uczniow nie ma wlasnej karty platniczej.
const METODY = ["card", "blik", "p24"];

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Tylko POST" }, 405);
  if (!STRIPE_KEY) return json({ error: "Brak STRIPE_SECRET_KEY w sekretach projektu" }, 500);

  // 1. Kim jest dzwoniacy. Bierzemy user_id z tokenu, NIGDY z ciala zadania —
  //    inaczej mozna by kupic dostep komus innemu (albo sobie, podajac cudze id).
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return json({ error: "Brak tokenu" }, 401);
  const uRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: SERVICE_KEY },
  });
  if (!uRes.ok) return json({ error: "Nieprawidlowy token" }, 401);
  const user = await uRes.json();
  if (!user?.id) return json({ error: "Nieprawidlowy token" }, 401);

  // 2. Juz zaplacil? Nie wystawiaj drugiej platnosci.
  const eRes = await fetch(
    `${SUPABASE_URL}/rest/v1/entitlements?select=user_id&user_id=eq.${user.id}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (eRes.ok) {
    const rows = await eRes.json();
    if (Array.isArray(rows) && rows.length) return json({ juzOplacone: true });
  }

  // 3. Sesja Checkout. Stripe przyjmuje wylacznie form-urlencoded.
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("client_reference_id", user.id);
  if (user.email) form.set("customer_email", user.email);
  form.set("success_url", `${APP_URL}?zaplacono=1`);
  form.set("cancel_url", `${APP_URL}?zaplacono=0`);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", WALUTA);
  form.set("line_items[0][price_data][unit_amount]", String(KWOTA_GROSZE));
  form.set("line_items[0][price_data][product_data][name]", NAZWA_PRODUKTU);
  METODY.forEach((m, i) => form.set(`payment_method_types[${i}]`, m));
  // metadata dubluje client_reference_id — webhook czyta jedno albo drugie,
  // zaleznie od tego, ktore pole Stripe przysle w danym typie zdarzenia
  form.set("metadata[user_id]", user.id);

  const sRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // ten sam uzytkownik klikajacy dwa razy nie tworzy dwoch sesji w Stripe
      "Idempotency-Key": `checkout-${user.id}`,
    },
    body: form.toString(),
  });
  const sesja = await sRes.json().catch(() => ({}));
  if (!sRes.ok || !sesja?.url) {
    console.error("Stripe odmowil:", sRes.status, JSON.stringify(sesja?.error ?? sesja));
    return json({ error: sesja?.error?.message ?? "Stripe odrzucil zadanie" }, 502);
  }
  return json({ url: sesja.url });
});
