# Examples

Five pairs of raw input and finished draft. They exist because the shape of a
comment is not something this skill picks from a menu. It falls out of what the
user actually has to say. These pairs show the range: prose, a list, an answer
to a thread, a Polish comment, and a draft built on guesses.

Read them as patterns, not templates. What matters is the judgement they
demonstrate: how many points there really are, and what belongs in the comment
rather than beside it.

---

## 1. One thought stays prose

**Input** (dictated, rough):

> yeah so um I checked staging today and basically it does happen there too,
> like the same 500 error when you use the date range filter, and uh I also
> noticed that it works fine if you only pass one of them

**Draft:**

```
Confirmed on staging. The same 500 error happens when the date range filter
gets both `startDate` and `endDate`. With only one of them the request works
fine.
```

There is one finding here, so there is nothing to enumerate. A bulleted list of
one observation split into three fragments would look organised and say less.

---

## 2. Several separate things become a list

**Input** (dictated, rough):

> ok so I went through the export feature and um there are a few things, first
> the big one is that the date columns are not formatted correctly, they come
> out as like unix timestamps instead of human readable dates which is kind of
> a blocker, also the CSV doesn't include the report title in the filename it's
> just like export.csv which makes it hard to find later, um what else, oh yeah
> the column headers are using the internal field names like created_at instead
> of the display names we show in the UI, and uh the export takes about 20
> seconds for a monthly report which seems slow but I'm not sure if that's
> expected, and one more thing the decimal numbers use dots but our users expect
> commas for the decimal separator

**Draft:**

```
I went through the CSV export for monthly reports. Five things:

- Date columns come out as Unix timestamps instead of real dates. This one
  blocks users.
- Decimal numbers use a dot. Our users expect a comma.
- Column headers show internal field names like `created_at` instead of the
  names we display in the UI.
- The file is always called `export.csv`, so nobody can tell one download from
  another. It should carry the report title.
- One monthly report takes about 20 seconds. Is that expected, or too slow?
```

Five real problems, five points, and the blocker goes first because that is the
one somebody has to act on.

Look at the shape of the points rather than their content. They run from one
line to two, and they end differently: a consequence, a plain fact, a
prescription, a question. Five points built to one pattern (statement, em dash,
implication) are the clearest sign in this whole file that nobody wrote them.
Uneven is what human lists look like.

Note also what is missing: not a single em dash. Where one would have gone, the
sentence simply ends and a new one starts, which fixes the rhythm at the same
time.

---

## 3. A thread with an open question gets answered first

**Thread, last three comments:**

1. *(Maria, 2 days ago)* The 500 started after the v2.3 deploy. I think it is
   the new date range validation in `OrderQueryService`.
2. *(Piotr, 1 day ago)* Validation looks correct to me. It might be the SQL
   builder — the `WHERE` clause uses `BETWEEN` but the params arrive as strings,
   not DateTime.
3. *(Anna, 2h ago)* Can anyone confirm this reproduces on staging? And does it
   happen with all filter combinations or only the date range?

**Input:**

> yeah I checked staging and it does happen there too, same 500 when you use
> both start and end date, works fine with just one of them, and honestly Piotr
> might be right about the SQL builder but I didn't verify that

**Draft:**

```
Both answers for Anna: yes, it reproduces on staging, and no, not with every
filter combination. Only the date range breaks it, and only when `startDate`
and `endDate` are sent together.

Piotr's SQL builder idea sounds right to me, but I have not checked it. Treat
that part as a guess.
```

Anna asked two questions two hours ago, so the draft opens with two answers and
says which is which. Someone reading it should recognise it as a reply, not as
a standalone note that happens to sit below her comment.

The terminology is lifted from the thread: `OrderQueryService`, `startDate`,
`endDate`. A synonym forces every reader to work out whether some new thing is
being discussed.

The caveat did not become a bullet. A list of one item is not a list; it is a
paragraph wearing a dash. And the hedge stays in: the user said "might be" and
"didn't verify", so the draft says the same. Turning that into a confident
claim would put words in their mouth that the thread will later hold them to.

---

## 4. A Polish thread gets a Polish comment

**Issue:** SHP-412 — "Integracja z API kuriera: paczki nie dostają numeru listu"

**Thread, last comment:**

> *(Kasia, 3h temu)* Czy to dotyczy wszystkich przewoźników, czy tylko DPD?

**Input:**

> sprawdziłem, tylko dpd, u inpostu i dhl numery lecą normalnie, wygląda na to
> że dpd zwraca numer dopiero w drugim callu a my go nie czytamy

**Draft:**

```
Tylko DPD. U InPostu i DHL numery listów nadają się normalnie.

Wygląda na to, że DPD zwraca numer dopiero w odpowiedzi na drugie wywołanie,
a my czytamy tylko pierwsze — tam tego pola jeszcze nie ma.
```

The thread runs in Polish, so the comment does too. Nobody was asked which
language to use.

The dash appears once, and it earns its place: the clause after it explains the
clause before it, which is ordinary Polish punctuation. Polish is not English
here. The pause is a normal sign, and stripping every one of them leaves the
text stiff. What gives a machine away is density, one per paragraph at most,
and reaching for it in place of every other mark.

"Wygląda na to" survived from the input on purpose. Without it the sentence
becomes a diagnosis nobody has confirmed.

---

## 5. A vague input still produces a draft, with the guesses beside it

**Input:**

> to nadal nie działa na tym drugim środowisku

**Draft:**

```
Still broken on staging, same 500 as before.
```

**Shown under the draft, outside the comment:**

> Assumptions: "the other environment" read as staging, since the thread only
> ever compares production and staging. "Still broken" read as the same 500,
> not a new error. Say the word if either is wrong.

Vague input is not a reason to stop and ask. A draft costs one round trip to
correct and zero to accept, whereas a question costs a round trip every time,
including the times the guess would have been right.

Two things make this work. The draft stays as short as the input: there was one
fact, so there is one sentence, with no padding to make it look considered. And
every guess is listed where it cannot be posted by accident, below the comment
rather than inside it.
