# AI-marker catalogue — English

Full companion to SKILL.md for English copy. SKILL.md carries the short list;
this file has the rest, with examples.

Treat it as a **repertoire, not a checklist**. A word on this page is not banned
by virtue of being here — it is suspect when it carries no information. Applying
every rule mechanically produces prose that is clean, correct, and just as
obviously machine-made.

## Contents

1. [Em-dash addiction](#1-em-dash-addiction)
2. [Trailing participial clauses](#2-trailing-participial-clauses)
3. [The LLM lexicon](#3-the-llm-lexicon)
4. [Stock frames and openers](#4-stock-frames-and-openers)
5. [Nominalizations and inflated verbs](#5-nominalizations-and-inflated-verbs)
6. [Vague quantifiers and empty intensifiers](#6-vague-quantifiers-and-empty-intensifiers)
7. [Rhythm and structure tells](#7-rhythm-and-structure-tells)
8. [Register and mechanics](#8-register-and-mechanics)
9. [Social media](#9-social-media)
10. [What NOT to "fix"](#10-what-not-to-fix)

---

## 1. Em-dash addiction

The single most recognizable AI tell in English. One em dash per paragraph is
style; three is a signature. Default target: at most one per ~200 words.

Replacements, in rough order of how often they land:

- **comma** — ordinary aside: "in one window — no jumping between tools" →
  "in one window, with no jumping between tools";
- **colon** — the second part explains the first: "It's our own SaaS — we
  co-founded it" → "It's our own SaaS: we co-founded it";
- **full stop** — when the sentence is overloaded; usually the best fix,
  because it repairs the rhythm at the same time;
- **semicolon** between balanced clauses: "You don't buy a project — you log
  in" → "You don't buy a project; you log in";
- **parentheses** when the aside really is incidental;
- **a rhetorical question**, once per text: "and when a vendor changes its API —
  that's our problem" → "And when a vendor changes its API? That's our problem."

In titles and meta titles, replace the separator dash with a colon or comma.

The **en dash in ranges** (`2020–2024`, `pp. 10–20`, `Monday–Friday`) is correct
typography and stays — the rule is about prose connectors, not ranges.

## 2. Trailing participial clauses

The strongest English tell after the em dash, and the one most often missed. The
model closes a sentence with a comma plus an `-ing` verb that adds a benefit but
no information — it restates what the main clause already said, in vaguer words.

- "The system syncs every hour, **ensuring your data is always up to date**." →
  "The system syncs every hour." (the clause says nothing new)
- "We ship in two weeks, **allowing your team to focus on what matters most**."
  → "We ship in two weeks. Your team keeps selling while we build."
- "It integrates with your CRM, **streamlining your entire workflow**." →
  "It integrates with your CRM, so leads land in the pipeline without retyping."

Watch for the whole family: *ensuring, allowing, enabling, empowering, helping,
providing, delivering, driving, creating, making, offering, giving, resulting in,
leading to, thereby*.

The fix is one of three: delete it, replace it with a concrete second sentence,
or convert it into a real consequence ("so that…" plus a specific outcome). If
you can't say what it adds, delete it.

Related, same cadence at the front of the sentence: **"Leveraging our
expertise, we…"**, **"Having worked with hundreds of clients, we…"**. One per
text at most.

## 3. The LLM lexicon

Words that mark text as machine-written by sheer frequency. Cut them, or replace
with something concrete.

- **Verbs:** delve, leverage, utilize (→ use), elevate, unlock, empower, harness,
  foster, underscore, streamline, supercharge, navigate (figurative), embark,
  spearhead, revolutionize.
- **Adjectives:** robust, comprehensive, innovative, cutting-edge, state-of-the-art,
  world-class, best-in-class, seamless, game-changing, transformative, crucial,
  pivotal, invaluable, meticulous, bustling, vibrant, unparalleled, unwavering.
- **Nouns:** tapestry, realm, landscape (figurative), testament ("stands as a
  testament to"), journey (figurative), synergy, ecosystem (when it just means
  "our products"), myriad, plethora, treasure trove, game-changer.
- **Adverbs:** seamlessly, effortlessly, significantly, ultimately, notably,
  importantly, crucially, undoubtedly, arguably.

The test is never "is it on the list" — it is "does this word tell the reader
something they didn't know". *Robust* in a piece about failover behaviour may be
exactly right. *Robust* in "our robust platform" is filler.

## 4. Stock frames and openers

Sentence and paragraph shapes the model reaches for by default:

- "In today's fast-paced world…", "In an era where…", "In the ever-evolving
  landscape of…"
- "It's not just X, it's Y." / "This isn't just X. It's Y."
- "Whether you're a small agency or a large enterprise…"
- "Look no further.", "Let's dive in.", "Let's break it down."
- "That's where X comes in."
- "The best part?", "The result?", "The catch?" — a one-word rhetorical question
  as a paragraph hinge. Once is punchy; three times is a signature.
- "Here's the thing:", "But here's the kicker:"
- "It's worth noting that…", "It's important to remember that…", "Needless to
  say…" — hedging filler, almost always deletable.
- "not only X but also Y" — more than once per text, rewrite.
- "At the end of the day…", "When all is said and done…"
- Closers: "In conclusion,", "Ultimately, the choice is yours.", "We hope this
  guide helped you…" → cut, or land a concrete point instead.
- **Adverb-first openers** stacked across paragraphs: *Ultimately, Notably,
  Importantly, Crucially, Additionally, Moreover, Furthermore*. One per text.

## 5. Nominalizations and inflated verbs

| Stilted | Natural |
|---|---|
| provides optimization of | optimizes |
| perform an analysis of | analyze |
| conduct a review of | review |
| carry out an assessment | assess |
| is capable of exporting | can export / exports |
| has the ability to | can |
| make a decision regarding | decide on |
| in order to | to |
| due to the fact that | because |
| at this point in time | now |
| in the event that | if |
| for the purpose of | to / for |
| a wide range of features | (name the two that matter) |

## 6. Vague quantifiers and empty intensifiers

- **Quantifiers that quantify nothing:** "a range of", "a variety of", "various",
  "numerous", "several key", "countless", "a multitude of". Either give the
  number or name the items.
- **Empty intensifiers:** truly, incredibly, extremely, highly, remarkably,
  absolutely, genuinely, really. Cut them; the adjective is either strong enough
  or it's the wrong adjective.
- **Non-committal scale:** "significantly faster", "dramatically improved",
  "substantially reduced" → give the figure, or drop the adverb and say "faster".
  If no figure exists, mark it `[to fill in: ...]` rather than inventing one.

## 7. Rhythm and structure tells

- **Uniform sentence length** — vary it; follow two long sentences with a short
  one. A short sentence lands harder than any adjective.
- **Rule of three everywhere** ("faster, cheaper, and easier to maintain") —
  fine once, a tell when every paragraph closes with a triad. Cut to two items
  or break the pattern.
- **Uniform paragraph length** — four paragraphs of exactly three sentences is
  the same tell one level up. Let one paragraph be a single line.
- **Repeated connectors** — Moreover, Furthermore, Additionally, In conclusion:
  at most one per text, usually deletable outright.
- **Every paragraph opening with the product name** (or with "This", or with the
  same subject) — rework the openings.
- **Symmetrical "X. But Y." pairs** repeated — a favourite AI cadence; keep one.
- **Heading-then-restatement** — a heading followed by a sentence that just says
  the heading again in longer words. Cut the sentence.
- **Bullet lists where prose belongs** — the model bullets everything. If the
  items are one continuous argument, put it back into prose.

## 8. Register and mechanics

- **Contractions**: marketing and social copy reads human with "don't", "you'll",
  "that's". Spelled-out forms ("do not", "it is") read as legal text. In formal
  or legal copy, keep them spelled out — match the register, don't set it.
- **Sentence case in headings** ("What you get with the API"), not Title Case,
  unless the project's style guide says otherwise.
- **Second person beats abstraction**: "you get a report every Monday" over
  "clients are provided with weekly reporting".
- **Serial (Oxford) comma**: either convention is fine; be consistent within one
  text. Same for **US vs UK spelling** — pick whichever the surrounding content
  uses and don't mix.
- **Quotes and apostrophes**: straight or curly, consistent within one text;
  never mixed. Watch for a stray straight `'` inside otherwise curly copy.
- **Numbers**: "20%", "€5,000", "2020–2024". Spell out one through nine in prose
  unless the text is data-heavy; be consistent either way.
- **Spacing**: one space after a full stop, no space before punctuation, no
  double spaces left over from editing.

## 9. Social media

- Keep the hook line, line breaks, emoji and hashtags the author chose.
- Deliberate fragments and casual tone are voice, not errors — do not formalize.
- The banned vocabulary applies with double force: LinkedIn is where "thrilled
  to announce", "humbled to share", "game-changer" and "I'm excited to announce
  that…" mark a post as machine-written fastest. If the post announces
  something, let the fact carry it.
- No em-dash punctuation — in a short post it gives the game away instantly.
- One idea per post. If the corrected text still buries the point mid-paragraph,
  flag it rather than restructuring the post on your own.

## 10. What NOT to "fix"

- **Accepted domain terms**: CRM, SaaS, API, webhook, lead, pipeline, churn,
  onboarding — keep them; they are the reader's vocabulary.
- **The demand phrase (SEO keyword)** stays in its exact form in title, H1 and
  headings, even if it reads slightly awkwardly. Smooth the sentence around it.
- **Facts, figures, client names, quotes, dates**, and `[to fill in: ...]`
  placeholders.
- **The author's deliberate stylistic choices** — a fragment used for punch, an
  intentional repetition, a deadpan aside. Remove artificiality, not character.
- **Register set by context** — a contract, a security advisory or a compliance
  page is supposed to sound formal. Precision beats flow there; if a stiff
  phrase carries a legal obligation, leave it and say so.
