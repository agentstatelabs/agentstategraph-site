---
title: Taint & Quarantine
description: Mark sensitive paths and enforce access restrictions at commit time.
---

`agentstategraph-taint` is a mark-and-sweep primitive for flagging paths that need special handling. It provides three levels of control: **taint** (soft warning), **quarantine** (hard gate), and **watch** (change subscription).

## Taint — soft flag

A taint marks a path as sensitive. It doesn't block writes, but it surfaces in `policy_evaluate_change_with_taints` so agents and policies can react.

```json
// agentstategraph_taint
{
  "path": "/cluster/prod/secrets",
  "severity": "high",
  "reason": "Contains credentials — requires security review before any change",
  "tagged_by": "agent/security-scanner"
}
```

To remove a taint:
```json
// agentstategraph_untaint
{ "path": "/cluster/prod/secrets", "reason": "Secrets rotated and cleared" }
```

## Quarantine — hard gate

A quarantine blocks all writes to the path until explicitly lifted. Use this for paths undergoing incident investigation, compliance review, or a freeze period.

```json
// agentstategraph_quarantine
{
  "path": "/cluster/prod/network",
  "reason": "Network partition incident under investigation",
  "quarantined_by": "agent/incident-responder"
}
```

Lift the quarantine when the restriction is resolved:
```json
// agentstategraph_unquarantine
{ "path": "/cluster/prod/network", "reason": "Incident resolved, network verified stable" }
```

## Watch — change subscription

Watch subscribes an agent to notifications on a path. The next time the agent calls `reminder_remind_me`, it receives a reminder for each watched path that has changed since it last checked.

```json
// agentstategraph_watch
{
  "path": "/cluster/prod/replicas",
  "watcher": "agent/capacity-monitor",
  "reason": "Alert on replica count changes"
}
```

```json
// agentstategraph_unwatch
{ "path": "/cluster/prod/replicas", "watcher": "agent/capacity-monitor" }
```

## Listing active taints

```json
// agentstategraph_list_taints
{ "severity": "high" }
```

Response:
```json
[
  {
    "path": "/cluster/prod/secrets",
    "severity": "high",
    "reason": "Contains credentials",
    "tagged_by": "agent/security-scanner",
    "created": "2026-04-06T10:00:00Z"
  }
]
```

## Checking before a commit

Before making a change that touches multiple paths, check for taints in a single call:

```json
// agentstategraph_check_taint
{ "paths": ["/cluster/prod/secrets", "/cluster/prod/network"] }
```

Response:
```json
{
  "/cluster/prod/secrets": { "tainted": true, "severity": "high", "quarantined": false },
  "/cluster/prod/network": { "tainted": false, "quarantined": true }
}
```

## Combined policy + taint evaluation

Use `policy_evaluate_change_with_taints` to run both checks in one call:

```json
// agentstategraph_policy_evaluate_change_with_taints
{
  "agent_id": "agent/deployer",
  "paths": ["/cluster/prod/secrets"],
  "intent_category": "Fix"
}
```

Response includes both the policy decision and any taint warnings, letting the agent decide whether to proceed, request approval, or abort.

## Severity levels

| Level | Meaning |
|---|---|
| `low` | Informational — surfaces in reports but rarely blocks |
| `medium` | Notable — many policies treat this as RequireApproval |
| `high` | Sensitive — most policies deny or require senior approval |
| `critical` | Emergency stop — typically maps to quarantine |
