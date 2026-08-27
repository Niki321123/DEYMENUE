// Tworzy sesje Stripe Checkout na jednorazowa oplate za pelny dostep do Day Menu.
//
// Wywolywane z aplikacji przez zalogowanego uzytkownika (verify_jwt=true). Kwota i waluta
// SA USTALANE TU, na serwerze — gdyby przychodzily z klienta, kazdy kupilby dostep za grosz.
// Sam fakt oplacenia zapisuje dopiero webhook (stripe-webhook), nie ta funkcja: powrot
// na success_url to tylko przekierowanie przegladarki i mozna go wywolac recznie.
//
// Sekrety (ustawiane w Supabase, NIE w repo):
//   STRIPE_SECRET_KEY  — klucz sekretny Stripe (sk_test_... / sk_live_...)
//   STRIPE_PRICE_ID    — opcjonalnie, cena z katalogu Stripe (price_...)
//   DAYMENU_APP_URL    — opcjonalnie, adres powrotu; domyslnie wersja webowa

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = Deno.env.get("DAYMENU_APP_URL") ?? "https://daymenu.pl/app.html";

/* Cena moze pochodzic z dwoch zrodel:
   1. STRIPE_PRICE_ID — pozycja z katalogu Stripe. Wtedy kwota, nazwa, opis i obrazek
      pochodza z panelu i zmienia sie je klikiem, bez ruszania kodu. Wersja preferowana.
   2. Brak tej zmiennej — awaryjnie skladamy cene w locie ze stalych ponizej.
   ID ceny jest ROZNE w piaskownicy i w trybie live, dlatego siedzi w zmiennej
   srodowiskowej, a nie w kodzie: przelaczenie na live to podmiana sekretu, nie redeploy.
   Fallback istnieje po to, zeby literowka w nazwie sekretu nie zatrzymala sprzedazy. */
const PRICE_ID = (Deno.env.get("STRIPE_PRICE_ID") ?? "").trim();
const KWOTA_GROSZE = 300;
const WALUTA = "pln";
// tekst widoczny dla klienta na stronie platnosci — jedyny w tym pliku z polskimi znakami
const NAZWA_PRODUKTU = "Day Menu — pełny dostęp";
// Wersja regulaminu obowiazujaca dla nowych zakupow. Podbijamy przy kazdej zmianie tresci,
// bo dla juz zawartych umow liczy sie brzmienie z dnia zakupu.
const REGULAMIN_WERSJA = "1.0";

/* Metod platnosci celowo NIE wpisujemy tutaj. Podanie ich na sztywno konczy sie bledem
   "The payment method type provided: blik is invalid", gdy dana metoda nie jest jeszcze
   wlaczona na koncie — i blokuje sprzedaz do czasu zmiany kodu. Bez tego pola Stripe
   Checkout pokazuje to, co masz wlaczone w panelu (Settings -> Payments -> Payment methods),
   wiec BLIK czy Przelewy24 dokladasz jednym klikiem, bez wdrazania funkcji. */

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

  /* 2. Zgoda konsumencka. Bez niej NIE tworzymy platnosci — to jedyny warunek pozwalajacy
        dostarczyc tresc cyfrowa od reki i nie zostawic kupujacemu 14 dni na odstapienie.
        Sprawdzamy na serwerze, bo checkbox w przegladarce da sie ominac. */
  const body = await req.json().catch(() => ({}));
  if (body?.zgoda !== true) {
    return json({ error: "Wymagana zgoda na natychmiastowe udostepnienie dostepu" }, 400);
  }
  const zgodaAt = new Date().toISOString();

  // 3. Juz zaplacil? Nie wystawiaj drugiej platnosci.
  const eRes = await fetch(
    `${SUPABASE_URL}/rest/v1/entitlements?select=user_id&user_id=eq.${user.id}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (eRes.ok) {
    const rows = await eRes.json();
    if (Array.isArray(rows) && rows.length) return json({ juzOplacone: true });
  }

  // 4. Sesja Checkout. Stripe przyjmuje wylacznie form-urlencoded.
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("client_reference_id", user.id);
  if (user.email) form.set("customer_email", user.email);
  form.set("success_url", `${APP_URL}?zaplacono=1`);
  form.set("cancel_url", `${APP_URL}?zaplacono=0`);
  form.set("line_items[0][quantity]", "1");
  if (PRICE_ID) {
    form.set("line_items[0][price]", PRICE_ID);
  } else {
    console.warn("Brak STRIPE_PRICE_ID — skladam cene w locie z wartosci wpisanych w kodzie");
    form.set("line_items[0][price_data][currency]", WALUTA);
    form.set("line_items[0][price_data][unit_amount]", String(KWOTA_GROSZE));
    form.set("line_items[0][price_data][product_data][name]", NAZWA_PRODUKTU);
  }
  // metadata dubluje client_reference_id — webhook czyta jedno albo drugie,
  // zaleznie od tego, ktore pole Stripe przysle w danym typie zdarzenia
  form.set("metadata[user_id]", user.id);
  // metadata wraca w webhooku — dowod zgody zostaje zapisany przy samej platnosci
  // w Stripe, niezaleznie od naszej bazy
  form.set("metadata[zgoda_at]", zgodaAt);
  form.set("metadata[regulamin]", REGULAMIN_WERSJA);

  /* Klucz idempotencji liczymy z TRESCI zadania, a nie z samego user_id.
     Stripe odrzuca ten sam klucz uzyty z innymi parametrami ("Keys for idempotent requests
     can only be used with the same parameters..."), wiec klucz zbudowany na sztywno psul
     sie przy kazdej zmianie konfiguracji — ceny, metod platnosci, adresu powrotu.
     Odcisk z form.toString() daje jedno i drugie: dwuklik w ta sama platnosc trafia
     w ten sam klucz, a kazda realna zmiana parametrow dostaje wlasny. */
  // Znacznik czasu zgody jest inny przy KAZDYM kliknieciu, wiec musi wypasc z odcisku —
  // inaczej podwojne klikniecie tworzyloby dwie sesje platnosci zamiast jednej.
  const doOdcisku = new URLSearchParams(form);
  doOdcisku.delete("metadata[zgoda_at]");
  const suma = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(doOdcisku.toString()));
  const odcisk = [...new Uint8Array(suma)].slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  const sRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `checkout-${user.id}-${odcisk}`,
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
