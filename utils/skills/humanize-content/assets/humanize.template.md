# Konfiguracja humanize-content

Skopiuj ten plik do `.claude/humanize.md` w repo projektu i wypełnij sekcje,
które są dla projektu prawdziwe. **Usuń sekcje, których nie potrzebujesz** —
pusta sekcja to szum, a nie neutralny default. Wszystko, czego tu nie ma, skill
bierze z uniwersalnych zasad w SKILL.md.

---

## Język i odbiorca

- Języki treści: <!-- np. PL i EN, oba jako osobne mapy intencji, nie tłumaczenia -->
- Odbiorca: <!-- kto czyta; czy zna żargon IT; np. "właściciele biur nieruchomości, spoza IT" -->
- Formy adresatywne: <!-- np. "Ty" wielką literą w PL; second person w EN; nigdy "Państwo" -->

## Głos marki

<!-- Dwa–trzy zdania, jak marka mówi. Konkretnie, nie przymiotnikami.
     Zły przykład: "profesjonalnie i przyjaźnie".
     Dobry przykład: "jak inżynier, nie handlowiec — krótkie zdania, konkret,
     liczba zamiast przymiotnika, zero korpomowy". -->

Wskaźnik do pełnego dokumentu (opcjonalnie): <!-- docs/brand/voice.md -->

## Zakazane słowa

<!-- Skill czyta punkty pod tym nagłówkiem i sprawdza je skanerem.
     Format: termin → zamiennik (zamiennik opcjonalny).
     Trzymaj listę krótką i realną — 10 słów, których naprawdę nie chcesz. -->

- kompleksowy → konkret: co dokładnie system robi
- dedykowany → własny / osobny / pod Twoją firmę
- innowacyjny → usuń albo pokaż liczbę
- synergia
- wartość dodana
- cutting-edge
- world-class
- seamless
- best-in-class
- state-of-the-art

Dozwolony wyjątek: <!-- np. cytat czerwonej flagi, przed którą ostrzegamy;
                        dosłowne pytanie z "People Also Ask" w FAQ -->

## Polityka myślników

- PL: <!-- domyślnie: maks. 1 pauza na akapit. Opcje: "zero w treści publikowalnej" / "bez limitu" -->
- EN: <!-- domyślnie: maks. 1 em dash na ~200 słów -->

## Konwencje

- Nagłówki: <!-- sentence case (domyślnie) / Title Case -->
- Przecinek seryjny (EN): <!-- tak / nie -->
- Pisownia EN: <!-- US / UK -->
- Cudzysłów PL: <!-- „ ” (domyślnie) -->

## Twarde limity

<!-- Skill sprawdza je po korekcie — skrócenie zdania potrafi wypaść z limitu. -->

- Meta title: <!-- np. ≤ 48 znaków przed sufiksem " | Marka" -->
- Meta description: <!-- np. ≤ 160 znaków -->
- Excerpt: <!-- np. ≤ 160 znaków -->

## Terminy nietykalne

<!-- Nazwy produktów, skróty branżowe i anglicyzmy, których skill ma NIE tłumaczyć
     ani nie "poprawiać". -->

- <!-- np. CRM, SaaS, API, webhook, lead, pipeline, churn -->

## Czego nie ruszać w plikach

<!-- Jeśli treść mieszka w plikach z notatkami roboczymi, wypisz, co jest robocze.
     Skill poprawia tylko treść publikowalną. -->

- Sekcje: <!-- np. nagłówek dokumentu ze statusem, checklisty wdrożeniowe -->
- Ścieżki pomijane: <!-- np. docs/internal/**, CHANGELOG.md -->

## Ścieżki treści publikowalnej

<!-- Opcjonalnie: gdzie leży copy, żeby skill nie zgadywał. -->

- <!-- np. src/content/**/*.md, docs/marketing/**/*.md -->
