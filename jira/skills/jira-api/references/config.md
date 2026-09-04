# `.ai/jira.config.json`

One file per project, committed, searched for from the working directory upwards. `tracker` is
what `jira.mjs` needs; everything else is optional and read by the skills that use it, through
`jira.mjs show-config --json`, so no skill parses this file by hand.

```json
{
  "tracker": {
    "site": "company.atlassian.net",
    "projectKey": "PROJ"
  },
  "people": {
    "Firstname Lastname": "557058:00000000-0000-0000-0000-000000000000"
  },
  "language": "en",
  "taxonomy": {
    "subsystemPrefixes": ["BE", "FE"],
    "categories": ["bug", "feature", "refactor", "security", "documentation"]
  },
  "risk": {
    "high": ["auth", "payments", "migrations", "shared contracts"],
    "low": ["documentation", "tests only", "cosmetic"]
  }
}
```

| Block | Required | Read by | What it does |
|---|---|---|---|
| `tracker.site` | yes | every operation | the host every request goes to |
| `tracker.projectKey` | yes | every operation | composed into every search; the only project whose keys become smart links |
| `people` | no | `--assignee`, `@[Name]` | display name → account id; `find-user` prints lines to paste here |
| `language` | no | `jira-task` | the language issues are written in; without it the skill reads the newest issues to decide |
| `taxonomy.subsystemPrefixes` | no | `jira-task` | the `[BE]`, `[FE]`, `[BE+FE]` prefix on a title; without it the skill infers subsystems from the repository and asks |
| `taxonomy.categories` | no | `jira-task` | the one label naming what kind of change this is; without it no category label is set |
| `risk.high`, `risk.low` | no | `jira-task` | areas that make a change dangerous or harmless to deploy; without them no `Risk` section and no `risk-*` label |

**The Tesoro fallback.** A project that already has `.ai/tesoro.config.json` needs no second file:
`jira.mjs` reads `tracker`, `people`, `taxonomy` and `risk` from it when `.ai/jira.config.json` is
absent, and says so on stderr. The two files share their shape on purpose. When both exist, the
JIRA one wins.

**No credentials here.** `JIRA_EMAIL` and `JIRA_API_TOKEN` live in the shell environment. This
file is committed and the token is not, and the file has nothing in it that a colleague cloning
the repository should not see — an account id is public inside the instance.

**Writing it for the first time.** When the script exits `2` saying no file was found, ask once
for the site and the project key, then offer to create the file with `tracker` and an empty
`people`. Never invent the optional blocks: a `risk` list guessed from a directory listing gets
believed by every issue written afterwards.
