-- Egzekwowanie oplaty na poziomie bazy, a nie tylko interfejsu.
--
-- Do tej pory bramka chowala zakladki w przegladarce, ale dane rywalizacji dalo sie
-- odczytac zwyklym zapytaniem do API z konsoli. Teraz decyduje RLS.
--
-- Zasada: WLASNE dane zawsze dostepne (profil i statystyki to funkcje bezplatne),
-- dane INNYCH osob oraz cala rywalizacja — tylko dla kont z wierszem w `entitlements`.
-- Kasowanie zostaje otwarte, zeby nikt nie zostal uwiezniony we wlasnych danych.

create or replace function public.ma_dostep()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists(select 1 from public.entitlements where user_id = auth.uid()) $$;

comment on function public.ma_dostep() is
  'Czy zalogowane konto ma oplacony (lub przyznany) pelny dostep. Uzywane w politykach RLS.';

-- Niezalogowany nie ma czego sprawdzac; funkcja i tak zwrocilaby falsz.
revoke execute on function public.ma_dostep() from anon;
grant execute on function public.ma_dostep() to authenticated;

-- ---- dane innych osob: wlasny wiersz bez zmian, cudzy tylko po oplacie ----
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select
  using (user_id = auth.uid() or (is_friend(user_id) and ma_dostep()));

drop policy if exists "stats_select" on public.stats_daily;
create policy "stats_select" on public.stats_daily for select
  using (user_id = auth.uid() or (is_friend(user_id) and ma_dostep()));

drop policy if exists "shop_items_select" on public.shop_items;
create policy "shop_items_select" on public.shop_items for select
  using (owner_id = auth.uid() or (is_friend(owner_id) and ma_dostep()));

drop policy if exists "shop_purchases_select" on public.shop_purchases;
create policy "shop_purchases_select" on public.shop_purchases for select
  using (buyer_id = auth.uid() or (is_friend(buyer_id) and ma_dostep()));

-- ---- dane istniejace wylacznie w ramach rywalizacji: caly dostep po oplacie ----
drop policy if exists "friendships_select" on public.friendships;
create policy "friendships_select" on public.friendships for select
  using ((user_id = auth.uid() or friend_id = auth.uid()) and ma_dostep());

drop policy if exists "bets_select" on public.bets;
create policy "bets_select" on public.bets for select
  using ((a_id = auth.uid() or b_id = auth.uid()) and ma_dostep());

drop policy if exists "bets_insert" on public.bets;
create policy "bets_insert" on public.bets for insert
  with check (a_id = auth.uid() and is_friend(b_id) and ma_dostep());

drop policy if exists "bets_update" on public.bets;
create policy "bets_update" on public.bets for update
  using ((a_id = auth.uid() or b_id = auth.uid()) and ma_dostep())
  with check (a_id = auth.uid() or b_id = auth.uid());

drop policy if exists "rywal_messages_select" on public.rywal_messages;
create policy "rywal_messages_select" on public.rywal_messages for select
  using ((from_id = auth.uid() or to_id = auth.uid()) and ma_dostep());

drop policy if exists "rywal_messages_insert" on public.rywal_messages;
create policy "rywal_messages_insert" on public.rywal_messages for insert
  with check (from_id = auth.uid() and is_friend(to_id) and ma_dostep());

-- ---- zapisy do wlasnego sklepu tylko przy dostepie (sklep istnieje tylko w rywalizacji) ----
drop policy if exists "shop_items_insert" on public.shop_items;
create policy "shop_items_insert" on public.shop_items for insert
  with check (owner_id = auth.uid() and ma_dostep());

drop policy if exists "shop_purchases_insert" on public.shop_purchases;
create policy "shop_purchases_insert" on public.shop_purchases for insert
  with check (buyer_id = auth.uid() and ma_dostep());

/* Zweryfikowane 2026-08-27 w transakcji zakonczonej wycofaniem: po zabraniu wiersza
   z `entitlements` konto widzi profiles 2->1, stats_daily 4->1, friendships 2->0,
   rywal_messages 1->0. Czyli wylacznie wlasne dane. */
