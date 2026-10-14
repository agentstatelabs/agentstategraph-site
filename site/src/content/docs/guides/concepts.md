---
title: Core Concepts
description: The building blocks of AgentStateGraph.
---

## Objects

All state is composed of **Objects** — either atoms (null, bool, int, float, string, bytes) or nodes (Map, List, Set). Every object is content-addressed via BLAKE3 hash. Two objects with identical content always produce the same ObjectId.

## Commits

A **Commit** links a state tree to its history and provenance. Beyond git's tree + parents + message, AgentStateGraph commits carry:

- **state_root** — the content-addressed hash of the state tree (what changed)
- **agent_id** — who performed the action
- **authority** — who authorized it, with delegation chain
- **intent** — structured "why" with category, description, tags
- **reasoning** — the agent's chain-of-thought
- **confidence** — self-assessed certainty (0.0-1.0)
- **resolution** — what was accomplished, and any deviations from intent
- **notification** — who was informed of the change
- **tool_calls** — what actions produced this state change

## Intent Categories

| Category | Meaning |
|----------|---------|
| `Explore` | Trying an approach to evaluate it |
| `Refine` | Improving on a previous state |
| `Fix` | Correcting an error |
| `Rollback` | Reverting to a prior state |
| `Checkpoint` | Saving a known-good state |
| `Merge` | Combining work from branches |
| `Migrate` | Schema or structural change |
| `Plan` | Creating or updating a plan/task structure |
| `Taint` | Marking a path or resource as sensitive |
| `Untaint` | Removing a taint marker |
| `Quarantine` | Restricting access to a path |
| `Unquarantine` | Lifting a quarantine |
| `Watch` | Subscribing to change notifications on a path |
| `Unwatch` | Removing a watch subscription |
| `PolicyPropose` | Submitting a new policy for ratification |
| `PolicyRatify` | Approving a proposed policy |
| `PolicySupersede` | Replacing an active policy |
| `PolicySign` | Attaching an Ed25519 signature to a policy |
| `Custom` | Application-defined intent (carries a custom string label) |

## Branches

Branches are named pointers to commits. Creation is O(1). Namespace conventions:

- `main` — primary shared state
- `agents/{id}/workspace` — per-agent working branches
- `explore/{description}` — speculative exploration
- `proposals/{id}` — merge proposals

## Speculation

A lightweight, disposable branch optimized for the "try many approaches, pick the winner" pattern. Create is O(1) (just a pointer), discard is instant.

## Epochs

Bounded segments of work that can be sealed (made immutable) and exported as tamper-evident audit bundles. The Merkle root hash makes sealed epochs cryptographically verifiable.

## Sessions

Working contexts for sub-agent orchestration. Each session has an agent identity, working branch, parent session, delegated intent, and optional path scope restriction.

## Namespaces

A separate set of branches in one store. Every branch is keyed on a composite `(namespace, name)` primary key, so two namespaces can hold same-named branches without collision. Namespaces share the store's objects and commits, so they partition branches rather than isolate data; an API key bound to a namespace is how to confine a client to one. The ref-touching MCP tools accept an optional `namespace` parameter that routes the operation to a specific namespace without changing the server's default. Cross-namespace merges are always refused for now. See the [Namespaces guide](/guides/namespaces/).

## Policy

Authorization and cost-of-change gating for proposed changes. A policy is a named rule with a subject (who), a predicate (what paths, what intent categories), and a decision (`Allow`, `Deny`, or `RequireApproval`). Policies are stored in the state graph itself under `/_meta/policies/`, so every policy change is auditable via `log` and `blame`.

Policy is advisory: evaluate a proposed change before it lands, and act on the decision. The MCP `commit_spec` tool is the built-in gate: it refuses a speculation that policy denies, and by default one flagged as risky (a deletion, say) that no policy covers. See the [Policy guide](/guides/policy/).

Three evaluator backends are supported: a built-in rule engine, Cedar (attribute-based), and Rego (OPA). WASM host runners allow custom external evaluators. Policies can be signed with Ed25519 keys, and a policy store can be configured to skip unsigned policies.

## Taint & Quarantine

A mark-and-sweep primitive for flagging sensitive or dangerous paths. A **taint** marks a path as suspect, and its effect decides what happens on write: warn, block, require high confidence, or hide the path from search. Taints also surface in `policy_evaluate_change_with_taints`. A **quarantine** is a hard gate that blocks writes to the quarantined path until lifted.

**Watch** is a sibling operation: an agent can subscribe to change notifications on a path and receive them the next time it calls `reminder_remind_me`.

## Reminders

A pull-based scheduling primitive. Agents create reminders with a due time, priority, and optional recurrence rule. When an agent calls `reminder_remind_me`, it receives all reminders currently due for its identity. Reminders can require approval before they become active (`approval_required: true`) and can be snoozed with a new due time.

## Plans & Tasks

A structured work-tracking primitive layered on the state graph. A `Plan` contains `Task[]` objects with a strict state machine: `pending → in_progress → done`. Tasks support agent assignment, proofs of completion, and blockers. The `next_task` tool returns the next unblocked task for a given agent.

Plan-related commits use `IntentCategory::Plan` so they appear in `log` and `blame` filtered views.
