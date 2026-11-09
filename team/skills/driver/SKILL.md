---
name: driver
description: Take the driver seat in a team run — do the task, hold the plan and report to the user, while architects and testers in other sessions, possibly in other CLIs such as Codex, review the plan and verify the result through shared files. Invoke by hand with /team:driver.
argument-hint: "<task name and what it is about> [lite]"
disable-model-invocation: true
---

# Team driver

Task: $ARGUMENTS

Pick a short task name, then run:

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/team.mjs start <task> --runtime claude-code [--mode lite]
```

Read `<run>/roles/driver.md`, which `start` copied into the run together with `PROTOCOL.md`, and follow it. Use the run's copy of the script from then on, so the whole run keeps one version.

Wait as `PROTOCOL.md` says for a CLI with background commands: run `wait --timeout 3600 --soft-timeout` with `run_in_background: true` and end your turn. Run `watch` in the background the same way when a member's `team.md` row shows `wake=`.
