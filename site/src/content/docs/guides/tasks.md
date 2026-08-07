---
title: Tasks & plans
description: Durable, proof-gated task tracking with priorities, blockers, assignment, and pull-based scheduling.
---

`agentstategraph-tasks` is a durable work-tracking primitive built on the graph.
A **plan** is a container of **tasks** that survives across sessions, so an agent
picking up work later sees exactly what's done, what's next, and why. Completion
is **proof-gated** — a task can't be marked done without evidence — and the store
schedules the next actionable task on demand rather than pushing work.

Available in every binding (`TaskStore`) and over MCP.

## Creating a plan and adding tasks

```json
// agentstategraph_create_plan
{ "plan": "launch", "title": "Cut the 0.9.21 release" }
```

```json
// agentstategraph_add_task
{
  "plan": "launch",
  "title": "Run the full test matrix",
  "priority": "high",
  "blockers": []
}
```

**Priority:** `low`, `medium`, `high`. **Blockers** are task ids that must
complete first — a blocked task is never returned by `next_task` until its
blockers clear.

## Working a task

```json
// agentstategraph_start_task   → marks in-progress
{ "plan": "launch", "id": "task-1" }
```

```json
// agentstategraph_complete_task   → requires proof
{
  "plan": "launch",
  "id": "task-1",
  "proof": { "kind": "commit", "value": "abc123" }
}
```

**Proof kinds** record *how* the work was verified (e.g. a commit sha, a test
run, a reviewed artifact). A completion without valid proof is rejected — this is
what keeps a plan's history trustworthy across agents and sessions.

## Scheduling the next task

Instead of pushing work, ask the store what to do next:

```json
// agentstategraph_next_task        → highest-priority unblocked task
{ "plan": "launch" }

// agentstategraph_next_task_for    → scoped to one assignee
{ "plan": "launch", "assignee": "agent/release-bot" }
```

`next_task` returns the highest-priority task whose blockers are all satisfied,
skipping in-progress and completed work — the pull-based equivalent of a work
queue.

## Assignment & inspection

- `agentstategraph_assign_task` / `unassign_task` — route a task to an agent id.
- `agentstategraph_list_plans` / `list_tasks` — enumerate plans and their tasks
  (filterable by status).
- `agentstategraph_get_plan` — full plan detail: tasks, statuses, blockers, proof.
- `agentstategraph_abandon_task` — drop a task that's no longer relevant.

Plans have their own lifecycle too — created, closed when the work is done, and
archived to keep the active list clean, all recorded in the graph's history.

## See also

- [Reminders](/guides/reminders/) — pull-based scheduling for *time-triggered* work
- [Core Concepts](/guides/concepts/) — how plans and tasks are stored as graph state
