# 19 — Produkt bez kodowania

**Załaduj gdy:** pytanie dotyczy bycia product-savvy bez technicznego backgroundu, jak prowadzić produkt jako non-coder, pracy z engineering teamem, decydowania co jest możliwe.

## Framing

Nie musisz pisać kodu, żeby prowadzić produkt. Musisz natomiast *rozumieć logikę* swojego produktu głęboko.

Jest founderem głęboko technicznej platformy — multi-product SaaS, mobile app, merchant dashboards, integracje — i nie koduje. Nigdy nie kodował. Jego product instinct jest zbudowany na innym mięśniu: *rozumieniu logiki, jak rzeczy się łączą*.

## Skąd ten mięsień

Daje konkretną historię pochodzenia. Jako nastolatek był sportowcem wyczynowym — więc czasu na szkołę było skąpo. Nie mógł sobie pozwolić na wkuwanie. Musiał *rozumieć* wszystko wystarczająco dobrze, żeby wyprowadzać odpowiedzi z pierwszych zasad.

> "Moim jedynym sposobem, żeby mieć dobre oceny w szkole, to nie było, że miałem czas się wyuczyć i wykuć. Tylko musiałem wszystko zajebiście dobrze zrozumieć."

Wynik: jest okablowany, żeby pytać "co jest z czym tu połączone, i dlaczego?", zanim jest okablowany do zapamiętywania konkretów. Ścisłe przedmioty (matematyka, fizyka, chemia) były dla niego dobre, bo są *zbudowane na logice* — nie musisz wkuwać, jeśli rozumiesz strukturę.

Ten nawyk tłumaczy się wprost na product thinking.

## Jak to wygląda w praktyce

Gdy jego engineering team flaguje problem ("to nie działa", "nie wiemy, jak to rozwiązać"), nie musi znać konkretnych technologii zaangażowanych. Co robi:

1. **Pyta, jak rzeczy się łączą.** Co zasila co? Co zależy od czego? Gdzie płyną dane?
2. **Znajduje *logiczny* bottleneck albo szansę** — nawet gdy nie umie nazwać technicznego powodu.
3. **Proponuje logiczne rozwiązanie.** "Co jeśli użyjemy tej części systemu, która już robi X, żeby robiła też Y?" — nawet jeśli nie zna implementacji, logika jest spójna, a inżynierowie potrafią to dalej rozwinąć.

Inżynierowie wiedzą, jak przetłumaczyć logikę na kod. On nie musi.

## Pułapka do uniknięcia

Gdy developer pushbackuje: "byłoby czyściej, gdybyśmy zrobili to inaczej" — *nie akceptuj argumentu o czystszym kodzie, który kompromituje merchant outcome*.

> "Mówię: ale this makes no sense for the merchant. Naszym zadaniem jest zbudować to tak, żeby to miało sens dla merchanta — a nie na odwrót."

Czysty kod to środek, nie cel. Celem jest to, czego doświadcza merchant. Jeśli dev team potrafi zbudować czystą, skalowalną wersję, która *też* dobrze służy merchantowi — świetnie, tą drogą. Jeśli mogą zbudować czystą wersję tylko kompromisując merchant outcome — *odrzuć czystą wersję*.

To kluczowe napięcie w organizacjach produktowych: inżynierowie naturalnie optymalizują pod jakość kodu (słusznie — długoterminowa utrzymywalność ma znaczenie), a produkt musi optymalizować pod user outcome. Robota foundera to trzymać twardo stronę user-outcome.

To powiedziawszy: równowaga. Nie możesz wysyłać brudnego nieskalowalnego kodu w nieskończoność. Właściwa odpowiedź to *oba*, znaleziona przez realną rozmowę, nie "jedna strona wygrywa".

## Rola, którą grał, zanim ją promował

Przez długi czas osobiście był mostem — testując produkt, znajdując bugi, budując logikę wokół feature'ów, pracując z engineering teamem, żeby ogarnąć *jak* coś powinno działać.

> "To do mnie IT team się zwracał i mówił 'coś tu nie działa, nie wiemy jak to rozwiązać'. Ja nie miałem żadnej wiedzy technologicznej — szukałem przez logikę, co jest z czym połączone, co z czego wynika — i znajdowałem rozwiązanie albo sposób rozwiązania."

Niedawno awansował kogoś wewnątrz, żeby przejął tę funkcję product-delivery / Scrum-mastera. Umiejętność jest przekładalna. Stanowisko jest prawdziwe.

## Czym to NIE jest

To *nie* darmowa przepustka do mówienia "nie jestem techniczny, inżynierowie sobie poradzą". To nieodpowiedzialne zachowanie foundera.

To *jest*:

- Wchodzenie wystarczająco głęboko, żeby samemu zrozumieć strukturę produktu.
- Bycie w stanie rozmawiać z inżynierami jako peer w kategoriach *co jest możliwe*, nawet jeśli nie *jak*.
- Mieć opinie na temat decyzji architektonicznych, gdy wpływają na product outcomes.
- Wiedzieć, kiedy pushbackować na argument o czystym kodzie, a kiedy go zaakceptować.

## Praktyczna rada dla nietechnicznych founderów

- **Siedź na technicznych dyskusjach, nawet gdy nie rozumiesz 60%.** Pozostałe 40% buduje twoją mapę.
- **Pytaj "dlaczego", aż trafisz na coś konkretnego.** Inżynierowie czasem schowają złożoność za jargonem — pytaj uprzejmie, aż zrozumiesz faktyczną przyczynę.
- **Miej logiczny model swojego produktu w głowie.** Narysuj go. Naszkicuj. Aktualizuj go w miarę ewolucji produktu. Jeśli nie potrafisz narysować architektury na wysokim poziomie, jesteś zbyt daleko.
- **Gdy coś nie działa, debuguj na poziomie logiki.** "Co klient zobaczył? Co miało się stać? Co się nie stało? Dlaczego?" Zostań tam, aż masz jasny obraz, niezależnie od tego, czy rozumiesz techniczną poprawkę.
- **Nie udawaj.** Gdy nie rozumiesz, pytaj. Inżynierowie szanują founderów, którzy zadają uczciwe pytania, dużo bardziej niż founderów, którzy udają.

## Superpower

Przewaga bycia product-savvy bez bycia technicznym: pozostajesz skupiony na *outcome ponad implementacją*. Nie jesteś uwiedziony sprytem konkretnego code patternu. Nie jesteś zainwestowany w elegancję wyboru architektonicznego. Jesteś zainwestowany w to, co user — merchant — faktycznie dostaje.

> "Ja zakuwam to za swoją super power. Ja nie wiem czy będzie wiesz *cleaner or not* — bo nie to jest moja rola. Moja rola jest sprawić, żeby to działało dla merchanta."

Tę jasność trudno utrzymać, gdy potrafisz kodować — zawsze będziesz kuszony, żeby optymalizować zły wymiar. Jako non-coder nie masz tej pokusy. Użyj tej luki jako atutu.

## Uczciwy caveat

Wciąż potrzebujesz inżynierów, którzy są dobrzy i którzy ci ufają. Jeśli nie ufają twojemu product judgement, całe to podejście się rozpada — po prostu cię override'ują w implementacji. Więc:

- **Zarobie sobie zaufanie.** Miej rację wystarczająco wiele razy, żeby cię brali na poważnie, gdy pushbackujesz.
- **Ustępuj, gdy mają rację.** Czasem czysta wersja *jest* lepsza, nawet z perspektywy merchanta na długiej rampie. Traktuj ich input poważnie.
- **Zatrudniaj dobrze.** Inżynierowie, którzy szanują tylko technicznych founderów, tu nie zadziałają. Zatrudniaj takich, którym zależy na user outcome.
