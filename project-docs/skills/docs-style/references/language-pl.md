# Dokumentacja po polsku

Wszystko z `SKILL.md` obowiązuje tak samo. Tutaj są tylko te reguły, które w polskim tekście wyglądają inaczej niż w angielskim, oraz błędy, które w polskiej dokumentacji pojawiają się najczęściej.

Słownik nagłówków i statusów (co jest odpowiednikiem „Done when", „State today", „Accepted") jest w pliku, który znajdziesz globem `**/docs-init/references/headings.md`. Trzymaj się go dosłownie: jeden termin w całym drzewie, inaczej `spec/`, `plan/` i `adr/` przestają wyglądać jak jeden dokument.

## Typografia

- Cudzysłów polski: `„ "`. Nie `" "`, nie `» «`. W blokach kodu i nazwach pól zostaje to, co jest w kodzie.
- **Pauza (`—`) tylko tam, gdzie jest poprawną polską interpunkcją**: w miejsce opuszczonego orzeczenia („Pierwsza warstwa we froncie, druga — w aplikacji") albo we wtrąceniu. Jako uniwersalny klej między zdaniami składowymi jest najgłośniejszym sygnałem tekstu pisanego maszynowo. Zastępuje ją dwukropek, przecinek albo podział na dwa zdania. W komórkach tabel i w blokach kodu pauza jest w porządku.
- Półpauza (`–`) w zakresach: `2026-03-01 – 2026-03-13`, `40–80 linii`.
- Daty zawsze `RRRR-MM-DD`, nigdy słownie i nigdy względnie. „W przyszłym tygodniu" w pliku nic nie znaczy.
- Liczby z jednostką bez łamania wiersza między nimi tam, gdzie to możliwe: `90 dni`, `3 próby`.

## Czego nie piszemy po polsku

Te konstrukcje wchodzą do polskiego tekstu same i niosą zero informacji:

| Zamiast | Napisz |
|---|---|
| „warto zauważyć, że X" | „X" |
| „należy podkreślić, że X" | „X" |
| „w dzisiejszych czasach" | (usuń) |
| „posiada wsparcie dla" | „obsługuje" |
| „dokonuje weryfikacji" | „weryfikuje" |
| „w celu zapewnienia" | „żeby" |
| „umożliwia realizację procesu" | „pozwala zrobić" |
| „stanowi kluczowy element" | (usuń albo napisz, co konkretnie robi) |
| „zostało zaimplementowane przez" | „robi to" |
| „na chwilę obecną" | „dziś" albo data |

Przymiotniki, które oceniają zamiast opisywać, po polsku brzmią równie pusto: kluczowy, solidny, nowoczesny, potężny, kompleksowy, dedykowany, elastyczny.

## Pary źle / dobrze

**Rozgrzewka przed treścią**

Źle: „Niniejszy dokument ma na celu kompleksowe opisanie kluczowych aspektów procesu uwierzytelniania, który stanowi fundament bezpieczeństwa aplikacji."

Dobrze: „Najważniejszy dokument specyfikacji. Od działania mostu sesji zależy główna zasada produktowa: zamówienie złożone w aplikacji ma trafić na konto użytkownika."

**Twierdzenie bez pokrycia**

Źle: „API prawdopodobnie pilnuje ważności tokenu."

Dobrze: „API weryfikuje wyłącznie podpis: `validationConstraints` w `api/config/components.php` zawiera tylko `SignedWith`, więc token z przeterminowanym `exp` przechodzi."

**Myślnik w roli kleju**

Źle: „Aplikacja pobiera plik — zapisuje go w cache — i otwiera systemową przeglądarką."

Dobrze: „Aplikacja pobiera plik, zapisuje go w cache i otwiera systemową przeglądarką."

**Kryterium, którego nie da się sprawdzić**

Źle: „Gotowe, gdy ekran działa poprawnie."

Dobrze: „Gotowe, gdy 422 ze sklejonymi `<br />` zamienia się w czytelny komunikat."

**Strona bierna tam, gdzie wiadomo kto**

Źle: „Token zostaje zapisany w bezpiecznym magazynie."

Dobrze: „Aplikacja zapisuje token w `flutter_secure_storage`."

## Rytm

Krótkie zdania, jedna myśl w każdym, ale różnicuj długość. Trzy zdania po siedem słów pod rząd brzmią jak metronom i czyta się je gorzej niż jedno dłuższe z przecinkiem.

Polski szyk jest swobodniejszy niż angielski, więc kalka z angielskiego składu (orzeczenie zaraz po podmiocie, przydawka zawsze przed rzeczownikiem) daje tekst, który jest poprawny i jednocześnie brzmi obco. Czytaj zdanie na głos: jeśli nie powiedziałbyś tego tak przy tablicy, przestaw.

## Fałszywe alarmy skanerów stylu

Automat wyłapujący „markery AI" pomyli się w dokumentacji technicznej na czterech rzeczach. Nie poprawiaj ich:

- Nazwy własne i nazwy klas w nagłówkach (`WebView`, `PresenceRoom`, `OrderForm`).
- Numery sekcji czytane jako liczby dziesiętne (`5.1`, `4.3`).
- Pauzy w komórkach tabel — tam są w porządku.
- Wszystko wewnątrz bloków kodu.

Dłuższy tekst przed uznaniem za gotowy warto przepuścić przez `utils:humanize-content`, a rozdęty przez `utils:declutter`.
