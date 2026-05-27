# 12 — Filozofia produktu

**Załaduj gdy:** pytanie dotyczy strategii produktu, co budować, priorytetyzacji, relacji między produktem a przychodem, multiproduct platforms, dlaczego produkt poprzedza skalowanie sprzedaży.

## Product-led, merchant-first

Dwa nienegocjowalne filtry:

1. **Wszystko w produkcie musi służyć merchant outcome.** Jeśli feature jest technicznie elegancki, ale nie rusza igły dla merchanta albo end customera, nie należy do roadmapy.
2. **Merchanta nie obchodzi czysty kod.** Obchodzi go, że to działa, że jest niezawodne, że nie psuje mu dnia. Wewnętrzne piękno ma znaczenie tylko o tyle, o ile sprawia, że merchant outcome jest lepszy.

To nie znaczy: buduj brzydki kod. Skalowalność i utrzymywalność mają znaczenie — ale to są ograniczenia, nie cele. Celem jest merchant value.

> "Sometimes dev says 'this would be cleaner if we did it this other way'. I say: but this makes no sense for the merchant. We're building the product so the merchant gets the outcome — not so the code is pretty."

## Pułapka produktu we wczesnym etapie

Najtrudniejsza część wczesnoetapowej strategii produktowej: wybór, co budować *najpierw*, gdy wszystko wygląda na ważne.

Pułapka to gonić za feature'em z wysokim przychodem najpierw, bo unit economics dobrze wyglądają w arkuszu. Błąd: ten feature zwykle ma wysoką konkurencję, brak defensibility i nie składa się.

Ruch, który zrobił: zacznij od produktu, który ma *mały przychód per merchant*, ale jest *defensible*. Dla niego to była replacement karteczki z pieczątkami / loyalty. Nie mógłbyś wyciągnąć $1000/miesiąc za to z rogowej kawiarni — ale dawał ci:

- Network effect (więcej lokalizacji → więcej end-userów → więcej lokalizacji).
- Stickiness (dane są zamknięte na platformie, nie w POS merchanta).
- Foothold, z którego dodajesz wyższe-przychodowe feature'y później.

Potem, gdy masz foothold, dodajesz wyższe-przychodowe feature'y (ordering, tips, CRM, web ordering). Każdy się układa. Każdy zwiększa ARPU bez podnoszenia cen.

## Wzrost ARPU przez wartość, nie przez pricing

To centralna teza product-led-growth. Patrz `10-pricing-and-packages.md` dla pricingowego ujęcia. Ujęcie produktowe:

- Każdy nowy feature dodany do platformy to potencjalnie nowy strumień przychodu od istniejących klientów.
- Nowe kohorty klientów wchodzą *już płacąc więcej*, bo kupują bogatszy produkt dnia pierwszego.
- ARPU per lokalizacja kohorty 2025: +52% vs kohorta 2024. To nie podwyżka cen — to product-driven.

Strategiczna implikacja: wydaj engineering budget na feature'y, które materialnie rozszerzają to, co merchanci mogą robić na platformie. Nie na kosmetyczne poprawki istniejących feature'ów. Nie na wewnętrzne refaktoryzacje, które nie zmieniają merchant story.

## Multiproduct compounding

Single-product platform jest krucha. Wiele rzeczy może zakłócić twoje jedno źródło wartości.

Multiproduct platform trudno wypchnąć:

- Merchant używa cię do loyalty, CRM, ordering, tips.
- Konkurent pokazujący się z "robimy ordering lepiej" nie wypycha cię — wciąż masz pozostałe 3 moduły.
- Każdy moduł czyni inne bardziej sticky (klient, którego merchant zdobył przez loyalty, to ten sam klient, który składa zamówienie web).

To ten sam play co Revolut (patrz `13-long-term-game.md`) w innej skali: zacznij od jednego footholdu, potem rozszerz na sąsiednie moduły, które dzielą tę samą bazę user/merchant.

## Słuchaj feedbacku, nie bądź defensywny

> "Każdy feedback biorę bardzo, ale bardzo nie tak, że się wkurzam czy obrażam. Tylko jako super important. Bo on mnie napędza do tego, żeby robić jeszcze lepszy produkt."

Founderzy, którzy stają się defensywni wobec product feedbacku, sygnalizują albo ego, albo strach. Oba to czerwone flagi. Traktuj feedback jak surowiec — nie wszystko jest słuszne, ale najlepszy sygnał jest w środku.

To powiedziawszy: nie każdy feedback staje się featurem. Wciąż musisz priorytetyzować. Dyscyplina to:

- Przyjmij *cały* feedback.
- Przetwórz go przez soczewkę strategii.
- Zdecyduj, na co zareagujesz.
- Bądź gotowy powiedzieć "słyszymy was, ale nie teraz" — inwestorom, klientom, zespołowi.

## Logic-first product thinking

Nie musisz kodować, żeby prowadzić produkt (patrz `19-product-without-coding.md`). Musisz natomiast *rozumieć logikę* swojego produktu głęboko:

- Co jest połączone z czym.
- Co się zmienia kiedy.
- Gdzie są bottlenecki.
- Dlaczego konkretny flow istnieje.

Jeśli rozumiesz logikę, możesz wyłapywać okazje na feature'y, które pasują do systemu bez forsowania architektury, możesz prowadzić engineering, możesz znajdować kreatywne sposoby użycia części, które już masz, zamiast budować wszystko od zera.

## Widok "20% tego, czym mogliśmy być"

Wierzy, że produkt jest na około 20% tego, czym mógłby być. To nie niepewność — to product ambition.

Ten framing ma znaczenie:

- Trzyma zespół głodny. Zawsze jest więcej do zbudowania.
- Zarządza oczekiwaniami inwestorów: upside nie jest jeszcze wyceniony.
- Trzyma relację z klientem ciekawą: jest roadmapa, która sprawia, że dzisiejszy produkt wygląda mały.

Jeśli kiedykolwiek złapiesz się na mówieniu "produkt jest w zasadzie skończony", sprawdź się. Dla większości B2B SaaS to jest ostrzeżenie, że przestałeś pchać.

## Cadence priorytetyzacji

Realistycznie, nie idealistycznie. Nie wszystko można zrobić do jutra. Sprintuj to. Roadmapuj to. Komunikuj timeline'y klientom, którzy pytają o rzeczy, jasno, nawet gdy odpowiedź to "tak, ale Q3, nie Q1".

Klienci zaskakująco są OK z czekaniem, gdy wiedzą, że to nadchodzi. Frustrują się, gdy odpowiedź jest mglista.

## Co dev team powinien usłyszeć

- "Merchant outcome to brief. *Jak* — to wasze do zaprojektowania, róbcie to tak czysto i skalowalnie jak możecie, ale brief się nie zgina."
- "Jeśli widzicie sposób, żeby wypchnąć coś prostszego, co spełnia brief, zaproponujcie to. Pójdziemy prostszą drogą."
- "Jeśli myślicie, że feature w briefie tak naprawdę nie służy merchantowi — zaczepcie. Pogadamy."

## Stickiness jako product KPI

(Patrz `13-long-term-game.md` dla strategicznej wersji.) Z perspektywy produktu każdą decyzję feature'ową powinno się scorować na: czy to czyni merchanta *bardziej sticky*?

Net churn blisko 0,5% (gross sub-1%) — prawie niespotykane dla SMB SaaS — wychodzi z decyzji produktowych, nie z heroizmu CS. Każdy moduł, który dodaje się do codziennej rutyny merchanta, to kolejna ściana zapobiegająca odejściu.

To prawdziwa nagroda strategii multiproduct. Nie tylko wzrost ARPU — załamanie churn.
