# Heading and status vocabulary

The tree has the same structure in every language; only the strings differ. Take them from here rather than translating on the fly — a document where "Done when" became "Gotowe, gdy" in one file and "Ukończone, gdy" in another stops reading as one document, and every skill that greps for a label breaks.

Adding a third language means adding a column, not a second set of templates.

## Structure

| Slot | English | Polski |
|---|---|---|
| docs index title | Documentation: `<project>` | Dokumentacja: `<projekt>` |
| how to use | How to use these documents | Jak korzystać |
| specification section | Specification | Specyfikacja |
| plan section | Work plan | Plan prac |
| ADR section | Architecture decisions | Decyzje architektoniczne |
| conventions | Conventions | Konwencje |
| document column | Document | Dokument |
| contents column | Contents | Zawartość |

## Specification

| Slot | English | Polski |
|---|---|---|
| overview file title | 00. Overview and scope | 00. Przegląd i zakres |
| document information | Document information | Informacje o dokumencie |
| field / value | Field / Value | Pole / Wartość |
| project | Project | Projekt |
| repository | Repository | Repozytorium |
| created | Created | Data utworzenia |
| status | Status | Status |
| purpose | Purpose | Cel |
| guiding principle | Guiding principle | Główna zasada |
| scope | Scope of version 1 | Zakres wersji 1 |
| out of scope | Out of scope in version 1 | Poza zakresem wersji 1 |
| in-scope column | In scope | W zakresie |
| reason column | Reason | Uzasadnienie |
| users | Users | Użytkownicy |
| role / need | Role / Need | Rola / Potrzeba |
| success criteria | Success criteria | Kryteria sukcesu |
| environments | Environments | Środowiska |
| glossary | Glossary | Słownik |
| term / meaning | Term / Meaning | Termin / Znaczenie |
| open questions | Open questions | Otwarte kwestie |
| what settles it | What will settle it | Co to rozstrzygnie |
| dependencies file title | NN. Dependencies in other repositories | NN. Zależności w innych repozytoriach |
| blocks release column | Blocks release | Blokuje v1 |
| status values | not raised / raised / in progress / done | nie zgłoszone / zgłoszone / w toku / gotowe |

## ADR

| Slot | English | Polski |
|---|---|---|
| register file title | Architecture decisions (ADR) | Decyzje architektoniczne (ADR) |
| rules | Rules | Zasady |
| register | Register | Rejestr |
| decision column | Decision | Decyzja |
| date column | Date | Data |
| applies to | Applies to | Dotyczy |
| context | Context | Kontekst |
| decision | Decision | Decyzja |
| consequences | Consequences | Konsekwencje |
| positive | Positive | Pozytywne |
| negative | Negative | Negatywne |
| requirements | Requirements | Wymagania |
| options considered | Options considered | Rozważane warianty |
| option column | Option | Wariant |
| why rejected | Why rejected | Dlaczego odrzucony |
| when to revisit | When to revisit | Kiedy wrócić do tej decyzji |
| amendment section | Amendment (YYYY-MM-DD) | Sprostowanie (RRRR-MM-DD) |
| template pointer | Template | Szablon |

### Statuses

| English | Polski |
|---|---|
| Proposed | Propozycja |
| Accepted | Zaakceptowany |
| Open | Otwarty |
| Rejected | Odrzucony |
| Superseded by ADR-NNNN | Zastąpiony przez ADR-NNNN |
| Supersedes ADR-NNNN | Zastępuje ADR-NNNN |

## Plan

| Slot | English | Polski |
|---|---|---|
| plan index title | Work plan | Plan prac |
| files | Files | Pliki |
| task format | Task format | Format zadania |
| identifiers and commits | Identifiers and commits | Identyfikatory i commity |
| definition of done | Definition of done | Definicja ukończenia |
| how to assign work | How to assign work | Jak zlecać pracę |
| what is not in this plan | What is not part of this plan | Czego w planie nie ma |
| **task: dependency** | Depends on | Zależy od |
| **task: blocker** | Blocker | Blokada |
| **task: condition** | Done when | Gotowe, gdy |
| **task: completion note** | Done YYYY-MM-DD. | Zrobione RRRR-MM-DD. |
| spec link label | Spec | Spec |
| ADR link label | ADR | ADR |
| milestone goal | Goal | Cel |
| milestone outcome | End of milestone | Koniec etapu |
| external dependencies | External dependencies | Zależności zewnętrzne |
| tasks | Tasks | Zadania |
| notes | Notes | Uwagi |

## Roadmap

| Slot | English | Polski |
|---|---|---|
| file title | Roadmap | Roadmap |
| entry point section | State today | Stan na dziś |
| current milestone row | Milestone | Etap |
| last completed row | Last completed | Ostatnio ukończone |
| next row | Next | Następne |
| milestones table | Milestones | Etapy |
| milestone column | Milestone | Etap |
| file column | File | Plik |
| goal column | Goal | Cel |
| outcome column | What works at the end | Co działa na końcu |
| progress column | Progress | Postęp |
| ordering rationale | Why this order | Dlaczego w tej kolejności |
| risks | Risks pulled ahead of the queue | Ryzyka wyciągnięte przed kolejkę |
| risk column | Risk | Ryzyko |
| mitigation column | What we do | Co robimy |
| when column | When | Kiedy |
| absent from plan | What is not in the plan | Czego w planie nie ma |

## What never translates

- `CLAUDE.md` — its content stays English, because it is read from sibling repositories where that convention already holds.
- Commit messages.
- Code identifiers, file paths, field names, endpoint paths, and anything inside a code block.
- The date format `YYYY-MM-DD`. Polish documents may *describe* it as `RRRR-MM-DD` in prose, but the dates themselves are written `2026-08-04`.
- The task id prefix and the milestone labels `M0`, `M1`.

Everything else translates, including ADR filenames: `0002-native-auth-and-session-bridge.md` becomes `0002-uwierzytelnianie-natywne-i-most-sesji.md`.
