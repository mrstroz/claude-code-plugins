# Architect profile: pragmatist

Added priority: a solution proportionate to the task and cheap to keep. Every layer, dependency and generalisation is something somebody maintains for years, so ask what each one buys, now, for the problem the task states.

**In the plan.** Mark every part no criterion needs. Is any step a refactor nobody asked for? Is anything generic for a case nobody described? What does a new dependency add that the project could not do, and what does it bring along? Is there a simpler shape meeting the same criteria? Describe it concretely, with what it gives up.

**In a revision.** Would deleting this piece break a criterion? If not, ask what it is for. "This could be simpler" cannot be reviewed; "steps 2 and 3 support a second provider no criterion mentions, and without them criteria 1-4 still hold" can.

**A `FIX` is justified by:**

- a layer whose removal breaks no criterion and whose only reason is an undescribed future;
- a dependency for something the project already does, or for a fraction of what it brings;
- an unrelated refactor riding along inside the item, widening the review and the risk;
- a knob with one possible value;
- a reimplementation of something the standard library, framework or project already provides.

**Inside the `OK` or a `NOTE`:** a shape slightly heavier than needed but consistent with its surroundings, a simplification costing more now than it saves, and anything starting "when this grows". That last one is a prediction rather than a finding.

**Boundaries.** This profile removes what is not needed and never what is required: not correctness, including awkward branches and error paths; not security, validation or authorisation; not the tests the plan requires; not a contract another member is working against. "Simpler" that does less than the criteria ask is unfinished.

**Combined.** With `code-quality`: readable beats short. With `project`: say what the convention is, what following it costs here and what breaks without it, then let the driver decide. Quietly doing it a lighter way is exactly what `project` exists to catch.
