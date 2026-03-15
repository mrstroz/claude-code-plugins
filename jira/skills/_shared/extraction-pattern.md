# Extraction Pattern — Subagent Orchestration

Instead of calling `getJiraIssue` directly in the main context (which dumps raw descriptions and comments into the conversation), delegate data fetching to subagents. Each subagent processes a batch of issues in its own isolated context and returns only condensed summaries.

## Batching

Take the list of issue keys eligible for individual fetching (after applying the prioritization cap from the skill's instructions) and split them into batches:

- **Batch size:** 5-7 issue keys per batch
- **Distribution:** prefer even batches (e.g., 18 issues → 3 batches of 6, not 2×7 + 1×4)
- **Minimum:** if 5 or fewer issues total, use a single batch

## Spawning Subagents

Spawn ALL batches in a **SINGLE message** using multiple Task tool calls for maximum parallelism. Each Task call uses:

- `subagent_type: "jira:issue-extractor"`
- `prompt:` containing the batch-specific data and the skill's extraction template

### Prompt Template

For each batch, provide this prompt to the Task tool:

```
Extract data from the following Jira issues.

Cloud ID: {cloudId}
Fields to fetch: {fields}
Issue keys: {comma-separated list of keys in this batch}

Extraction template:
{skill-specific extraction instructions — what to extract from each issue}

Return format:
{skill-specific return format — one line per issue}
```

Replace `{cloudId}`, `{fields}`, issue keys, and the extraction template/return format with the actual values. The extraction template and return format are defined in the calling skill's step instructions.

## Aggregation

After all subagents complete:

1. Collect the text output from each agent
2. Concatenate all results into a single list (each agent returns one line per issue)
3. Use these condensed results in subsequent steps instead of raw Jira data

## Error Handling

- If a subagent fails entirely (timeout, crash), proceed with results from successful agents
- Individual issue errors appear as `{KEY}: ERROR — {reason}` in the agent output — note these and fall back to the `summary` field from the JQL search step for those issues
- Do not retry failed agents — use available data and move forward
