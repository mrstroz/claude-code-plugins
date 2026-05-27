# 12 — Product philosophy

**Load when:** the question is about product strategy, what to build, prioritisation, the relationship between product and revenue, multiproduct platforms, why product comes before sales scaling.

## Product-led, merchant-first

Two non-negotiable filters:

1. **Everything in the product has to serve the merchant outcome.** If a feature is technically elegant but doesn't move the needle for the merchant or the end customer, it doesn't belong in the roadmap.
2. **The merchant doesn't care about clean code.** They care that the thing works, that it's reliable, that it doesn't break their day. Internal beauty matters only insofar as it makes the merchant outcome better.

That doesn't mean: build messy code. Scalability and maintainability matter — but they're constraints, not goals. The goal is merchant value.

> "Sometimes dev says 'this would be cleaner if we did it this other way'. I say: but this makes no sense for the merchant. We're building the product so the merchant gets the outcome — not so the code is pretty."

## The early-stage product trap

The hardest part of early-stage product strategy: choosing what to build *first*, when everything looks important.

The trap is to chase the high-revenue feature first because the unit economics look good on a spreadsheet. The mistake: that feature usually has high competition, no defensibility, and doesn't compound.

The move he made: start with a product that's *small revenue per merchant* but *defensible*. For him, that was the loyalty / stamp-card replacement. You couldn't extract $1000/month for it from a corner café — but it gave you:

- A network effect (more locations → more end-users → more locations).
- Stickiness (data is locked into the platform, not in the merchant's POS).
- A foothold from which to add higher-revenue features later.

Then, once you have the foothold, you add the higher-revenue features (ordering, tips, CRM, web ordering). Each one stacks. Each one increases ARPU without raising prices.

## ARPU growth through value, not pricing

This is the central product-led-growth thesis. See `10-pricing-and-packages.md` for the pricing angle. The product angle:

- Every new feature added to the platform is potentially a new revenue stream from existing customers.
- New cohorts of customers come in *already paying more*, because they buy a richer product on day 1.
- 2025 cohort ARPU per location: +52% vs 2024 cohort. That's not a price hike — that's product-driven.

The strategic implication: spend your engineering budget on features that materially expand what merchants can do on the platform. Not on cosmetic improvements to existing features. Not on internal refactors that don't change the merchant story.

## Multiproduct compounding

A single-product platform is fragile. Many things can disrupt your one source of value.

A multiproduct platform is hard to dislodge:

- The merchant uses you for loyalty, CRM, ordering, tips.
- A competitor showing up with "we do ordering better" doesn't displace you — you'd still own the other 3 modules.
- Each module makes the others stickier (the customer the merchant earned via loyalty is the same customer who places a web order).

This is the same play as Revolut (see `13-long-term-game.md`) at a different scale: start with one foothold, then expand into adjacent modules that all share the same user/merchant base.

## Listen to feedback, don't be defensive

> "Każdy feedback biorę bardzo, ale bardzo nie tak, że się wkurzam czy obrażam. Tylko jako super important. Bo on mnie napędza do tego, żeby robić jeszcze lepszy produkt."

Founders who get defensive about product feedback are signalling either ego or fear. Both are red flags. Treat feedback like raw material — not all of it is right, but the best signal is in there.

That said: not all feedback becomes a feature. You still have to prioritise. The discipline is:

- Take *all* feedback in.
- Process it through your strategy lens.
- Decide what to act on.
- Be willing to say "we hear you, but not now" — to investors, customers, team.

## Logic-first product thinking

You don't have to code to drive product (see `19-product-without-coding.md`). What you have to do is *understand the logic* of your product deeply:

- What is connected to what.
- What changes when.
- Where the bottlenecks are.
- Why a particular flow exists.

If you understand the logic, you can spot opportunities for features that fit into the system without forcing the architecture, you can guide engineering, and you can find creative ways to use the parts you already have rather than building everything from scratch.

## The "20% of what we could be" view

He believes the product is at about 20% of what it could be. That's not insecurity — that's product ambition.

This framing matters:

- It keeps the team hungry. There's always more to build.
- It manages investor expectations: the upside isn't priced in yet.
- It keeps the customer relationship interesting: there's a roadmap that makes today's product look small.

If you ever catch yourself saying "the product is basically done", check yourself. For most B2B SaaS, that's the warning that you've stopped pushing.

## Prioritisation cadence

Realistic, not idealistic. Not everything can be done by tomorrow. Sprint it. Roadmap it. Communicate timelines clearly to customers who ask for things, even when the answer is "yes but Q3, not Q1".

Customers are surprisingly OK waiting if they know it's coming. They're frustrated when the answer is vague.

## What the dev team should hear

- "The merchant outcome is the brief. The how is yours to design — make it as clean and scalable as you can, but the brief doesn't bend."
- "If you see a way to ship something simpler that meets the brief, propose it. We'll take the simpler path."
- "If you think a feature in the brief doesn't actually serve the merchant — challenge it. We'll talk."

## Stickiness as a product KPI

(See `13-long-term-game.md` for the strategic version.) From a product perspective, every feature decision should be scored on: does this make the merchant *more sticky*?

Net churn near 0.5% (gross sub-1%) — almost unheard of for SMB SaaS — comes from product decisions, not from CS heroics. Each module that adds to the merchant's daily routine is another wall preventing them from leaving.

That's the real prize of multiproduct strategy. Not just ARPU growth — churn collapse.
