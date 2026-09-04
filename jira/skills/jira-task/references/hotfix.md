# HOTFIX

A defect that has to reach production without waiting for the next release. Read [the shape of
an issue](sections.md) with this file. It says what goes in each section below, and this file only
says which sections a `HOTFIX` has and what the urgency has to add.

A `HOTFIX` is a [`Bug`](bug.md) that goes straight to production, so the shape is the same one.
The type is a statement about the deployment, not a shortcut past anything: an issue that
qualifies for it carries the same evidence and the same open questions as any other defect.

```markdown
> [!WARNING] …                              (only when the premise was reasoned, not watched)

## TLDR

What a user sees, and what they should see instead. Two sentences.
A third: what happens if this waits for the next release.

## Out of scope                              (only what somebody actually decided)

- records already broken stay as they are — when that is the decision, and not otherwise

## Steps to reproduce

1. …
2. …
3. Observed: … / Expected: …

## Acceptance criteria

- [ ] the defect no longer reproduces by the steps above
- [ ] whatever else must stay true, so the fix cannot trade one bug for another

## Findings                                  (only when the reporter already knows)

- `path/to/the/file` — `theMethod()`, one sentence on why it is the suspect
- how that part behaves today, when that is what makes the defect possible
- Suspected: what the reporter believes the fix is — only when they already know, never a guess

## Risk                                      (only when the configuration defines risk areas)

risk-<level> — one sentence naming the reason.

## Open questions                            (only when there are any)

- Q1: the question, phrased so a yes or a no answers it

## Demo                                      (only when there is a recording)
```

**The third sentence is the whole difference, and it is not a request for an exemption**: it is
the reason somebody is being asked to skip the queue. "Every new registration fails" earns it.
"This is urgent" is true of every hotfix ever filed and therefore says nothing. Write what is
happening in production between now and the next release, in the terms whoever has to approve
the deployment will weigh.

A hotfix is written under time pressure, which is exactly when a report degrades into a sentence
and a stack trace. The sections that survive that pressure worst are the two that cost the next
person most: what was actually observed, and what nobody has checked. Both have somewhere to go,
the last reproduction step and `Open questions` with the panel pointing at it.

## A worked example

A hotfix where the symptom was watched and the cause was not, which is the ordinary case at speed,
so the panel goes on and names which question carries the doubt. Note what that costs: nothing.
The report is still worth filing, it is simply filed as what it is.

The third `TLDR` sentence does the work the type exists for. It does not say "urgent"; it says
what is happening to every customer between now and the next release. That is a sentence somebody
can weigh against the risk of deploying at night.

`Findings` says how the code behaves today and stops there. Which path actually fires is `Q1`, not
a `Suspected:` line, because nobody watched it happen: the author read the code and reasoned. A
suspicion the author holds goes in marked; a suspicion the report merely produces goes in as a
question. This project has no `risk` block, so there is no `Risk` section.

```markdown
[api] Password reset mails are sent with an expired link

> [!WARNING] The symptom was watched on two accounts; the cause was read off the code. Which of
> the two clocks is wrong has not been established — see Q1.

## TLDR

Every password reset mail sent since this morning's deploy carries a link that the reset page
rejects as expired the moment it is opened. Users who forgot their password cannot get back in.
Until the next release, every locked-out customer has to go through support to have a password
set by hand.

## Out of scope

- reset tokens issued before the deploy are not reissued; those users request a new mail

## Steps to reproduce

1. Request a password reset for any account.
2. Open the link in the mail within a minute.
3. Observed: "this link has expired". Expected: the new-password form.

## Acceptance criteria

- [ ] A reset link opened within the configured window shows the new-password form.
- [ ] A reset link opened after the window is still rejected.
- [ ] Reset mails already in users' inboxes from before the fix are rejected with the same
      message, not accepted.

## Findings

- `src/auth/reset-token.service.ts` writes `expiresAt` as `Date.now() + window`, in milliseconds,
  and `reset.controller.ts` compares it against a value the database driver returns in seconds
  since the driver upgrade in this morning's deploy.
- The mail template and the token itself are unchanged; only the comparison moved.

## Open questions

- Q1: Is the driver's unit change intended, so the comparison should convert, or a regression in
  the driver, so it should be pinned back?
```
