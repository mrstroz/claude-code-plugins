# What the tracker understands

Descriptions and comments are written as Markdown and converted to the tracker's
rich-text format by [`scripts/adf.mjs`](../scripts/adf.mjs). This is the whole dialect. It
is deliberately narrow: every construct below was checked against real issues in the instance
these skills talk to, because the format permits far more than any one renderer draws.

**Nothing here ever fails in the converter.** Anything it does not recognise becomes a plain
paragraph rather than an error, so a description with an odd character still posts. The one
thing checked before a write is a mention, below.

## Blocks

| You write | You get |
|---|---|
| `# Heading` … `###### Heading` | heading, levels 1–6 |
| a paragraph | paragraph; soft-wrapped lines join with a space |
| a line ending in `\` | a line break inside the paragraph |
| `- item` / `* item` | bullet list |
| `1. item` | numbered list |
| two spaces of indent | the list nests |
| `- [ ] item` / `- [x] item` | **checkbox**, unticked or ticked |
| `> quoted` | block quote |
| `> [!WARNING] text` | coloured panel |
| <code>\`\`\`lang</code> … <code>\`\`\`</code> | code block, syntax highlighted |
| `\| a \| b \|` + `\| --- \| --- \|` | table; the row above the divider is the heading |
| `---` | horizontal rule |
| `![alt](name.png)` | the attached image, inline |
| `<details><summary>Title</summary>` … `</details>` | collapsible section |

Panel types: `[!INFO]`, `[!NOTE]`, `[!TIP]`, `[!SUCCESS]`, `[!WARNING]`, `[!ERROR]`.
`[!CAUTION]` and `[!IMPORTANT]` are accepted as the first two of those. Anything else becomes
an info panel rather than an error.

A list item may hold more than a sentence. Indent a code block, an image or a second paragraph
under it — leaving a blank line before a second paragraph — and it stays inside the item.

## Inline

| You write | You get |
|---|---|
| `**bold**`, `*italic*`, `~~struck~~`, `` `code` `` | the mark |
| `[label](url)` | a link |
| `https://example.com/page` on its own | a link, without writing the brackets |
| `<https://example.com/page>` | a **smart link** — the card with the page's own title |
| `PROJ-42` | a smart link to that issue, showing its summary and status |
| `@[Firstname Lastname]` | a **mention** — the person, notified |
| `:rocket:` | the emoji |
| `{status:green\|SHIPPED}` | a status lozenge — colours: neutral, purple, blue, red, yellow, green |

An issue key only becomes a card when it is the project's own key, which the converter reads
from the configuration. `UTF-8` and `ISO-8601` are not issue keys and are left alone.

**A mention is the one construct that can fail the write.** The name is resolved through `people`
in the configuration first, then through the people already on the issue — reporter, assignee,
everyone who commented. A bare first name, `@[Jeff]`, works when it names exactly one of them. A
name nobody can place stops the command before anything is sent, printing the names it knows and
what the tracker's directory holds under that name, ready to paste into `people`. Nothing is
dropped quietly, because a dropped mention is a person who never learns they were needed.
`` `@[Name]` `` in backticks is the syntax rather than a mention, and is left alone.

**Formatting wins over decoration.** A card, a lozenge, an emoji and a mention are nodes, and the
format gives a node nowhere to carry a mark — so `**PROJ-42**` stays bold text rather than becoming
a card that has lost its bold, and `**@[Name]**` stays bold text rather than a mention that lost
it. Write either on its own when the node is what you want.

## Images

An image has to be attached to the issue before a description can show it, which is what
`--attach` does:

```bash
jira.mjs create-issue … --description-file draft.md --attach shot.png,second.png
jira.mjs update-issue <KEY> --description-file draft.md --attach shot.png
jira.mjs attach-file <KEY> --file shot.png
```

Refer to it in the description **by file name** — `![the overview](shot.png)` — and the upload
is matched to it. A file the description names but nothing attached is not silently dropped:
the line says which file is missing, and the command says so on the error stream.

`![alt](https://example.com/d.png)` — an image the tracker does not hold — becomes a link, not
a picture. Attach it if it has to be visible.

## Reading is the same dialect backwards

`get-issue` converts a description the other way, into exactly the Markdown above. That is
what makes `get-issue` → edit → `update-issue` safe: a table somebody drew in the editor, a
checkbox somebody ticked and an image somebody pasted all come back as text this converter can
write again.

Three things change on the way back, and all three lose formatting rather than words:

- **A mention** comes back as `@[Name]`. `update-issue` resolves it through the mentions the
  current description already holds, then `people`, then the thread — so editing a description
  keeps its mentions, while a mention typed fresh has to name somebody one of those knows.
- **Decision lists** flatten to plain text.
- **A break inside a checkbox** becomes a space, because a checkbox is one line here.
- **Indentation and trailing spaces** may shift by a character. Nothing moves between blocks.

## What is deliberately absent

Nested tables, merged cells and column widths; layouts and image sizing; `type: "external"`
media, which the instance was never seen to render; and any construct that would need the
editor to have written it first.
