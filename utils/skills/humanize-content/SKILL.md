---
name: humanize-content
description: >-
  Ostatni pass językowy przed publikacją tekstu po polsku albo angielsku: usuwa
  markery AI (lawina myślników, kalki z angielskiego, waciki marketingowe,
  monotonny rytm, doklejane imiesłowy i „-ing" clauses, rule-of-three, puste
  otwarcia), poprawia szyk, interpunkcję i typografię — zachowując sens, fakty,
  liczby, ton, rejestr, frazy SEO i formatowanie. Używaj za każdym razem, gdy
  tekst jest pisany, redagowany albo domykany do publikacji: artykuł na bloga,
  copy strony, landing, meta title i description, CTA, newsletter, email,
  ogłoszenie, post na LinkedIna lub X, opis produktu, README pisane dla ludzi —
  zanim przedstawisz go jako gotowy. Triggeruj też na „popraw styl", „popraw
  tekst", „zrób korektę", „redakcja", „dopracuj", „brzmi sztucznie", „brzmi jak
  AI", „nienaturalnie", „drętwo", „uczłowiecz to", „usuń AI slop", „zamień
  myślniki", „popraw gramatykę / szyk / interpunkcję", „humanize this", „de-AI
  this text", "make it sound natural", "proofread", "polish this copy" albo
  /humanize-content. Nie używaj do tłumaczeń, kodu, ani dokumentacji technicznej
  pisanej dla maszyn.
argument-hint: "[tekst, ścieżka do pliku lub zakres plików]"
---

# Humanize content — anty-AI pass dla treści PL i EN

Jesteś ostatnią parą oczu przed publikacją. Tekst spod LLM-a bywa poprawny „na
papierze", ale zdradza się manierami: lawiną myślników, kalkami, pustymi
wacikami i rytmem równym jak metronom. Twoje zadanie to zdjąć tę sztuczność —
**nie** przepisać tekstu od nowa.

Kluczowa intuicja: sztuczność rzadko siedzi w pojedynczym słowie. Siedzi w
**powtarzalności wzorca**. Jeden myślnik to styl, pięć to podpis. Jedna trójka
(„szybko, tanio i wygodnie") to rytm, w co drugim akapicie to sygnatura modelu.
Dlatego szukaj wzorców, nie odhaczaj słówek z listy.

## Zasada nadrzędna: popraw, nie przepisuj

Największe ryzyko tego skilla to „ulepszyć" tekst tak, że zniknie jego sens albo
głos autora. Granice:

- **Sens, fakty i liczby zostają nietknięte.** Nic nie dodajesz i nic nie
  usuwasz merytorycznie. Brakujące dane oznaczasz `[do uzupełnienia: ...]`
  (EN: `[to fill in: ...]`) — nigdy nie wstawiasz prawdopodobnie brzmiącej liczby.
  Jeśli coś jest merytorycznie wątpliwe, zostaw i zasygnalizuj w podsumowaniu.
- **Ton i rejestr 1:1.** Formalny mail zostaje formalny, luźny post luźny,
  marketing marketingiem. Poprawiasz płynność *w obrębie* istniejącego rejestru,
  nie podnosisz go ani nie obniżasz.
- **Głos autora zostaje.** Celowo krótkie zdania, ironia, kolokwializm, branżowy
  żargon — to charakter, nie błąd. Usuwasz *sztuczność*, nie *charakter*.
- **Nie tłumacz.** PL → PL, EN → EN. Jeśli tekst ma bliźniaka w drugim języku,
  to osobne mapy intencji, nie tłumaczenia — poprawiaj każdą w jej własnym
  języku, ale trzymaj spójne decyzje strukturalne (format punktów, konwencja
  nagłówków).
- **Gdy tekst jest już dobry — zostaw go** i powiedz to wprost. Lepiej oddać
  prawie nietknięty z notką „brzmi naturalnie", niż zepsuć zdania, które były OK.

## Kontekst projektu (jeśli jest)

Zanim zaczniesz, sprawdź, czy projekt ma własne zasady języka — inaczej narzucisz
uniwersalny default tam, gdzie marka ma świadomie inny styl:

1. `.claude/humanize.md` — dedykowany konfig tego skilla (szablon:
   `assets/humanize.template.md`). Jeśli istnieje, ma pierwszeństwo przed
   wszystkim poniżej.
2. `CLAUDE.md` — wskazówki o tonie, marce, zakazanych słowach albo wskaźnik do
   brand booka.
3. Doc głosu marki w repo (`docs/**/brand*`, `*voice*`, `*tone*`, `*style-guide*`),
   jeśli CLAUDE.md albo użytkownik na niego wskazuje.

Nie rób przeszukiwania całego repo na własną rękę — sprawdź te trzy miejsca i
ruszaj dalej. Gdy nic nie ma, pracuj na uniwersalnych defaultach z tego skilla i
zaznacz w podsumowaniu, że projekt nie definiuje własnych zasad (to zaproszenie
do założenia konfigu, nie zarzut).

Konfig projektu może nadpisać: listę zakazanych słów, politykę myślników,
konwencję nagłówków, formy adresatywne, twarde limity meta, listę terminów
nietykalnych.

## Workflow

1. **Zdobądź tekst.** Argument to tekst → pracuj na nim. Argument wygląda jak
   ścieżka (`.md`, `.mdx`, `.txt`, `.html`, `.json`) → wczytaj plik i edytuj go
   w miejscu. Brak argumentu → poproś o wklejenie albo o ścieżkę.
2. **Przeczytaj całość przed pierwszą zmianą.** Rozpoznaj język, typ tekstu,
   rejestr, głos autora i to, co w pliku jest treścią publikowalną, a co notatką
   roboczą. Bez tego nie da się poprawiać „1:1".
3. **Zdiagnozuj, zanim poprawisz.** Nazwij sobie **2–3 dominujące markery tego
   konkretnego tekstu** (np. „myślniki + trójki + każdy akapit otwarty nazwą
   produktu"). To najważniejszy krok całego skilla: pass prowadzony diagnozą
   uderza w to, co realnie psuje tekst, a pass prowadzony checklistą rozprasza
   się na dziesiątki płytkich, kosmetycznych zmian i mija się z problemem.
4. **Uruchom skaner** (`scripts/scan.py`, sekcja „Weryfikacja") — dostajesz
   liczby zamiast wrażeń: gęstość myślników, rozkład długości zdań, powtórzone
   łączniki, trafienia z listy AI-tells. Traktuj to jako mapę, nie wyrok.
5. **Popraw zdanie po zdaniu.** Najpierw poprawność (gramatyka, interpunkcja),
   potem naturalność (szyk, kalki, waciki), na końcu rytm całości.
6. **Przeczytaj poprawioną całość „na głos w głowie".** Tu wyłapiesz to, czego
   nie widać zdanie po zdaniu: monotonię, powtórzone otwarcia, zdania, które się
   o siebie potykają.
7. **Zrób test odcisku palca** (niżej) i domknij.
8. **Podsumuj zmiany** w 3–6 punktach pogrupowanych kategoriami, nie wyliczanką
   każdego przecinka. Zaznacz, czego świadomie nie ruszyłeś.

Gdy poprawiasz plik z mieszaną zawartością (spec, dokument roboczy, brief),
**ruszaj tylko treść publikowalną** — nagłówki dokumentu, notatki redakcyjne,
checklisty i instrukcje wdrożeniowe zostają. Tam myślniki i żargon są w porządku,
bo nie idą do czytelnika. W razie wątpliwości, co jest czym, zapytaj zamiast
zgadywać.

## Myślniki — marker #1 w obu językach

**EN:** em dash jako uniwersalny klej to najbardziej rozpoznawalny tell.
Domyślny limit: **maksymalnie jeden na ~200 słów**, reszta do zamiany. En dash
w zakresach (`2020–2024`, `pp. 10–20`) to poprawna typografia i zostaje.

**PL:** pauza jest **normalnym znakiem polskiej interpunkcji** — zwłaszcza w
miejsce opuszczonego orzeczenia („Ja jestem inżynierem, on — handlowcem") i we
wtrąceniu. Tellem jest **gęstość** i używanie jej jako zamiennika każdego innego
znaku, nie samo jej istnienie. Domyślny limit: **maksymalnie jeden na akapit**.
Osobno pilnuj poprawnego znaku: dywiz tylko w złożeniach („biało-czerwony"),
półpauza w zakresach („2020–2024"), pauza w zdaniu — ze spacjami.

Projekt może zaostrzyć to do zera (`.claude/humanize.md`). Gdy tak jest —
zamieniasz wszystkie w treści publikowalnej.

Czym zamieniać, w kolejności od najczęściej trafnego:

- **przecinek** — zwykłe dopowiedzenie: „w jednym oknie — bez skakania" →
  „w jednym oknie, bez skakania";
- **dwukropek** — druga część wyjaśnia pierwszą: „To nasz SaaS — jesteśmy
  współzałożycielem" → „To nasz SaaS: jesteśmy współzałożycielem";
- **kropka i podział na dwa zdania** — gdy zdanie jest przeładowane; to zwykle
  najlepsza zamiana, bo od razu naprawia też rytm;
- **średnik** (częściej w EN) — „You don't buy a project — you log in" →
  „…project; you log in";
- **nawias** — gdy wtrącenie jest naprawdę poboczne;
- **pytanie retoryczne** — raz na tekst, dla oddechu: „a gdy dostawca zmieni
  API — to nasz problem" → „A kiedy dostawca zmieni API? To nasz problem.";
- w punktach listy „**Termin** — opis" → „**Termin:** opis";
- w tytułach i meta title separator „—" → dwukropek albo przecinek.

## Najczęstsze markery — skrót

Pełne katalogi z przykładami: **`references/pl-markers.md`** i
**`references/en-markers.md`**. Przeczytaj ten, który pasuje do języka tekstu —
skrót niżej wystarcza do rozpoznania wzorca, ale nie do trudniejszych przypadków.

**PL:** zbędne zaimki i dzierżawcze (kalka z „I/your"); „posiadać" → „mieć";
„dokonać rezerwacji" → „zarezerwować"; nominalizacje („w celu zwiększenia" →
„żeby zwiększyć"); **łańcuchy dopełniaczy** („proces optymalizacji wydajności
systemu" → rozbij); **doklejone imiesłowy** („…, zapewniając pełną kontrolę");
„w oparciu o" → „na podstawie"; „adresować problem" → „rozwiązać"; nadużyta
strona bierna; anglicyzmy nie na miejscu wobec odbiorcy; szyk (przymiotnik
klasyfikujący po rzeczowniku, nowa informacja na końcu zdania); interpunkcja
(przecinek przed „że/który/aby", cudzysłów „", przecinek dziesiętny, sentence
case w nagłówkach).

**EN:** monotonne otwarcia zdań i adverb-first („Ultimately, Notably,
Importantly"); **trailing „-ing" clauses** („…, ensuring seamless integration")
— najsilniejszy tell po em dashu; rule-of-three w co drugim akapicie; leksykon
LLM-a (delve, tapestry, testament, realm, landscape, robust, leverage, elevate,
unlock, foster, myriad); puste intensyfikatory („truly", „incredibly");
nominalizacje („provides optimization of" → „optimizes"); „not only X but also
Y"; title case w nagłówkach → sentence case; brak skrótów („do not" → „don't"
w tonie marketingowym); przecinki seryjne konsekwentnie w obrębie tekstu.

## Rytm — najczęściej pomijana poprawka

Ludzie piszą nierówno. Modele piszą równo, i to widać, zanim czytelnik zdąży
przeczytać choć jedno zdanie. Po korekcie zdaniowej sprawdź trzy rzeczy:

- **Długość zdań.** Trzy zdania z rzędu w tym samym przedziale długości to
  monotonia — rozbij jedno albo skróć do urwanego równoważnika. Jedno krótkie
  zdanie po dwóch długich robi dla naturalności więcej niż dziesięć poprawek
  słownikowych.
- **Otwarcia.** Policz, od czego zaczynają się kolejne zdania i akapity. Trzy
  akapity otwarte nazwą produktu albo pięć zdań otwartych podmiotem to wzorzec
  do przełamania.
- **Łączniki.** „Ponadto / Co więcej / Dodatkowo / Podsumowując" i „Moreover /
  Furthermore / Additionally / In conclusion" — maksymalnie raz na tekst,
  zwykle da się usunąć bez straty i zacząć zdanie od rzeczy.

Sprawdź też długość akapitów: cztery akapity po dokładnie trzy zdania to ten sam
tell, tylko piętro wyżej.

## Przeciwwaga: nie przekorygowuj

Realne ryzyko po drugiej stronie: model stosuje wszystkie reguły naraz i
produkuje tekst rwany, staccato, bez tkanki łącznej — **równie nienaturalny, po
prostu inaczej**. Proza wypolerowana do zera powtórzeń i zero hedgingu też jest
tellem, bo ludzie tak nie piszą.

Zostaw więc miejsce na człowieka:

- **Powtórzenie bywa celowe.** Powtórzony rzeczownik czyta się lepiej niż
  synonim wciśnięty na siłę („to rozwiązanie / owo narzędzie / rzeczona
  platforma" w trzech kolejnych zdaniach to gorszy tekst, nie lepszy).
- **Długie zdanie nie jest błędem.** Tellem jest ciąg zdań tej samej długości,
  nie długość sama w sobie.
- **Trochę hedgingu jest ludzkie.** „Zwykle", „w większości przypadków",
  „raczej" — ludzie asekurują się, gdy naprawdę nie mają pewności. Tnij
  asekurację pustą, nie tę, która niesie informację.
- **Prostota nie musi być krótkością.** Zdanie zrozumiałe za pierwszym razem
  wygrywa z krótszym, które trzeba przeczytać dwa razy.
- **Nie każde słowo z listy jest zakazane.** „Robust" w tekście o
  niezawodności systemu może być właściwym słowem. Wycinasz je, gdy nic nie
  znaczy, nie dlatego, że jest na liście.

## Test odcisku palca (przed oddaniem)

Przeczytaj wynik i odpowiedz sobie na dwa pytania:

1. **Które zdanie nadal wygląda jak wygenerowane?** Jeśli takie jest — popraw je
   albo świadomie zostaw i wspomnij w podsumowaniu.
2. **Które zdanie mógł napisać tylko człowiek?** Konkret, którego model by nie
   wymyślił, celowe urwanie, nieoczywisty czasownik, żart. Jeśli w całym tekście
   nie ma **ani jednego** takiego miejsca, pass był za płytki — tekst jest
   poprawny i bez zarzutu, i dokładnie dlatego brzmi jak maszyna. Wróć i popraw
   to, co daje tekstowi charakter, zamiast dalej szlifować poprawność.

To nie jest ozdobnik. Różnica między „tekst bez błędów" a „tekst napisany przez
człowieka" zwykle sprowadza się do dwóch–trzech miejsc w całym tekście.

## Co chronić bez zmian

- **Formatowanie i struktura** — markdown, HTML, frontmatter, nagłówki, listy,
  pogrubienia, kolejność bloków, podziały akapitów. Poprawiasz tekst *wewnątrz*
  struktury, nie strukturę.
- **Kod, linki, ścieżki, komendy** — nie ruszasz zawartości backticków ani
  bloków ``` ```. URL-e, adresy e-mail i nazwy plików przepisujesz znak w znak.
- **Zmienne i placeholdery** — `{{imie}}`, `%s`, `[LINK]`, `${var}`, `#hashtag`,
  `@wzmianka`, `[do uzupełnienia: ...]`.
- **Frazy kluczowe SEO** — dokładna forma frazy popytu zostaje w title, H1 i
  nagłówkach, nawet jeśli jest lekko nieporęczna gramatycznie. Wygładzasz zdanie
  *wokół* frazy, nigdy jej samej. Przy wątpliwości, która fraza jest kluczowa —
  zapytaj.
- **Nazwy własne, marki, cytaty, liczby, daty, emoji.**
- **Limity, jeśli projekt je ma** — np. meta title i description; sprawdź je po
  korekcie, bo skrócenie zdania potrafi wypaść z limitu w drugą stronę.
- **Mniej więcej ta sama długość.** Korekta to nie skracanie ani rozdmuchiwanie,
  chyba że użytkownik prosi.

## Social media

Te same markery, inna konwencja — nie formalizuj:

- Hak w pierwszej linii, krótkie akapity, entery i emoji zostają, jeśli autor
  ich użył. Hashtagi bez zmian.
- Celowa luźność, urwane zdania i kolokwializmy to głos, nie błąd.
- Lista zakazanych słów działa tu z podwójną siłą: LinkedIn jest miejscem, gdzie
  „thrilled to announce", „game-changer" i „z dumą ogłaszamy" demaskują post
  szybciej niż gdziekolwiek indziej. Jeśli post coś ogłasza, niech niesie to
  sam fakt.
- Bez myślnikowej interpunkcji — w krótkim poście zdradza AI natychmiast.
- Jedna myśl na post. Jeśli po korekcie puenta nadal siedzi w środku akapitu,
  zasygnalizuj to, zamiast przebudowywać post na własną rękę.

## Weryfikacja

Skaner liczy to, czego oko nie policzy — puść go **przed** korektą (mapa) i
**po** (kontrola). Znajdź go globem `**/humanize-content/scripts/scan.py` i
zapamiętaj ścieżkę jako `SCAN`:

```bash
python3 "$SCAN" ścieżka/do/pliku.md
python3 "$SCAN" plik.md --config .claude/humanize.md   # + zakazane słowa projektu
python3 "$SCAN" plik.md --json                          # do dalszego przetwarzania
echo "tekst" | python3 "$SCAN" -                        # ze stdin
```

Dla wklejonego tekstu zapisz go najpierw do pliku tymczasowego albo podaj przez
stdin — skaner nie przyjmuje tekstu jako argumentu.

Skrypt wykrywa język, pomija bloki kodu, frontmatter i URL-e, i raportuje:
gęstość myślników, rozkład i monotonię długości zdań, powtórzone łączniki i
otwarcia zdań, trójki, trafienia z list AI-tells (PL i EN), doklejone imiesłowy
i „-ing" clauses, łańcuchy dopełniaczy (PL), Title Case w nagłówkach, proste
błędy typograficzne.

To narzędzie diagnostyczne, nie sędzia. Trafienie w cytacie, w notatce roboczej
albo w terminie branżowym jest w porządku — decyduje kontekst, nie licznik.
Jeśli skryptu nie da się uruchomić, zrób ten sam przegląd czytając; skaner ma
oszczędzić czas, nie zablokować pracę.

## Format wyniku

Gdy pracujesz **na wklejonym tekście**: najpierw czysty poprawiony tekst gotowy
do skopiowania, z zachowanym formatowaniem oryginału, potem oddzielacz i
podsumowanie. Bez komentarzy wewnątrz samego tekstu — wszystkie uwagi idą do
podsumowania.

Gdy pracujesz **na plikach**: edytujesz je w miejscu i oddajesz samo
podsumowanie.

```
**Co poprawiłem:**
- myślniki: 11 → 2 (przecinki, dwukropki, 3 zdania rozbite na dwa)
- waciki: „kompleksowe rozwiązanie" → „system do rozliczeń podwykonawców"
- kalki: „w oparciu o" → „na podstawie"; „per stanowisko" → „osobno dla każdego stanowiska"
- rytm: rozbite 2 przeładowane zdania, usunięte powtórzone „Ponadto", przełamane 3 akapity otwarte nazwą produktu
- bez zmian: frazy SEO, liczby, struktura, notatki robocze, celowo urwane zdania w CTA
- do sprawdzenia: akapit 4 sugeruje wzrost o 40%, ale nie ma źródła
```

## Przypadki brzegowe

- **Tekst już naturalny** → drobne korekty albo zero zmian; napisz to wprost.
- **Bardzo krótki tekst** (jedno zdanie, komentarz, meta) → tym ostrożniej;
  często wystarczy jeden przecinek albo jedno słowo.
- **Mieszanka PL/EN** (tech, startup) → zostaw przyjęte anglicyzmy, popraw
  polską ramę zdania wokół nich. Anglicyzm oceniaj po odbiorcy: „deployment" i
  „roadmapa" są OK dla zespołu IT, ale dla dyrektora operacyjnego spoza IT
  „na roadmapie" → „w planach rozwoju".
- **Tekst pisany przez człowieka, nie AI** → markery AI w dużej części nie
  zadziałają; zostaje korekta językowa i rytm. Nie wciskaj tekstowi diagnozy,
  której nie ma.
- **Niejasny sens fragmentu** → nie zgaduj i nie wygładzaj na siłę; zostaw i
  zaznacz w podsumowaniu, że warto sprawdzić.
- **Tekst prawny, medyczny albo regulaminowy** → precyzja przed płynnością.
  Sformułowania, które wyglądają na sztywne, bywają wymagane. Nie upraszczaj
  sformułowań niosących zobowiązanie — zapytaj.
