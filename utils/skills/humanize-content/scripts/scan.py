#!/usr/bin/env python3
"""Skaner markerów AI dla tekstów PL i EN.

Liczy to, czego oko nie policzy: gęstość myślników, monotonię długości zdań,
powtórzone łączniki i otwarcia, trójki, trafienia z list AI-tells, doklejone
imiesłowy, łańcuchy dopełniaczy, Title Case w nagłówkach i typografię.

Narzędzie diagnostyczne, nie sędzia — trafienie w cytacie, notatce roboczej albo
terminie branżowym jest w porządku. Kod, frontmatter, URL-e i linki są pomijane.

Użycie:
    python3 scan.py plik.md [plik2.md ...]
    python3 scan.py plik.md --config .claude/humanize.md
    python3 scan.py plik.md --json
    echo "tekst" | python3 scan.py -
"""

from __future__ import annotations

import argparse
import bisect
import json
import re
import sys
from pathlib import Path

# --------------------------------------------------------------------------
# Maskowanie tego, czego nie poprawiamy
# --------------------------------------------------------------------------

MASK_PATTERNS = [
    re.compile(r"\A---\n.*?\n---\n", re.DOTALL),          # frontmatter YAML
    re.compile(r"```.*?```", re.DOTALL),                   # bloki kodu
    re.compile(r"~~~.*?~~~", re.DOTALL),
    re.compile(r"`[^`\n]+`"),                              # kod inline
    re.compile(r"<[^>\n]{1,200}>"),                        # tagi HTML
    re.compile(r"\bhttps?://\S+"),                         # URL-e
    re.compile(r"\]\([^)\n]*\)"),                          # cele linków md
    re.compile(r"^\s{4,}\S.*$", re.MULTILINE),             # bloki wcięte
    re.compile(r"\{\{[^}]*\}\}|\$\{[^}]*\}|%[sd]\b"),      # placeholdery
]


def mask(text: str) -> str:
    """Zastępuje niepoprawiane fragmenty spacjami, zachowując offsety i linie."""
    chars = list(text)
    for pattern in MASK_PATTERNS:
        for m in pattern.finditer(text):
            for i in range(m.start(), m.end()):
                if chars[i] != "\n":
                    chars[i] = " "
    return "".join(chars)


# --------------------------------------------------------------------------
# Podstawowa analiza tekstu
# --------------------------------------------------------------------------

WORD_RE = re.compile(r"[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż0-9'’-]*")
PL_DIACRITICS = set("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ")
PL_STOPWORDS = re.compile(
    r"\b(i|w|z|ze|na|do|nie|to|się|jest|są|że|dla|jak|po|od|przez|ale|oraz|już|tylko)\b",
    re.IGNORECASE,
)
EN_STOPWORDS = re.compile(
    r"\b(the|and|of|to|in|is|are|for|with|you|your|that|it|this|we|our|from|but)\b",
    re.IGNORECASE,
)

ABBREV = re.compile(
    r"\b(np|itp|itd|tzn|tj|m\.in|ok|godz|ul|dr|mgr|inż|prof|str|zob|por|"
    r"e\.g|i\.e|etc|vs|Mr|Mrs|Ms|Dr|Prof|St|Inc|Ltd|approx|fig)\.",
    re.IGNORECASE,
)
DOT = "\x00"  # sentinel: kropka skrótu, nie koniec zdania
SENT_SPLIT = re.compile(r"[.!?…]+[\"'”»)]?\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ„«\"'(])")


def detect_language(text: str) -> str:
    diacritics = sum(1 for ch in text if ch in PL_DIACRITICS)
    pl = diacritics * 2 + len(PL_STOPWORDS.findall(text))
    en = len(EN_STOPWORDS.findall(text))
    return "pl" if pl >= en else "en"


def line_index(text: str) -> list[int]:
    starts, pos = [0], text.find("\n")
    while pos != -1:
        starts.append(pos + 1)
        pos = text.find("\n", pos + 1)
    return starts


def prose_lines(text: str) -> set[int]:
    """Numery linii, które są prozą — bez nagłówków, tabel i cytatów blokowych."""
    out = set()
    for n, raw in enumerate(text.split("\n"), start=1):
        s = raw.strip()
        if not s or s.startswith("#") or s.startswith("|") or set(s) <= set("-=*_ "):
            continue
        out.add(n)
    return out


def split_sentences(block: str) -> list[str]:
    """Dzieli na zdania, chroniąc kropki w skrótach i inicjałach."""
    protected = ABBREV.sub(lambda m: m.group(1) + DOT, block)
    protected = re.sub(r"\b([A-ZĄĆĘŁŃÓŚŹŻ])\.", r"\1" + DOT, protected)
    parts = [p.replace(DOT, ".").strip() for p in SENT_SPLIT.split(protected)]
    return [p for p in parts if p and WORD_RE.findall(p)]


def paragraphs(text: str) -> list[str]:
    """Akapity prozy — pomija nagłówki, punkty list, tabele i cytaty."""
    out = []
    for chunk in re.split(r"\n\s*\n", text):
        lines = [
            ln for ln in chunk.split("\n")
            if ln.strip()
            and not ln.strip().startswith(("#", "|", ">", "- ", "* ", "+ "))
            and not re.match(r"^\s*\d+[.)]\s", ln)
        ]
        joined = " ".join(ln.strip() for ln in lines).strip()
        if len(WORD_RE.findall(joined)) >= 12:
            out.append(joined)
    return out


# --------------------------------------------------------------------------
# Listy markerów
# --------------------------------------------------------------------------

AI_PHRASES = {
    "pl": [
        r"w dzisiejszych czasach", r"w dzisiejszym świecie", r"w erze cyfrowej",
        r"żyjemy w czasach", r"warto zaznaczyć", r"warto pamiętać",
        r"należy podkreślić", r"nie da się ukryć", r"jak powszechnie wiadomo",
        r"mamy nadzieję, że ten artykuł", r"podsumowując, warto",
        r"innowacyjn\w*", r"nowoczesn\w*", r"kompleksow\w*", r"dedykowan\w*",
        r"zaawansowan\w*", r"rewolucyjn\w*", r"przełomow\w*",
        r"najwyższej jakości", r"szyt\w+ na miarę", r"szeroki wachlarz",
        r"bogata gama", r"synergi\w*", r"wartość dodan\w*",
        r"w oparciu o", r"jesteśmy w stanie", r"adresować (?:problem|potrzeb)",
        r"dostarczać wartość", r"na końcu dnia", r"nie wahaj się",
        r"posiada\w*\s+(?:funkcj|możliwość|opcj)", r"dokonać (?:rezerwacji|zakupu|wyboru|zmian)",
        r"w celu \w+ania", r"w przypadku wystąpienia", r"generyczn\w*",
        r"okres czasu", r"kontynuować dalej", r"wzajemna współpraca",
        r"nie tylko\b.{0,60}?\bale (?:także|również)", r"zarówno\b.{0,60}?\bjak i\b",
        r"funkcjonalność", r"rozwiązanie szyte", r"z dumą (?:ogłaszamy|prezentujemy)",
    ],
    "en": [
        r"in today'?s fast-?paced world", r"in an era where",
        r"in the ever-?evolving", r"it'?s not just \w+,? it'?s",
        r"whether you'?re a", r"look no further", r"let'?s dive in",
        r"that'?s where \w+ comes in", r"it'?s worth noting",
        r"it'?s important to remember", r"needless to say",
        r"at the end of the day", r"in conclusion", r"we hope this",
        r"not only\b.{0,60}?\bbut also\b",
        r"\bdelve\b", r"\bleverag\w+", r"\butiliz\w+", r"\belevat\w+",
        r"\bunlock\w*", r"\bempower\w*", r"\bharness\w*", r"\bfoster\w*",
        r"\bunderscore\w*", r"\bsupercharg\w+", r"\bspearhead\w*",
        r"\brobust\b", r"\bcomprehensive\b", r"\binnovative\b",
        r"\bcutting-?edge\b", r"\bstate-of-the-art\b", r"\bworld-?class\b",
        r"\bbest-in-class\b", r"\bseamless\w*", r"\bgame-?chang\w+",
        r"\btransformative\b", r"\bpivotal\b", r"\binvaluable\b",
        r"\bmeticulous\w*", r"\bbustling\b", r"\bunparalleled\b",
        r"\bunwavering\b", r"\btapestry\b", r"\brealm\b",
        r"\btestament to\b", r"\bmyriad\b", r"\bplethora\b",
        r"\btreasure trove\b", r"\beffortlessly\b",
        r"\btruly\b", r"\bincredibly\b", r"\bremarkably\b", r"\bgenuinely\b",
        r"\ba (?:wide )?(?:range|variety) of\b", r"\bvarious\b", r"\bnumerous\b",
        r"\bin order to\b", r"\bdue to the fact that\b",
        r"\bhas the ability to\b", r"\bis capable of\b",
        r"thrilled to announce", r"humbled to share", r"excited to announce",
        r"the (?:best part|result|catch)\?",
    ],
}

CONNECTORS = {
    "pl": [
        "ponadto", "co więcej", "dodatkowo", "podsumowując", "niewątpliwie",
        "z pewnością", "warto dodać", "reasumując", "ostatecznie", "jednakże",
    ],
    "en": [
        "moreover", "furthermore", "additionally", "in conclusion", "ultimately",
        "notably", "importantly", "crucially", "undoubtedly", "consequently",
    ],
}

PARTICIPLES = {
    "pl": r",\s+(?:nie\s+)?(zapewniając|umożliwiając|pozwalając|gwarantując|dając|oferując|tworząc|przyspieszając|ułatwiając|zwiększając|redukując|eliminując|wspierając|generując)\b",
    "en": r",\s+(ensuring|allowing|enabling|empowering|helping|providing|delivering|driving|creating|making|offering|giving|resulting in|leading to|thereby)\b",
}

TRIPLE = {
    "pl": r"\b[\wąćęłńóśźż]+,\s+[\wąćęłńóśźż]+\s+(?:i|oraz)\s+[\wąćęłńóśźż]+\b",
    "en": r"\b\w+,\s+\w+,?\s+and\s+\w+\b",
}

# Dwa rzeczowniki odczasownikowe w oknie trzech słów — sygnał łańcucha dopełniaczy.
_NOM = r"\w{5,}(?:owania|ienia|ania|enia|acji|zji|sji|ości)"
GENITIVE_CHAIN = re.compile(
    rf"\b{_NOM}\s+(?:\w+\s+)?{_NOM}\b", re.IGNORECASE
)

TYPOGRAPHY = {
    "pl": [
        (r'(?<![\w])"[^"\n]{2,60}"', "angielski cudzysłów zamiast „ ”"),
        (r"(?<!\.)\.\.\.(?!\.)", "trzy kropki zamiast znaku …"),
        (r"\b\d+\.\d+\b(?!\s*(?:%|\)))", "kropka dziesiętna zamiast przecinka"),
        (r"\b\d{1,3},\d{3}\b", "przecinek jako separator tysięcy (powinna być spacja)"),
        (r"\d\s+%", "spacja przed znakiem procenta"),
        (r"\b(19|20)\d{2}-(19|20)\d{2}\b", "dywiz w zakresie lat (powinna być półpauza –)"),
        (r"\b(?:Myślę|Sądzę|Uważam|Wiem|Widzę)\s+że\b", "brak przecinka przed „że”"),
    ],
    "en": [
        (r"[a-z]’[a-z].{0,80}?[a-z]'[a-z]", "mieszane apostrofy proste i typograficzne"),
        (r"(?<!\.)\.\.\.(?!\.)", "trzy kropki zamiast znaku …"),
        (r"[a-z]\.  +[A-Z]", "podwójna spacja po kropce"),
        (r"\s+[,.;:!?]", "spacja przed znakiem interpunkcyjnym"),
    ],
}

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)
TITLE_CASE_SKIP = {
    "a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or",
    "the", "to", "with", "i", "w", "z", "na", "do", "o", "u", "po", "od",
}


# --------------------------------------------------------------------------
# Konfiguracja projektu
# --------------------------------------------------------------------------

def load_banned(config_path: Path) -> list[str]:
    """Wyciąga zakazane słowa z konfigu — punkty pod nagłówkiem banned/zakazane."""
    if not config_path.exists():
        return []
    terms, collecting = [], False
    for line in config_path.read_text(encoding="utf-8").split("\n"):
        if line.startswith("#"):
            collecting = bool(re.search(r"zakazan|banned|unikaj|avoid|red.?flag", line, re.I))
            continue
        if not collecting:
            continue
        m = re.match(r"\s*[-*+]\s+(.+)", line)
        if not m:
            continue
        term = re.split(r"\s*(?:→|->|—|:|–)\s*", m.group(1))[0]
        term = term.strip().strip("`\"'„”*_")
        if term and len(term) < 60:
            terms.append(term)
    return terms


def banned_regex(term: str) -> str:
    """Dopasowanie odporne na odmianę — rdzeń plus dowolna końcówka.

    Polski odmienia przymiotniki („kompleksowy” / „kompleksowe” / „kompleksowych”),
    więc dosłowne dopasowanie przepuściłoby większość realnych trafień.
    """
    words = term.split()
    head = r"\s+".join(re.escape(w) for w in words[:-1])
    last = words[-1]
    tail = re.escape(last[:-1]) + r"\w*" if len(last) >= 6 else re.escape(last)
    return (head + r"\s+" if head else "") + r"\b" + tail


# --------------------------------------------------------------------------
# Kontrole
# --------------------------------------------------------------------------

class Report:
    def __init__(self, name: str, lang: str, stats: dict):
        self.name, self.lang, self.stats = name, lang, stats
        self.findings: list[dict] = []

    def add(self, check: str, severity: str, message: str, hits=None) -> None:
        self.findings.append(
            {"check": check, "severity": severity, "message": message, "hits": hits or []}
        )


def hits_from(pattern, text: str, starts: list[int], allowed: set[int], limit: int = 8):
    rx = pattern if isinstance(pattern, re.Pattern) else re.compile(pattern, re.IGNORECASE)
    out = []
    for m in rx.finditer(text):
        line = bisect.bisect_right(starts, m.start())
        if line not in allowed:
            continue
        lo, hi = max(0, m.start() - 32), min(len(text), m.end() + 32)
        snippet = " ".join(text[lo:hi].split())
        out.append({"line": line, "text": snippet})
        if len(out) >= limit:
            break
    return out


def analyze(name: str, raw: str, banned: list[str]) -> Report:
    text = mask(raw)
    lang = detect_language(text)
    starts = line_index(text)
    allowed = prose_lines(raw)

    paras = paragraphs(text)
    sentences = [s for p in paras for s in split_sentences(p)]
    words = WORD_RE.findall(text)
    n_words = max(len(words), 1)

    rep = Report(name, lang, {
        "words": len(words),
        "sentences": len(sentences),
        "paragraphs": len(paras),
    })

    # 1. Myślniki — PL: maks. 1 na akapit; EN: maks. 1 na ~200 słów (patrz SKILL.md)
    dash_re = r"\s[—–]\s|\w[—–]\w"
    n_dash = len(re.findall(dash_re, text))
    per200 = round(n_dash / n_words * 200, 2)
    if lang == "pl":
        over = n_dash > max(1, len(paras))
        detail = f"limit dla PL: 1 na akapit, akapitów: {len(paras)}"
    else:
        over = per200 > 1
        detail = f"limit dla EN: 1 na 200 słów, tu {per200}"
    if over:
        rep.add("myślniki", "high", f"w prozie: {n_dash} ({detail})",
                hits_from(dash_re, text, starts, allowed, limit=12))

    # 2. Fraz z listy AI-tells
    phrase_hits = []
    for pattern in AI_PHRASES[lang]:
        phrase_hits.extend(hits_from(pattern, text, starts, allowed, limit=3))
    if phrase_hits:
        phrase_hits.sort(key=lambda h: h["line"])
        rep.add("ai-tells", "high",
                f"trafienia z listy markerów {lang.upper()}: {len(phrase_hits)}",
                phrase_hits[:14])

    # 3. Zakazane słowa projektu
    if banned:
        bh = []
        for term in banned:
            bh.extend(hits_from(banned_regex(term), text, starts, allowed, limit=3))
        if bh:
            bh.sort(key=lambda h: h["line"])
            rep.add("zakazane-projektu", "high",
                    f"trafienia z listy zakazanych słów projektu: {len(bh)}", bh[:12])

    # 4. Monotonia długości zdań
    if len(sentences) >= 4:
        lengths = [len(WORD_RE.findall(s)) for s in sentences]
        mean = sum(lengths) / len(lengths)
        # Próg względny: przy krótkich zdaniach różnica 3 słów to już kontrast.
        tol = max(2, round(0.2 * mean))
        run, worst = 1, []
        for i in range(1, len(lengths)):
            if abs(lengths[i] - lengths[i - 1]) <= tol:
                run += 1
                if run >= 3:
                    worst = lengths[i - run + 1:i + 1]
            else:
                run = 1
        var = sum((x - mean) ** 2 for x in lengths) / len(lengths)
        sd = var ** 0.5
        rep.stats["sentence_len_mean"] = round(mean, 1)
        rep.stats["sentence_len_sd"] = round(sd, 1)
        if worst:
            rep.add("rytm-zdań", "medium",
                    f"ciąg {len(worst)} zdań o zbliżonej długości: {worst} słów "
                    f"(średnia {mean:.1f}, odchylenie {sd:.1f})")
        elif sd < mean * 0.35:
            rep.add("rytm-zdań", "medium",
                    f"niskie zróżnicowanie długości zdań (odchylenie {sd:.1f} "
                    f"przy średniej {mean:.1f})")

    # 5. Jednakowa długość akapitów
    if len(paras) >= 4:
        counts = [len(split_sentences(p)) for p in paras]
        if len(set(counts)) == 1:
            rep.add("rytm-akapitów", "medium",
                    f"wszystkie {len(paras)} akapity mają po {counts[0]} zdania")

    # 6. Powtórzone łączniki
    conn_hits = []
    for c in CONNECTORS[lang]:
        found = re.findall(r"\b" + c + r"\b", text, re.IGNORECASE)
        if len(found) >= 2:
            conn_hits.append(f"„{c}” ×{len(found)}")
    if conn_hits:
        rep.add("łączniki", "medium",
                "powtórzone łączniki: " + ", ".join(conn_hits))

    # 7. Powtórzone otwarcia zdań
    if len(sentences) >= 5:
        openers = {}
        for s in sentences:
            w = WORD_RE.findall(s)
            if w:
                openers[w[0].lower()] = openers.get(w[0].lower(), 0) + 1
        repeated = [f"„{k}” ×{v}" for k, v in openers.items() if v >= 3]
        if repeated:
            rep.add("otwarcia-zdań", "medium",
                    "powtórzone pierwsze słowo zdania: " + ", ".join(sorted(repeated)))

    # 8. Doklejone imiesłowy / trailing -ing
    part_hits = hits_from(PARTICIPLES[lang], text, starts, allowed, limit=10)
    if part_hits:
        label = "doklejone imiesłowy" if lang == "pl" else "trailing -ing clauses"
        rep.add("imiesłowy", "high", f"{label}: {len(part_hits)}", part_hits)

    # 9. Trójki
    n_triples = len(re.findall(TRIPLE[lang], text, re.IGNORECASE))
    if n_triples >= 3 or (paras and n_triples >= max(2, len(paras) // 2)):
        rep.add("trójki", "medium",
                f"konstrukcja „X, Y i Z”: {n_triples} przy {len(paras)} akapitach")

    # 10. Łańcuchy dopełniaczy (PL)
    if lang == "pl":
        gen_hits = hits_from(GENITIVE_CHAIN, text, starts, allowed, limit=8)
        if gen_hits:
            rep.add("łańcuchy-dopełniaczy", "medium",
                    f"rzeczowniki odczasownikowe obok siebie: {len(gen_hits)}", gen_hits)

    # 11. Title Case w nagłówkach
    tc = []
    for m in HEADING_RE.finditer(raw):
        head = m.group(2)
        ws = [w for w in WORD_RE.findall(head) if w.lower() not in TITLE_CASE_SKIP]
        if len(ws) >= 3:
            caps = sum(1 for w in ws[1:] if w[0].isupper() and not w.isupper())
            if caps >= len(ws[1:]) * 0.6:
                tc.append({"line": bisect.bisect_right(starts, m.start()), "text": head})
    if tc:
        rep.add("nagłówki", "medium",
                f"Title Case zamiast sentence case: {len(tc)}", tc[:8])

    # 12. Typografia
    typo = []
    for pattern, label in TYPOGRAPHY[lang]:
        found = hits_from(pattern, text, starts, allowed, limit=3)
        for f in found:
            f["text"] = f"{label}: {f['text']}"
        typo.extend(found)
    if typo:
        typo.sort(key=lambda h: h["line"])
        rep.add("typografia", "low", f"potknięcia typograficzne: {len(typo)}", typo[:10])

    if not rep.findings:
        rep.add("czysto", "info", "brak wykrytych markerów — sprawdź rytm i odcisk palca ręcznie")

    return rep


# --------------------------------------------------------------------------
# Wyjście
# --------------------------------------------------------------------------

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2, "info": 3}
SEVERITY_MARK = {"high": "!", "medium": "~", "low": "·", "info": " "}


def render(rep: Report) -> str:
    s = rep.stats
    out = [
        f"\n=== {rep.name} ===",
        f"język: {rep.lang} · {s['words']} słów · {s['sentences']} zdań · "
        f"{s['paragraphs']} akapitów prozy",
    ]
    for f in sorted(rep.findings, key=lambda x: SEVERITY_ORDER[x["severity"]]):
        out.append(f"\n[{SEVERITY_MARK[f['severity']]}] {f['check']}: {f['message']}")
        for h in f["hits"]:
            out.append(f"      L{h['line']}: {h['text']}")
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description="Skaner markerów AI (PL/EN)")
    ap.add_argument("paths", nargs="+", help="pliki do sprawdzenia albo - dla stdin")
    ap.add_argument("--config", help="konfig projektu (.claude/humanize.md)")
    ap.add_argument("--json", action="store_true", help="wyjście maszynowe")
    args = ap.parse_args()

    banned = load_banned(Path(args.config)) if args.config else []

    reports = []
    for p in args.paths:
        if p == "-":
            reports.append(analyze("<stdin>", sys.stdin.read(), banned))
            continue
        path = Path(p)
        if not path.exists():
            print(f"pominięto (nie istnieje): {p}", file=sys.stderr)
            continue
        reports.append(analyze(str(path), path.read_text(encoding="utf-8"), banned))

    if not reports:
        return 1

    if args.json:
        print(json.dumps(
            [{"file": r.name, "language": r.lang, "stats": r.stats, "findings": r.findings}
             for r in reports],
            ensure_ascii=False, indent=2,
        ))
    else:
        for r in reports:
            print(render(r))
        print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
