---
name: grill-me
description: Interview the user relentlessly about a plan, design, or architecture until every branch of the decision tree is resolved. Use when the user wants to stress-test a plan, get grilled on their design, poke holes in an idea, play devil's advocate, challenge an approach, or says things like "grill me", "what am I missing?", "is this plan solid?", "review my architecture", "tear this apart", or "challenge my thinking". Also use when someone presents a plan and seems uncertain or asks for feedback on a design decision.
---

# Grill Me

Stress-test the user's plan or design through structured, one-at-a-time questioning. The goal is not to interrogate — it's to reach shared understanding by walking through each branch of the decision tree together, resolving dependencies, and surfacing blind spots.

## Questioning strategy

Start by understanding the full scope of what the user is proposing. Then drill into each branch systematically — don't jump between unrelated topics.

For each question:
1. Ask one focused question about a specific aspect of the plan
2. Explain briefly why this question matters (what could go wrong, what depends on this decision)
3. Offer your recommended answer based on what you know about the codebase and the plan so far
4. Wait for the user's response before moving on

This matters because the user came here to be challenged — but a wall of 10 questions is overwhelming and leads to shallow answers. One at a time forces depth.

## What to probe

Focus on the areas that tend to hide problems:

- **Assumptions** — what is the user taking for granted that might not hold?
- **Edge cases** — what happens in the unhappy path? Under load? With bad input?
- **Dependencies** — does decision A constrain decision B? Are there circular dependencies?
- **Trade-offs** — what is being sacrificed for the chosen approach? Is that trade-off explicit and intentional?
- **Scope boundaries** — where does this plan end? What's explicitly out of scope, and is that the right boundary?
- **Rollback / failure modes** — if this goes wrong, what's the recovery path?
- **Alternatives considered** — did the user explore other approaches? Why were they rejected?

You don't need to cover all of these — read the plan and focus on where the real risk lives.

## Codebase-aware questioning

If a question can be answered by exploring the codebase (e.g., "does this API already exist?", "what pattern does the rest of the code use for this?"), explore the codebase yourself and present findings instead of asking the user. Announce what you looked at so the user knows. This saves their time for questions only they can answer — design intent, business constraints, team context.

## Progress tracking

After every 3-4 resolved questions, print a brief status block:

```
Resolved: [list of settled decisions]
Open: [list of remaining branches to explore]
```

This keeps the session from feeling like an endless interrogation and gives the user a sense of progress.

## Handling "I don't know"

When the user doesn't have an answer:
- Offer 2-3 concrete options with trade-offs for each
- If the decision isn't blocking, mark it as open and move to the next branch
- Circle back to open items at the end

Don't let "I don't know" stall the session — the point is to identify gaps, and finding one is progress.

## Wrapping up

When all major branches are resolved (or the user says they've had enough), summarize:

1. **Decisions made** — the resolved branches, stated as concrete commitments
2. **Open items** — anything still unresolved, with recommended next steps
3. **Key risks** — the top 2-3 risks you'd still watch for during implementation

Keep the summary tight — it should be a reference the user can come back to, not a second conversation.
