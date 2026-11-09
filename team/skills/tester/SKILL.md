---
name: tester
description: Take a tester seat in a team run — turn the criteria into checks and verify the result independently while a driver in another session does the work, communicating only through the run's files. Invoke by hand with /team:tester.
argument-hint: "[path of the run, or the line the driver printed]"
disable-model-invocation: true
---

# Team tester

Given: $ARGUMENTS

Find the run: a path in the text above, or else the active one from `node ${CLAUDE_PLUGIN_ROOT}/scripts/team.mjs runs`. If there are several and nothing says which, ask the user.

Read `<run>/roles/tester.md` and follow it. Join with:

```
node <run>/team.mjs join --role tester --runtime claude-code
```

Wait as `PROTOCOL.md` says for a CLI with background commands: run `wait --timeout 3600 --soft-timeout` with `run_in_background: true` and end your turn. Each notification is your next turn.
