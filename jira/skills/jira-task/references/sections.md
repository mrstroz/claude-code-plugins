# The shape of an issue

Every issue this skill writes has the same shape, whatever its type. This file is that shape: what
each part is for, and the one question it answers. It is read together with the template for the
type being written, [`task.md`](task.md), [`bug.md`](bug.md), [`hotfix.md`](hotfix.md) or
[`story.md`](story.md), never instead of one. The template says which parts an issue of that type
has and in what order; this file says what goes in them.

The shape: `TLDR`, `Out of scope`, one section belonging to the type itself (`Steps to reproduce`
in a defect, `Subtasks` in a `Story`, none in a `Task`), then `Acceptance criteria`, `Findings`,
`Risk`, `Open questions`, `Demo`. Somebody who has read one issue in this tracker knows where to
look in the next one, which is worth more than a heading phrased to fit its own type.

Fill the sections that carry something; drop an optional section rather than filling it with a
restatement of the title.

## One section, one question

Each part below answers a question no other part answers. Use that while editing: take a line, ask
which question it answers, and move it or drop it when the answer belongs to another section. A
fact carried in two sections is not a second opinion. It is one fact in two phrasings, and within a
month they disagree.

| Part | The one question it answers |
|---|---|
| the title | What is this, seen on a board without opening it? |
| the opening panel | What has to be known before any of this is believed? |
| `TLDR` | What is wrong today, and what does this issue change about it? |
| `Out of scope` | What will this deliberately **not** do? |
| `Steps to reproduce` | How is it seen happening? |
| `Subtasks` | What are the pieces? |
| `Acceptance criteria` | What will be observably true once this is done? |
| `Findings` | What has already been established, that the next person would otherwise rediscover, plus, marked `Suspected:`, the one thing the author believes and nobody checked? |
| `Risk` | How dangerous is this at deployment, and why? Only when the configuration defines risk areas. |
| `Open questions` | What has to be answered before the work can start? |
| `Demo` | Where is the recording of the finished work? |

**Nothing here has a length to reach.** A section answers its question and stops. A one-line
`Findings` on a defect somebody traced in ten seconds is complete, and padding it to look thorough
costs the reader more than the empty space would have. The ceiling on `Acceptance criteria` is the
one exception, and it is a diagnostic rather than a limit; see below.

The rest of what a description can carry, such as panels, tables, images and smart links to other
issues, is in [the dialect](${CLAUDE_PLUGIN_ROOT}/skills/jira-api/references/markdown.md). Read
it once; the difference between a checkbox and a line that merely looks like one is two characters.

## The title

```
[<prefix>] Short title, imperative, no trailing period
```

The prefix names the affected subsystems. It comes from `taxonomy.subsystemPrefixes` when the
configuration has them, otherwise from the subsystem names the repository uses. One prefix when
the work lives in one system, several joined with `+` when the same issue spans more. It sits in
the title because that is the one field visible on a board without opening anything.

## The opening panel

An issue often starts as a conclusion rather than an observation: the declared types say this
cannot work, a test fails for a reason nobody has reproduced in the product, a count comes back
zero on a local database holding forty rows. That is worth reporting, but it is a different claim
from "this happened", and the issue has to show which one it is.

When the premise was reasoned rather than watched, the description opens with a panel naming what
is unverified, and the detail goes to `Open questions`:

```markdown
> [!WARNING] Not observed in production data — see Q1.

## TLDR

The feed for a company is not generated at all when a website language has no base URL…
```

It goes first because the beginning of a description is what actually gets read: a board, a
search result and the preview under a link all show it. A caveat in the last section reaches only
the person who already read everything above it, and that person was never the one at risk. A
panel rather than bold text, because the colour is visible before the sentence is.

## TLDR

Two sentences: what is wrong or missing today, and what this issue changes about it. A `HOTFIX`
adds a third: what happens if this waits for the next release.

That is the section. "Who it is for" goes in only when the first sentence leaves it unclear, and
"why now" almost never belongs here at all: it is either `Risk`, or it is the priority somebody
else sets. An opening asked to carry the problem, the audience, the urgency and the change at once
runs to five sentences, and stops being the thing anybody reads first.

It is a heading rather than a loose opening paragraph because a named section can be held to two
sentences and an unnamed one drifts.

## Out of scope

Three things go here, and nothing else:

- what this deliberately does not do, where "while we're in there…" gets refused in advance;
- what happens to records already broken by this, when the answer is that they stay as they are;
- what belongs to a different issue, named with its key.

This section was once `Scope` and held both halves. The positive half always collided with
`Acceptance criteria`: *what this change covers* and *what will be true when it is done* are the
same sentence in two tenses, so the two lists filled with the same content in different words.

**Everything positive is a criterion.** A line that reads like scope but cannot be checked by
somebody who did not write the code is worth catching now rather than at review, and moving it is
how it gets caught.

Drop the section when nothing is genuinely at risk of being assumed. In a defect report something
usually is: whether the records already broken get repaired is the question a defect raises and
almost never states, and it is separate work from fixing the mechanism that broke them.

That question has three answers and only one belongs here. They *do* get repaired: that is a
criterion. They deliberately do not: that is this section. **Nobody has decided yet: that is
`Q1`**, and it is the answer most defect reports honestly have. A line here reads as a decision
somebody made, so writing one on nobody's behalf manufactures the decision: whoever picks the work
up cannot tell an exclusion that was chosen from one that was assumed, and ships the narrow fix.
Leaving customer records broken is a product decision, and a template does not get to make it.

## Steps to reproduce

Numbered, from a state somebody else can reach, ending with the pair that settles the argument:
`Observed: … / Expected: …`. That pair goes in the last step rather than in the opening, because
whoever checks the fix reads it here, and stating it once stops the same fact appearing in three
places.

Not every defect reproduces on demand. When it does not, this section says how it was observed
instead (when, where, on which account or environment) and says plainly that nobody has reproduced
it. Conditions without a procedure are still the most useful thing in the report; an invented
procedure is the least, because the first person to follow it concludes the defect is not real. A
premise that was reasoned rather than watched also takes [the opening panel](#the-opening-panel).

## Evidence: screenshots and recordings

A screenshot of the failure is worth more than the paragraph describing it, and a defect report is
where one usually exists already. Put the file beside the draft, name it in the description, and
pass it to the command:

```markdown
![the overview with the filter column still there](shot.png)
```

```bash
… create-issue --description-file draft.md --attach shot.png
```

The name in the description and the name of the file are what match them up. An image somewhere
on the web goes in as a link instead: only what is attached to the issue can be shown inside it,
and a link that stops working takes the evidence with it.

**A recording of the problem is evidence, not a `Demo`.** It goes where the observation goes: on
the last reproduction step in a defect, or under `TLDR` in anything else, as a link on its own
line. Filing it under `Demo` costs the one thing that section is for: saying at a glance whether
this work has been shown to anybody yet.

## Subtasks

The planned split, as titles, each carrying its own subsystem prefix. The keys stay in the
tracker, which already lists an issue's children; a list of keys maintained by hand goes stale the
moment anyone adds a subtask, and then two places disagree.

A piece belongs here when it would still be worth shipping if the others never happened. That is
the same test that decided this is a `Story` at all, applied one line at a time: a piece failing
it is not a subtask, it is half of another one.

## Acceptance criteria

What will be observably true once this is done: three to five of them, each checkable by somebody
who did not write the code, and stated as an effect rather than as a way of building it.

**They carry every positive statement about the work.** Nothing else in the issue does: `Out of
scope` takes only refusals, `Findings` only what is already true. A positive sentence with nowhere
else to go either becomes a criterion here or leaves the issue.

**They are checkboxes**, written `- [ ]`. They are the one part of an issue that somebody works
through item by item, and the tracker keeps the ticks, so whoever picks the work up can show where
they are without writing a comment about it. Nothing else in an issue is a checkbox: a scope line
and a repro step are read, not completed.

**Past five criteria, stop and look at the issue rather than at the list.** The bound is not a
formatting rule. With nowhere else for a positive statement to go, an issue holding two
independently shippable capabilities shows up here as an eighth criterion. That is the signal to
split it into a `Story`, and it is worth more than a tidy list.

A criterion nobody could check without writing the code first is not one, and neither is one that
needs information the issue never gives. Whoever implements this goes deeper; they expand these,
they do not restate them.

## Findings

What somebody already established about the system as it stands, so that whoever picks this up
does not spend the first afternoon rediscovering it.

**Every finding is a bullet, and one bullet is one finding.** The section is scanned rather than
read through. Somebody picking the work up is hunting for the line that saves them an afternoon,
and a paragraph buries it among the others. A finding too long for a bullet is usually two; one
that genuinely is not may run to two or three lines, but it stays a bullet.

**One test, applied per line: is this true right now?** If it is, it stays. If it says what should
exist once the work is done, it belongs to whoever implements it. Three kinds of line pass:

- **Where it lives**: the file, the class or the method, under the rule from
  [Pointing at code](#pointing-at-code).
- **How it works today**, especially when that is what makes the issue necessary. "The reaper runs
  every thirty minutes and is the only exit from `processing`" is why somebody waits twelve hours
  for a stalled job; without it the report is a complaint.
- **What will bite**: a constraint, something outside the module that reads this and would break,
  or a failure already watched happening. A trap somebody has fallen into once is the most
  valuable line in an issue and the one most often left behind in a chat window.

What does not pass: the mechanism to use, the API to call, the file to create, the pattern to
copy, the library, the algorithm. Those belong to whoever implements it, who reads the code with
fresh eyes so an opinion formed earlier gets checked instead of confirmed. An answer written into
the issue a week earlier arrives carrying the tracker's authority, so it gets followed rather than
tested. The section used to be called `Technical details`, and the name was half the problem: it
reads as an invitation to write down how the change should be built.

**One exception, and it has a fixed shape: `Suspected:`.** Somebody who watched the failure or
wrote the code often already knows what the fix is, and discarding that is the most expensive
thing this rule could do. So it goes in, as the last bullet of `Findings`: one sentence, opening
with that word, written plainly rather than as code.

The word is the whole mechanism. `Findings` is read as established, so a mechanism written like
one gets followed; the same sentence opening with `Suspected:` gets tested instead, which is all
anybody ever wanted from it. Two conditions hold it in place. It is the **author's** knowledge and
never the grounding pass's: an inferred fix and a watched one read identically once they are
written down. And there is one of them: a second `Suspected:` line is a design section arriving
under a new name.

When nobody has looked yet, leave the section out. An empty section costs nothing; a wrong one
costs an afternoon.

### Pointing at code

Any type may name a file, a class or a method in `Findings`, **when that is what the author
already knows.** Someone who has just watched a failure, or has just traced how a mechanism works,
usually knows the exact place, and an issue that drops it costs the next person the afternoon it
would have saved.

The condition is that somebody checked, and it has nothing to do with the issue type. Either the
author watched it happen, or the grounding pass opened the file and confirmed it. What must never
appear is a location inferred from a plausible-sounding name: it reads exactly like a verified
one, so the next person has no way to tell them apart and will follow it. When nothing was
confirmed, name the area and the mechanism instead, and let the implementer find the rest.

Line numbers are the exception to the exception. They are stale by the time anyone opens the
issue, and they add nothing a file and a method name do not already give. Leave them out.

## Risk

Only when the configuration defines `risk.high` and `risk.low`. One line: the label, then one
sentence naming the reason.

```markdown
risk-<level> — one sentence naming the reason.
```

Risk says how dangerous the change is at deployment, not how urgent it is. The sentence is not
decoration: a label with no stated reason is one nobody trusts, and therefore one nobody corrects
either. Without the configuration block, leave the section out and set no label; a level nobody
defined reads exactly like one somebody did.

## Open questions

What has to be answered before the work can start, numbered `Q1`, `Q2`, each phrased so that a
yes or a no answers it. A question that cannot be answered that way is usually two questions.

This is where everything the issue is unsure about lands, and it is the reason the draft can be
written without stopping every few minutes to ask. Two kinds of line belong here in particular: an
exclusion nobody has actually decided, which would otherwise read as a decision in `Out of scope`,
and a premise that was reasoned rather than watched, which the opening panel points at by number.

Leave the section out when there are none. An issue with no open questions is finished, not
suspicious.

## Demo

A link to the recording of the finished work, added when there is one, which on a new issue there
is not, so the section is usually absent until somebody has something to show.

It answers one question: has this been demonstrated to anybody yet. A recording of the *problem*
is evidence and belongs where the observation is; see [Evidence](#evidence-screenshots-and-recordings).
