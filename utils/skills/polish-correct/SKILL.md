---
name: polish-correct
description: Poprawia wskazany polski tekst stylistycznie, gramatycznie i interpunkcyjnie tak, żeby brzmiał naturalnie — usuwa „sztuczność" typową dla tekstów generowanych przez AI (kalki z angielskiego, nadużywane zaimki i dzierżawcze, „posiadać", nominalizacje, puste waciki marketingowe, monotonny rytm), poprawia szyk wyrazów oraz polską interpunkcję (przecinki przed że/który/aby, cudzysłów „", półpauzy, liczby, kapitalizacja). Zachowuje sens, ton, rejestr, długość, formatowanie, linki, słowa kluczowe SEO i przeznaczenie tekstu (email, wpis na blog, opis SEO, komentarz, post, ogłoszenie). Używaj zawsze, gdy użytkownik prosi o poprawienie, redakcję, korektę, dopracowanie lub „uczłowieczenie" polskiego tekstu, mówi że coś „brzmi sztucznie", „jak z AI", „nienaturalnie", „drętwo", chce poprawić styl, gramatykę, szyk albo interpunkcję po polsku, dopracować polski email/blog/opis/post, albo wywołuje /polish-correct. Nie tłumacz i nie dopisuj treści — popraw tylko to, co już jest.
argument-hint: "[tekst do poprawy lub ścieżka do pliku]"
---

# Polish Correct

Popraw polski tekst tak, żeby brzmiał, jakby napisał go uważny native speaker — naturalnie, płynnie, z poprawnym szykiem i interpunkcją. Najczęstszy materiał wejściowy to treść wygenerowana przez AI: poprawna „na papierze", ale drętwa, przekalkowana z angielskiego i naszpikowana wacikami. Twoim zadaniem jest zdjąć tę sztuczność, **nie** przepisać tekstu od nowa.

## Zasada nadrzędna: popraw, nie przepisuj

To jest korekta, a nie tworzenie nowej treści. Łatwo „ulepszyć" tekst tak bardzo, że zniknie jego sens, ton albo głos autora — i to jest największe ryzyko tego skilla. Dlatego trzymaj się granic:

- **Sens zostaje nietknięty.** Nie dodawaj faktów, liczb, argumentów ani tez, których nie było. Nie usuwaj informacji. Jeśli coś jest merytorycznie wątpliwe, nie poprawiaj tego po cichu — zostaw i zasygnalizuj w podsumowaniu.
- **Ton i rejestr 1:1.** Nie zmieniaj poziomu formalności. Formalny email zostaje formalny, luźny komentarz zostaje luźny, marketing zostaje marketingiem. Poprawiasz poprawność i płynność *w obrębie* istniejącego rejestru — nie podnosisz ani nie obniżasz go.
- **Przeznaczenie zostaje.** Email ma dalej być emailem, opis SEO opisem SEO, wpis na blog wpisem na blog. Rozpoznaj typ tekstu i pisz tak, jak w nim się pisze (patrz „Typy tekstu").
- **Głos autora zostaje.** Jeśli tekst ma charakter — celowo krótkie zdania, ironię, kolokwializmy, branżowy żargon — to nie jest błąd do wygładzenia. Usuwasz *sztuczność*, nie *charakter*.
- **Nie tłumacz.** Wejście po polsku → wyjście po polsku. Akceptowane w danej branży anglicyzmy (np. „deployment", „feature", „brief", „lead") zostają, jeśli brzmią naturalnie w tym kontekście — nie zastępuj ich na siłę sztucznymi polskimi neologizmami.
- **Gdy tekst jest już dobry — zostaw go.** Nie poprawiaj na siłę, żeby „coś zrobić". Lepiej oddać tekst prawie nietknięty z notką „brzmi naturalnie, drobne korekty", niż zmienić zdania, które były w porządku.

## Jak pracować

1. **Zdobądź tekst.** Jeśli jest w `$ARGUMENTS` — pracuj na nim. Jeśli argument wygląda jak ścieżka do pliku (`.md`, `.txt`, `.html`…), wczytaj go. Jeśli nie podano tekstu, poproś użytkownika o wklejenie.
2. **Przeczytaj całość najpierw.** Rozpoznaj typ tekstu, rejestr, ton i głos autora, zanim cokolwiek zmienisz. Bez tego nie da się poprawiać „1:1".
3. **Popraw zdanie po zdaniu**, mając z tyłu głowy katalog markerów (niżej). Najpierw poprawność (gramatyka, interpunkcja), potem naturalność (szyk, płynność, odkalkowanie, waciki).
4. **Przeczytaj poprawioną całość na głos w głowie.** Tu wyłapiesz rytm: monotonię, powtórzenia, zdania, które się o siebie potykają. Native speaker słyszy tekst — Ty też tak go sprawdź.
5. **Zachowaj wszystko, co nie jest językiem** (patrz „Co zachować bez zmian").
6. **Oddaj wynik** w formacie z sekcji „Format wyniku".

## Co zachować bez zmian

Te elementy przepisuj znak w znak — ich zmiana to błąd, nie poprawka:

- **Formatowanie i struktura** — markdown, HTML, nagłówki, listy, pogrubienia, akapity, podziały. Poprawiasz tekst *wewnątrz* struktury, nie strukturę.
- **Linki, adresy, ścieżki, kod** — URL-e, e-maile, bloki i fragmenty kodu, nazwy plików, komendy. Nie ruszaj zawartości backticków ani bloków ``` ```.
- **Zmienne i placeholdery** — `{{imie}}`, `%s`, `[LINK]`, `${var}`, `#hashtag`, `@wzmianka`. Zostają dokładnie tam, gdzie są.
- **Słowa kluczowe SEO** — fraza kluczowa zostaje w swojej formie, nawet jeśli jest lekko nieporęczna gramatycznie. Wygładź zdanie *wokół* frazy, ale jej nie parafrazuj — w SEO liczy się dokładne dopasowanie. W razie wątpliwości, którą frazę traktować jako kluczową, zapytaj.
- **Nazwy własne, marki, cytaty, dane** — nie „poprawiaj" nazwy firm, produktów, liczb, dat ani cytowanych wypowiedzi.
- **Emoji i długość** — zachowaj emoji i mniej więcej tę samą długość. Korekta nie jest skracaniem ani rozdmuchiwaniem (chyba że użytkownik prosi).

## Na czym polega „sztuczność" polskiego AI — i jak ją usuwać

To jest rdzeń skilla. Poniżej najczęstsze, najwyżej punktowane markery. Pełniejszy katalog z dziesiątkami przykładów: **`references/markery-ai.md`** — zajrzyj tam, gdy chcesz głębiej albo trafisz na wzorzec spoza tej listy.

### 1. Nadużywane zaimki i dzierżawcze (kalka z angielskiego) — marker #1
Polski jest językiem pro-drop: pomija podmiot, gdy wynika z odmiany, i pomija zaimki dzierżawcze, gdy przynależność jest oczywista. AI kalkuje angielskie „I / your / their".
- „**Ja** uważam, że to zadziała" → „Uważam, że to zadziała"
- „Umyj **swoje** ręce" → „Umyj ręce"
- „Nasz produkt pomoże **Twojej** firmie zwiększyć **Twoje** przychody" → „Nasz produkt pomoże firmie zwiększyć przychody"
Zostaw zaimek tylko tam, gdzie realnie buduje kontrast albo bezpośredni zwrot (w emailu „Dziękujemy za **Twoją** wiadomość" bywa potrzebne) — wycinaj redundancję, nie każdy zaimek.

### 2. „posiadać" i urzędowe czasowniki zamiast zwykłych
- „Aplikacja **posiada** funkcję eksportu" → „Aplikacja **ma** funkcję eksportu" / „W aplikacji wyeksportujesz dane"
- „**dokonać** rezerwacji" → „zarezerwować"; „**dokonać** wyboru" → „wybrać"; „**realizować** płatność" → „zapłacić"

### 3. Nominalizacja zamiast czasowników (rzeczownikowy styl urzędniczy)
Polski oddycha czasownikami. AI piętrzy rzeczowniki odczasownikowe.
- „**w celu zwiększenia** sprzedaży" → „żeby zwiększyć sprzedaż"
- „**poprzez wykorzystanie** narzędzia" → „dzięki narzędziu" / „korzystając z narzędzia"
- „umożliwia **przeprowadzenie analizy**" → „pozwala przeanalizować"

### 4. Kalki frazeologiczne i nadużywane słowa
- „**w oparciu o**" → „na podstawie"
- „**być w stanie**": „jesteśmy w stanie dostarczyć" → „możemy dostarczyć" / „dostarczymy"
- „**dedykowany**" (w sensie: specjalny/osobny) → „przeznaczony", „osobny", „specjalny" (zostaw w utartych terminach IT, np. „serwer dedykowany")
- „**adresować** problem" → „zająć się problemem", „rozwiązać"
- „aplikacja **wspiera** format PDF" → „obsługuje format PDF"
- „narzędzie **dla** automatyzacji" → „narzędzie **do** automatyzacji" (przyimek „dla" to nie angielskie „for" celu)
- „na końcu dnia" → „ostatecznie", „koniec końców"

### 5. Marketingowe waciki i puste otwarcia
Wycinaj wypełniacze, które nic nie wnoszą, albo zamieniaj je na konkret.
- Puste przymiotniki: „innowacyjny", „nowoczesny", „kompleksowy", „dynamiczny", „szyty na miarę", „szeroki wachlarz", „dedykowane rozwiązania"
- Puste otwarcia: „W dzisiejszych czasach…", „W erze cyfrowej…", „Warto zaznaczyć, że…", „Należy pamiętać, że…", „Nie da się ukryć, że…"
- Pleonazmy: „okres czasu" → „okres"/„czas"; „cofać się do tyłu" → „cofać się"; „kontynuować dalej" → „kontynuować"

### 6. Szyk wyrazów
- **Przymiotnik klasyfikujący idzie PO rzeczowniku** (nazywa rodzaj/kategorię), a nie przed jak w angielskim: „**polski język**" → „język polski"; „elektroniczna poczta" → „poczta elektroniczna"; „graficzna karta" → „karta graficzna". (Przymiotnik oceniający zostaje przed: „piękny dzień", „szybki samochód".)
- **Ważna/nowa informacja na końcu zdania** (pozycja rematu). Polski porządkuje zdanie wg tego, co znane → co nowe, a nie sztywno SVO jak angielski. Jeśli zdanie brzmi „przetłumaczone", często wystarczy przesunąć nową informację na koniec.
- **„się", „by" i krótkie zaimki** (mi, ci, go, mu) unikają początku i końca zdania, lgną do drugiej pozycji: „Warto zastanowić **się** nad tym" → „Warto **się** nad tym zastanowić".

### 7. Monotonny rytm i powtarzane łączniki
AI pisze zdania jednakowej długości i spina je w kółko tymi samymi słowami: „Ponadto", „Co więcej", „Dodatkowo", „Podsumowując", „Niewątpliwie". Różnicuj długość zdań, redukuj powtórzone łączniki, łącz lub dziel zdania, żeby tekst miał oddech. To często najważniejsza zmiana dla „naturalności".

## Interpunkcja po polsku

Najczęstsze błędy (kalki z angielskiego). Pełna ściąga: **`references/interpunkcja.md`**.

- **Przecinek przed zdaniem podrzędnym** — obowiązkowy przed „że, który, gdy, jeśli, ponieważ, bo, aby, żeby, choć": „Myślę że to zadziała" → „Myślę, że to zadziała".
- **Bez „przecinka oksfordzkiego"** przed pojedynczym „i / oraz / lub / albo / ani": „szkolenia, i dokumentację" → „szkolenia i dokumentację".
- **Polski cudzysłów** „ " (dolny otwierający, górny zamykający), nie angielski " ": `"Zapisz"` → `„Zapisz"`.
- **Półpauza – w zakresach i jako myślnik** (nie dywiz `-`): „2020-2024" → „2020–2024"; dywiz zostaje w złożeniach: „biało-czerwony", „Bielsko-Biała".
- **Liczby po polsku**: przecinek dziesiętny „3,5" (nie „3.5"); procent bez spacji „20%"; jednostki ze spacją „5 kg", „10 zł"; tysiące spacją „1 000 000".
- **Wielokropek** to jeden znak „…", nie trzy kropki.

## Kapitalizacja

- **Nagłówki i tytuły po polsku to sentence case** — wielka tylko pierwsza litera, nie Title Case jak w angielskim: „Jak Zwiększyć Konwersję" → „Jak zwiększyć konwersję".
- **Małą literą**: dni tygodnia („poniedziałek"), miesiące („marzec"), nazwy języków i przymiotniki narodowości („polski", „angielski"), „internet". (Rzeczowniki: „Polak", „Niemka" — wielką.)

## Typy tekstu (dopasuj sposób pisania, nie rejestr)

Rozpoznaj typ i pisz zgodnie z jego konwencją — ale formalność trzymaj taką, jaka była:
- **Email** — zwięzłość, naturalne zwroty grzecznościowe, spójne „Pan/Pani" albo „Ty" w całym tekście (nie mieszaj).
- **Wpis na blog** — płynność, oddech między akapitami, mniej wacików niż w marketingu.
- **Opis / tekst SEO** — chroń frazy kluczowe (patrz wyżej), reszta ma brzmieć naturalnie, nie keyword-stuffingowo.
- **Komentarz / post** — krótko i swobodnie; nie formalizuj, nie „porządkuj" celowej luźności.

## Format wyniku

Najpierw **poprawiony tekst** — czysty, gotowy do skopiowania, z zachowanym formatowaniem oryginału. Potem oddzielacz i **krótkie podsumowanie zmian**: 3–6 punktów pogrupowanych wg rodzaju, nie wyliczanka każdego przecinka. Jeśli zmian było dużo, podsumuj kategoriami („szyk wyrazów w kilku zdaniach", „usunięte zaimki dzierżawcze"). Jeśli tekst był już dobry — powiedz to wprost.

```
[poprawiony tekst — gotowy do wklejenia]

---
**Co poprawiłem:**
- naturalniejszy szyk w 2 zdaniach (nowa informacja na końcu)
- „posiada" → „ma", „w oparciu o" → „na podstawie"
- usunięte zbędne „Twój/swój" (kalka z angielskiego)
- przecinki przed „że" i „który"; cudzysłów „"
```

Gdy tekst jest długi albo ma wyraźną strukturę, możesz oddać go w bloku, żeby łatwo było skopiować ze znacznikami. Nie dorzucaj komentarzy wewnątrz samego tekstu — wszystkie uwagi idą do podsumowania.

## Przypadki brzegowe

- **Tekst już naturalny** → drobne korekty lub zero zmian; w podsumowaniu napisz, że brzmi dobrze.
- **Bardzo krótki tekst** (komentarz, jedno zdanie) → tym ostrożniej; często wystarczy przecinek albo jedno słowo.
- **Mieszanka PL/EN** (tech, startup) → zostaw przyjęte anglicyzmy, popraw polską ramę zdania wokół nich.
- **Kod, linki, dane** w tekście → przepisz bez zmian, poprawiaj tylko prozę dookoła.
- **Niejasny sens fragmentu** → nie zgaduj i nie wygładzaj na siłę; zostaw i zaznacz w podsumowaniu, że warto sprawdzić.
