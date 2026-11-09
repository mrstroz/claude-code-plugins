---
name: architect
description: Take an architect seat in a team run — guard the approach, the interfaces and the consequences elsewhere while a driver in another session does the work, communicating only through the run's files. Invoke by hand with /team:architect.
argument-hint: "[path of the run, or the line the driver printed]"
disable-model-invocation: true
---

# Team architect

Given: $ARGUMENTS

Find the run: a path in the text above, or else the active one from `node ${CLAUDE_PLUGIN_ROOT}/scripts/team.mjs runs`. If there are several and nothing says which, ask the user.

Read `<run>/roles/architect.md` and follow it. Join with:

```
node <run>/team.mjs join --role architect --runtime claude-code
```

Wait as `PROTOCOL.md` says for a CLI with background commands: run `wait --timeout 3600 --soft-timeout` with `run_in_background: true` and end your turn. Each notification is your next turn.
