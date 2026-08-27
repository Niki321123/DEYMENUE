-- Platny dostep (jednorazowa oplata) do funkcji: Sprawdziany, Frekwencja i oceny,
-- wykresy w Analizie czasu, Rywalizacja.
--
-- Wiersz w tej tabeli = uzytkownik ma dostep. Pisze do niej WYLACZNIE webhook Stripe,
-- ktory chodzi na service_role. Klient moze tylko czytac swoj wiersz — gdyby mogl
-- pisac, kazdy odblokowalby sobie dostep jednym POST-em z konsoli przegladarki.

create table if not exists public.entitlements(
  user_id           uuid primary key references auth.users(id) on delete cascade,
  paid_at           timestamptz not null default now(),
  source            text not null default 'stripe',   -- stripe | grandfather | manual
  amount_minor      integer,                          -- ile realnie zaplacono, w groszach
  currency          text,
  stripe_session_id text unique                       -- klucz idempotencji: webhook Stripe
);                                                    -- potrafi przyjsc kilka razy

alter table public.entitlements enable row level security;

drop policy if exists "entitlements czytaj swoj" on public.entitlements;
create policy "entitlements czytaj swoj" on public.entitlements
  for select using (auth.uid() = user_id);

-- Konta zalozone, zanim platnosc w ogole istniala, dostaja dostep za darmo.
-- Bez tego trwajaca rywalizacja (z zakladem i punktami) urwalaby sie w polowie.
-- Cofniecie: delete from public.entitlements where source = 'grandfather';
insert into public.entitlements(user_id, source)
select id, 'grandfather' from auth.users
on conflict (user_id) do nothing;
