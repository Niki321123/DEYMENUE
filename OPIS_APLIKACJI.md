# Day Menu — opis aplikacji

_Dokument opisuje, co aplikacja robi i jak się z niej korzysta. Bez kodu i szczegółów
technicznych — te są w `PROJECT_NOTES.md`. Stan na build 69 (26 sierpnia 2026)._

---

## W jednym akapicie

Day Menu to osobisty panel ucznia przygotowującego się do matury. Łączy w jednym miejscu
rzeczy, które normalnie są rozrzucone po kilku aplikacjach: plan nauki na tydzień, minutnik
pomodoro, spis materiałów z odhaczaniem postępu, dziennik snu i nawyków, dane z Librusa
(plan lekcji, zapowiedzi sprawdzianów, frekwencja) oraz wykresy pokazujące, jak to wszystko
wygląda w czasie. Do tego dochodzi moduł rywalizacji z kolegą — punkty za naukę, zakłady,
sklep z nagrodami i czat. Część planowania wspiera sztuczna inteligencja: układa tygodniowy
harmonogram i rozpisuje każdy dzień sesja po sesji, dobierając konkretne lekcje z kursów
i konkretne zadania ze zbiorów.

---

## Dla kogo

Aplikacja powstała dla jednej konkretnej osoby — ucznia zdającego maturę 2027 z matematyki,
fizyki i geografii na poziomie rozszerzonym — i jego kolegi. Nie jest produktem dla szerokiego
odbiorcy: nie ma rejestracji otwartej dla wszystkich, marketingu ani płatności. To narzędzie
robione pod konkretny sposób pracy, rozwijane w miarę pojawiania się potrzeb.

Wynika z tego kilka rzeczy widocznych w działaniu. Materiały do nauki (wykupione kursy wideo
i zdigitalizowany zbiór zadań) pojawiają się wyłącznie na koncie właściciela — ktoś inny po
zalogowaniu zobaczy pustą zakładkę. Dostęp do funkcji AI jest przyznawany imiennie: bez niego
przyciski AI są niewidoczne i nie da się ich wywołać.

---

## Gdzie działa

Aplikacja istnieje w trzech postaciach, wszystkie oparte na tym samym kodzie:

- **program na komputer (Windows)** — okno aplikacji z ikoną w zasobniku systemowym,
- **aplikacja na Androida** — instalowana z pliku, nie ze sklepu,
- **wersja przeglądarkowa** — otwierana z adresu internetowego, przydatna na cudzym sprzęcie.

Wszystkie trzy aktualizują się same. Aplikacja przy starcie sprawdza, czy jest nowsza wersja,
pobiera ją w tle i uruchamia przy następnym otwarciu. Na komputerze jest tu jedna pułapka:
zamknięcie okna nie kończy programu, bo zostaje on w zasobniku — żeby aktualizacja weszła,
trzeba zamknąć aplikację właśnie stamtąd.

---

## Wejście do aplikacji

Aplikacja może być chroniona **lokalną blokadą hasłem** — przy uruchomieniu pyta o hasło,
zanim cokolwiek pokaże. To zabezpieczenie na wypadek, gdyby ktoś dorwał się do komputera;
nie ma nic wspólnego z kontem w chmurze.

Osobno działa **konto w chmurze**. Bez niego aplikacja jest w pełni sprawna, ale dane leżą
tylko na tym jednym urządzeniu. Po zalogowaniu wszystko synchronizuje się między komputerem
a telefonem, a dodatkowo odblokowują się funkcje wymagające serwera: Librus, AI i cały moduł
rywalizacji.

---

## Pulpit

Ekran startowy. Powitanie zależne od pory dnia, dzisiejsza data i cztery liczby na dziś:
ile minut nauki, ile sesji pomodoro, ile snu ostatniej nocy i ile nawyków odhaczonych.
Pod spodem lista aktywnych celów z paskami postępu.

---

## Osobiste

### Nawyki

Lista codziennych rzeczy do odhaczania — ćwiczenia, czytanie, cokolwiek. Przy każdym nawyku
liczy się **seria**: ile dni pod rząd był odhaczony. Seria zrywa się po opuszczonym dniu.
To najprostsza zakładka w całej aplikacji i celowo taka została.

### Licznik snu

Zapis każdej nocy: godzina zaśnięcia, godzina pobudki i subiektywna ocena jakości snu
w pięciostopniowej skali. Aplikacja sama liczy długość snu, także wtedy, gdy noc przechodzi
przez północ. Widać historię ostatnich czternastu nocy.

Sen nie jest tu zapisywany dla samego zapisywania — wchodzi do wskaźnika produktywności
(opisanego niżej) i do wykresów, gdzie widać zależność między wysypianiem się a nauką.

### Cele

Długoterminowe cele rozbite na konkretne kroki. Każdy krok osobno się odhacza, a cel pokazuje
pasek postępu. Aktywne cele wyświetlają się też na Pulpicie.

---

## Edukacja

To najbardziej rozbudowana część aplikacji. Zakładka **Nauka** dzieli się na pięć paneli.

### Harmonogram

Siatka tygodnia: siedem dni na siedemnaście godzin (6:00–22:00). Każde okienko ma stan,
który maluje się pędzlem:

| Stan | Znaczenie |
|---|---|
| Dostępny | możesz się wtedy uczyć — tutaj AI planuje naukę |
| W szkole | jesteś na lekcjach, nauka dopiero po nich |
| Niedostępny | godzina zajęta, bez podpisu |
| Własna aktywność — zajęte | np. trening, praca; blokuje godzinę, ale z nazwą |
| Własna aktywność — nauka | Twoja forma nauki poza planem AI, którą odhaczasz |

Godziny szkolne **wypełniają się same z planu lekcji z Librusa**, więc szkielet tygodnia nie
wymaga ręcznej roboty. Własne aktywności są ważne z innego powodu: AI je widzi, zna ich nazwy
i potrafi się do nich odwołać przy tłumaczeniu decyzji („w środy masz trening, więc
przeniosłem matematykę na czwartek").

Po naciśnięciu przycisku generowania AI układa plan nauki na cały tydzień — wypełnia dostępne
okienka konkretnymi przedmiotami. Można mu w jednym zdaniu podać preferencje, np. „chcę się
uczyć 3 godziny 45 minut dziennie, w piątki się nie uczę". Aplikacja tłumaczy takie zdanie na
liczby i **sama pilnuje ich wykonania**: usuwa bloki z dni wolnych, przycina dni ponad limit
i dokłada brakujące. Pokazuje przy tym, jak zrozumiała preferencje i co poprawiła — dzięki
temu widać, kiedy AI się pomyliło, zamiast dowiadywać się o tym po fakcie.

Jest też **czat z AI o harmonogramie**. Można napisać „w środy mam trening 17–19, oznacz jako
niedostępne i przełóż naukę", a aplikacja zmieni siatkę i ułoży plan od nowa. Zmiany
dostępności zrobione czatem obowiązują tylko w bieżącym tygodniu — stały szkielet z planu
lekcji wraca w kolejnym.

Ważny szczegół, który łatwo przeoczyć: **okienko w siatce to godzina zegarowa, ale nauki jest
w niej tyle, ile trwa sesja pomodoro** (domyślnie 45 minut), reszta to przerwa. Aplikacja
przelicza to za użytkownika i podaje realny czas nauki, a nie liczbę okienek.

### Przedmioty

Lista przedmiotów z priorytetem wyrażonym w procentach. Priorytet decyduje o podziale czasu
w planie: 80% matematyki i 20% geografii oznacza czterokrotnie więcej matematyki.

### Las (pomodoro)

Minutnik pracujący w cyklu: faza pracy, potem przerwa. Można wybrać przedmiot, którego dotyczy
sesja — wtedy czas trafia do statystyk tego przedmiotu.

Mechanika motywacyjna jest prosta i skuteczna: **ukończona faza pracy sadzi drzewo**.
Porzucona sesja zostawia uschnięte. Las rośnie z dnia na dzień i widać w nim całą historię
pracy. Liczba żywych drzew jest jedną z liczb, którymi mierzycie się w rywalizacji.

Długość sesji ustawiona tutaj jest jednocześnie budżetem czasowym, którym operuje planer
dzienny — o tym niżej.

### Lekcja

Panel, który odpowiada na pytanie „co dokładnie mam dziś robić". Po naciśnięciu przycisku AI
bierze dzisiejsze sesje z harmonogramu i **rozpisuje każdą z osobna**: które lekcje z kursu
wideo obejrzeć i które zadania z którego działu zrobić. Można podać temat na dziś („dziś chcę
funkcję kwadratową") albo zostawić puste — wtedy plan po prostu idzie dalej kursem.

System trzyma się kilku zasad:

- **Nie otwiera nowego tematu, dopóki poprzedni nie jest skończony** — chyba że sam wpiszesz
  temat, wtedy Twoja decyzja jest ważniejsza.
- **Zadania traktuje na równi z lekcjami.** Po obejrzeniu lekcji następna sesja idzie
  w większości na zadania z tego samego tematu, a nie „na koniec, jak zostanie czas".
- **Nie przekracza budżetu sesji.** Lekcja trwająca 35 minut w 45-minutowej sesji zostawia
  około 10 minut, czyli miejsce na jedno–dwa zadania. Jeśli lekcja jest dłuższa niż cała
  sesja, zajmuje ją w całości i nic się do niej nie dokłada.
- **Nie powtarza materiału.** To, co przydzielono wcześniejszej sesji tego dnia albo co jest
  już odhaczone, nie wróci w kolejnej.
- **Nie wymyśla sesji.** Liczba sesji zawsze odpowiada harmonogramowi; nadmiarowe propozycje
  są odrzucane, a fakt odrzucenia — pokazywany.

Quizy i ich omówienia liczone są jako praktyka, czyli razem z zadaniami, a nie jako lekcje.
Pozycje typu „Wprowadzenie do modułu", trwające kilkanaście sekund, są pomijane całkowicie.

Każda pozycja w planie jest **klikalna**: lekcja otwiera odcinek kursu, zadanie otwiera
konkretne zadanie na stronie, z której pochodzi. Obok jest pole odhaczania.

### Statystyki

Rozbicie czasu nauki na przedmioty.

### Sprawdziany

Zapowiedzi sprawdzianów, kartkówek i innych prac pobierane automatycznie z terminarza Librusa
— data, przedmiot, opis. Do każdej pozycji można dopisać umówioną poprawę. Wpisy ręczne
i poprawy należą do użytkownika i przeżywają synchronizację, nawet jeśli sprawdzian zniknie
z Librusa.

### Materiały

Spis wszystkiego, z czego się uczysz, z odhaczaniem postępu. Materiały dzielą się na trzy
rodzaje:

**Kursy wideo.** Pełna lista lekcji z nazwami, czasem trwania i linkami — kliknięcie otwiera
odcinek. Lekcje pogrupowane są w moduły. Wgrane są dwa kursy powtórkowe: matematyka rozszerzona
i fizyka, razem kilkaset pozycji.

**Zbiory zadań z działami.** Numerowane kwadraciki do odhaczania, pogrupowane w działy;
numeracja w każdym dziale zaczyna się od jedynki, tak jak w książce. Wgrany jest zbiór zadań
maturalnych z matematyki — 605 zadań w 16 działach.

**Zadania z linkami.** Nowszy rodzaj: każde zadanie to osobny wiersz z numerem, tytułem,
liczbą punktów i sesją egzaminacyjną, z której pochodzi. Kliknięcie otwiera zadanie razem
z rozwiązaniem. Wgrane są 328 zadań maturalnych z fizyki z arkuszy CKE z lat 2015–2025,
pochodzące z ogólnodostępnej strony.

Przy tym ostatnim zbiorze warto znać jedną decyzję: zadania są pogrupowane **według modułów
kursu, a nie według kategorii ze strony źródłowej**. Strona wrzuca bryłę sztywną, hydrostatykę
i zasadę zachowania pędu do jednego worka „Dynamika", przez co planer przy temacie
„hydrostatyka" podsuwałby zadania o tarciu. Po przepisaniu na moduły kursu nazwy działów
zgadzają się co do znaku z nazwami modułów, więc dobór zadań do tematu lekcji jest dokładny.

Można też dodawać własne materiały: nazwa, przedmiot i liczba zadań, którą chce się odhaczać.

### Frekwencja

Obecności i nieobecności z Librusa, liczone automatycznie od dnia podłączenia konta. Historia
sprzed podłączenia nie jest dostępna — Librus jej po prostu nie udostępnia w ten sposób.

---

## Produktywność

### Rywalizacja

Największy pojedynczy moduł. Służy do mierzenia się z kolegą w nauce.

**Dodawanie znajomych** odbywa się przez kod zaproszenia. Każdy ma własny kod, przekazuje go
drugiej osobie, a ta wpisuje go u siebie — powiązanie działa od razu w obie strony. Kody są
prywatne: nie da się podejrzeć cudzego.

**Co widzą znajomi.** Wyłącznie liczbę godzin nauki, liczbę sesji pomodoro i wskaźnik
produktywności. Nastrój, sen, cele, nawyki, Librus, materiały i cała reszta zostają prywatne.
To granica pilnowana po stronie serwera, nie tylko w interfejsie.

**Wykresy.** Wasze wyniki nakładają się na siebie na jednym wykresie w czterech zakresach:
siedem dni, trzydzieści dni, rok i cała historia. Osobno można przełączać, co jest rysowane:
produktywność, godziny nauki albo sesje pomodoro.

**Pojedynek** pokazuje bezpośrednie zestawienie — osobno bieżący tydzień i osobno całość od
początku rywalizacji.

**Punkty.** System punktowy działa tak:

| Za co | Ile |
|---|---|
| Godzina nauki | 1 punkt |
| Więcej godzin w zakończonym tygodniu | 5 punktów |
| Wyższa średnia produktywność w tygodniu | 5 punktów |
| Więcej godzin w zakończonym miesiącu | 15 punktów |
| Wyższa średnia produktywność w miesiącu | 15 punktów |
| Wygrany zakład | 1–7 punktów |

Dwie zasady, które warto rozumieć. Po pierwsze, **bonusy naliczają się dopiero po zakończeniu
okresu** — inaczej punkty skakałyby tam i z powrotem w trakcie tygodnia po każdej sesji nauki.
Po drugie, **przy remisie punkty dostają obaj, ale tylko jeśli każdy przekroczył próg nauki**
(10 godzin w tygodniu, 40 w miesiącu). Bez progu tydzień, w którym obaj nic nie zrobili,
nagradzałby obu za nicnierobienie.

**Zakłady.** Można założyć się o cokolwiek — „wyższa ocena ze sprawdzianu z matematyki" —
o stawkę od 1 do 7 punktów. Przebieg: jedna osoba zakłada, druga przyjmuje albo odrzuca, po
fakcie ktoś zgłasza wynik, a **druga strona musi go potwierdzić** albo zakwestionować.
Zgłaszający nie ma u siebie przycisku potwierdzenia — bez tego każdy przyznawałby sobie punkty
sam.

**Sklep za punkty.** Wspólna lista nagród, do której obaj dopisujecie pozycje i z której obaj
kupujecie: wieczór na grze, kawa stawiana przez przegranego, cokolwiek ustalicie. Cena od 1 do
1000 punktów, punkty schodzą od razu, własny zakup można cofnąć. Historia zakupów jest wspólna,
więc widzicie nawzajem, na co idą punkty. Saldo do wydania liczy się jako punkty zdobyte minus
wydane — przy czym o pozycji w rywalizacji decydują punkty **zdobyte**, żeby wydawanie nie
kosztowało miejsca w tabeli.

**Czat.** Zwykła rozmowa tekstowa między znajomymi: dymki, podział na dni, godzina przy każdej
wiadomości. Nowe wiadomości przychodzą co kilkanaście sekund; jeśli jesteś na innej zakładce,
dostajesz powiadomienie z nazwą nadawcy i początkiem treści. Rozmowy są jeden na jeden — gdyby
doszła trzecia osoba, nie zobaczy cudzej konwersacji.

### Analiza czasu

Wykres liniowy w stylu giełdowym, na którym można włączać i wyłączać poszczególne wskaźniki
oraz nakładać je na siebie. Dostępne linie to produktywność, sen i nauka.

**Produktywność** to wskaźnik złożony: średnia z przespanego czasu i z czasu nauki, gdzie trzy
godziny nauki dziennie liczą się jako 100%. Dzięki temu jedna liczba mówi, czy dzień był
wartościowy — nieprzespana noc obniża ją nawet przy dużej liczbie godzin nauki.

---

## Ustawienia

### Profil

Zdjęcie i nazwa widoczne dla znajomych w Rywalizacji. Zdjęcie jest przeskalowywane w samej
aplikacji do małego kwadratu, więc nie ma znaczenia, jak duży plik się wybierze. Bez zdjęcia
wyświetla się kółko z inicjałami.

Pod spodem podsumowanie wszystkich Twoich liczb: łączny czas nauki, czas w bieżącym tygodniu,
liczba sesji pomodoro, aktualna seria dni nauki pod rząd, najdłuższa seria w historii, liczba
dni z jakąkolwiek nauką, średnia produktywność i średni sen z ostatnich trzydziestu dni oraz
data pierwszej zapisanej sesji. Na końcu paski postępu każdego materiału.

### Wygląd

Motyw jasny albo ciemny, kolor główny i kolor akcentu. Można ustawić **własne zdjęcie jako
tło** — aplikacja sama dobiera wtedy motyw i przyciemnienie tak, żeby tekst pozostał czytelny,
a suwakami przyciemnienia i rozmycia można to doprecyzować. Tutaj też jest eksport wszystkich
danych do pliku i import z powrotem.

### Konto

Logowanie do chmury, włączenie lokalnej blokady hasłem i podłączenie konta Librusa.

---

## Sztuczna inteligencja — co robi, a czego nie

AI występuje w aplikacji w trzech miejscach: układa tygodniowy harmonogram, rozpisuje dzienny
plan sesja po sesji i odpowiada na polecenia w czacie o harmonogramie.

Warto rozumieć podział ról, bo jest w tej aplikacji przemyślany i wynika z doświadczenia.
**Model odpowiada za rzeczy językowe i uznaniowe**: zrozumienie zdania „w piątki się nie uczę",
dopasowanie działu zadań do tematu lekcji, uzasadnienie decyzji. **Wszystkie reguły liczbowe
sprawdza i wymusza sama aplikacja**: budżet czasowy sesji, liczbę sesji w dniu, liczbę bloków
na dzień, dni wolne, pomijanie już odhaczonego materiału.

Ten podział nie jest teoretyczny. Zdarzało się, że model wciskał 111 minut lekcji w
45-minutową sesję, proponował siedem sesji zamiast pięciu albo planował naukę w dniu wyraźnie
zablokowanym. Za każdym razem reguła była zapisana w poleceniu dla modelu — i za każdym razem
została złamana. Dlatego dziś źródłem prawdy jest stan aplikacji, a odpowiedź modelu tylko się
do niego dopasowuje. Gdy coś zostanie odrzucone lub poprawione, aplikacja mówi o tym wprost,
zamiast po cichu korygować.

Dostęp do AI jest przyznawany imiennie. Bez niego przyciski AI są niewidoczne, a zakładka
Lekcja w ogóle nie istnieje w nawigacji. Planer tygodniowy ma wtedy wersję zapasową działającą
bez AI — dzieli dostępne godziny proporcjonalnie do priorytetów przedmiotów.

---

## Librus

Aplikacja łączy się z dziennikiem elektronicznym i pobiera z niego trzy rzeczy: **plan lekcji**
(z którego automatycznie powstaje szkielet tygodnia w harmonogramie), **zapowiedzi sprawdzianów**
i **frekwencję**. Plan lekcji jest monitorowany cyklicznie — o zmianach w planie aplikacja
powiadamia sama.

---

## Dane i prywatność

Dane trzymane są w dwóch miejscach jednocześnie: lokalnie na urządzeniu i — po zalogowaniu —
w chmurze, skąd synchronizują się między komputerem a telefonem. Wszystko poza rywalizacją
jest prywatne.

Rywalizacja działa na osobnych, wąskich zestawach danych: dzienne liczby (minuty nauki, sesje
pomodoro, produktywność), profile, powiązania znajomych, zakłady, nagrody w sklepie
i wiadomości. Do każdego z nich serwer pilnuje osobno, kto co może zobaczyć i zmienić —
obcy nie widzi niczego, nie da się pisać w cudzym imieniu ani zmieniać cudzych wpisów. Nie są
to deklaracje w interfejsie, tylko reguły egzekwowane po stronie bazy danych.

Aplikacja ma też zabezpieczenie przed pomieszaniem kont na jednym urządzeniu: pamięta, do kogo
należą dane leżące lokalnie, i nie pozwoli wypchnąć ich na cudze konto po przelogowaniu.

Dostępny jest pełny eksport danych do pliku i import z powrotem — kopia zapasowa niezależna od
chmury.

---

## Ograniczenia, o których warto wiedzieć

- **Materiały są przypisane do jednego konta.** Wgrane kursy i zbiory zadań pojawiają się tylko
  u właściciela; nowy użytkownik widzi pustą zakładkę i musi dodać własne.
- **Historia frekwencji zaczyna się od podłączenia Librusa** — wcześniejszej nie da się pobrać.
- **Saldo sklepu liczy aplikacja, nie serwer.** Przy dwóch osobach to kwestia zaufania;
  technicznie da się to obejść.
- **Proporcje przedmiotów w planie tygodniowym nie są egzekwowane** tak twardo jak liczba
  sesji — aplikacja wyrównuje niedobory, ale nie przepisuje planu od zera.
- **Zbiór zadań z fizyki w większości pochodzi ze starszej formuły matury** (86 z 328 zadań to
  arkusze z lat 2023–2025). Przy każdym zadaniu widać sesję egzaminacyjną, a w obrębie działu
  najnowsze są na górze.
- **Brakuje zadań pod wymagania przekrojowe** — niepewności pomiarowe i opracowanie wyników
  doświadczeń trzeba ćwiczyć z kursu, bo źródło zadań nie ma takiej kategorii.

W aplikacji są też trzy zakładki **ukryte z nawigacji, ale nadal działające**: mood tracker,
lista książek i pełna lista wymagań maturalnych z podstawy programowej. Zostały schowane, bo
nie były używane — dane w nich się nie zgubiły i można je przywrócić.
