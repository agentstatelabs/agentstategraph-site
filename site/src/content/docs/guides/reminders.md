---
title: Reminders
description: Pull-based scheduling with priority, recurrence, and approval gating.
---

`agentstategraph-reminders` is a pull-based scheduling primitive. Instead of pushing notifications to agents, reminders accumulate in the store and agents retrieve what's due when they're ready. This matches how agents actually work: they check in at the start of a session rather than maintaining a persistent connection.

## Creating a reminder

```json
// agentstategraph_reminder_create
{
  "id": "weekly-capacity-review",
  "description": "Review cluster capacity and scaling decisions from the past week",
  "due_at": "2026-04-13T09:00:00Z",
  "priority": "high",
  "assigned_to": "agent/capacity-monitor",
  "recurrence": "weekly",
  "approval_required": false,
  "tags": ["capacity", "weekly"]
}
```

**Recurrence options:** `none`, `daily`, `weekly`, `monthly`, or a cron expression.

## Checking what's due

An agent calls `reminder_remind_me` at the start of each session to retrieve all reminders currently due for its identity:

```json
// agentstategraph_reminder_remind_me
{}
```

Response:
```json
[
  {
    "id": "weekly-capacity-review",
    "description": "Review cluster capacity and scaling decisions from the past week",
    "priority": "high",
    "due_at": "2026-04-13T09:00:00Z",
    "tags": ["capacity", "weekly"]
  }
]
```

Watch-triggered reminders (from `agentstategraph_watch`) also appear here when the watched path has changed.

## Snoozing

If an agent isn't ready to act on a reminder, it can snooze it to a new due time:

```json
// agentstategraph_reminder_snooze
{
  "reminder_id": "weekly-capacity-review",
  "snooze_until": "2026-04-14T09:00:00Z",
  "reason": "Waiting for last night's metrics to be fully ingested"
}
```

## Approval-gated reminders

Set `approval_required: true` to hold a reminder in `pending_approval` state until a human or authorized agent approves it. This is useful for change windows, compliance reviews, or maintenance gates.

```json
// Create with approval gate
// agentstategraph_reminder_create
{
  "id": "prod-maintenance-window",
  "description": "Apply pending cluster updates",
  "due_at": "2026-04-20T02:00:00Z",
  "assigned_to": "agent/maintenance",
  "approval_required": true
}

// Approve it
// agentstategraph_reminder_approve
{
  "reminder_id": "prod-maintenance-window",
  "approved_by": "cbrown"
}
```

## Recording execution

After acting on a reminder, record what was done:

```json
// agentstategraph_reminder_record_execution
{
  "reminder_id": "weekly-capacity-review",
  "result": "Reviewed 47 commits. Scaled down 2 nodes. No anomalies.",
  "outcome": "success"
}
```

For recurring reminders, recording execution schedules the next occurrence automatically.

## Cancelling

```json
// agentstategraph_reminder_cancel
{ "reminder_id": "weekly-capacity-review", "reason": "Replaced by automated capacity agent" }
```

## Listing reminders

```json
// agentstategraph_reminder_list
{ "assigned_to": "agent/capacity-monitor", "status": "active" }
```

## Integration with Watch

`agentstategraph_watch` creates implicit reminders. When a watched path changes, a reminder appears in the watcher's `reminder_remind_me` results. The reminder includes the path, the commit that changed it, and the intent behind the change — so the agent has full context without querying separately.
