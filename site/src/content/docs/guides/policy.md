---
title: Policy
description: Authorization and cost-of-change gating with Cedar, Rego, and WASM evaluators.
---

The `agentstategraph-policy` crate adds an authorization and cost-of-change gating layer on top of commits. Policies are stored in the state graph itself under `/_meta/policies/`, so every policy change is auditable via `log` and `blame`.

## What policies do

A policy is a named rule with:
- **Subject** — which agent or role this applies to
- **Predicate** — which paths and intent categories are governed
- **Decision** — `Allow`, `Deny`, or `RequireApproval`
- **Fallback** — what happens when no policy matches (configurable server-wide as `allow` or `deny`)

Policies are **soft enforcement by default**: a `Deny` decision is recorded in the audit trail but the commit may or may not be blocked depending on your server configuration. This lets you gradually roll out governance without breaking existing workflows.

## Lifecycle: propose → ratify → active

```json
// 1. Propose a policy
// agentstategraph_policy_propose
{
  "id": "restrict-prod-deletes",
  "description": "Require approval for any Delete on /cluster/prod",
  "subject": { "any": true },
  "predicate": {
    "paths": ["/cluster/prod/**"],
    "intent_categories": ["Fix", "Rollback"]
  },
  "decision": "RequireApproval"
}

// 2. Ratify it (a human or authorized agent approves)
// agentstategraph_policy_ratify
{ "policy_id": "restrict-prod-deletes", "ratifier": "cbrown" }

// 3. It becomes active immediately after ratification
```

## Evaluating a change

Before committing a sensitive change, evaluate it against active policies:

```json
// agentstategraph_policy_evaluate_change
{
  "agent_id": "agent/deployer",
  "paths": ["/cluster/prod/replicas"],
  "intent_category": "Refine",
  "change_size": 1
}
```

Response:
```json
{
  "decision": "Allow",
  "matched_policy": "restrict-prod-deletes",
  "reason": "Intent category Refine is not in the predicate — not governed"
}
```

## Evaluating with taints

If the paths being changed carry taint markers, use the combined evaluator:

```json
// agentstategraph_policy_evaluate_change_with_taints
{
  "agent_id": "agent/deployer",
  "paths": ["/cluster/prod/replicas"],
  "intent_category": "Fix"
}
```

This runs both the policy check and the taint check in a single call and surfaces both results.

## Evaluators

| Backend | Description |
|---|---|
| Built-in | Simple subject/predicate/decision rules — covers most cases |
| Cedar | Amazon Cedar attribute-based access control |
| Rego | Open Policy Agent (OPA) policies in `.rego` format |
| WASM | Custom evaluator compiled to WASM; runs in the embedded WASM host |

```json
// agentstategraph_policy_cedar / agentstategraph_policy_rego
{
  "policy_id": "my-cedar-policy",
  "source": "permit(principal, action == Action::\"set\", resource) when { ... };"
}
```

## Policy signing

For high-assurance environments, policies can be signed with Ed25519 keys. When the server is configured with `require_signed_policies: true`, unsigned policies are filtered from the active set and do not participate in evaluation.

```json
// agentstategraph_policy_sign
{ "policy_id": "restrict-prod-deletes" }

// agentstategraph_policy_verify
{ "policy_id": "restrict-prod-deletes" }
```

## Managing policies

```json
// List all policies (with optional status filter)
// agentstategraph_policy_list
{ "status": "active" }

// Get a specific policy
// agentstategraph_policy_show
{ "policy_id": "restrict-prod-deletes" }

// View history of a policy (propose → ratify → supersede chain)
// agentstategraph_policy_history
{ "policy_id": "restrict-prod-deletes" }

// Replace an active policy with a new version
// agentstategraph_policy_supersede
{
  "old_policy_id": "restrict-prod-deletes",
  "new_policy_id": "restrict-prod-v2",
  "reason": "Extend to cover /cluster/prod/network as well"
}

// Check token cost before a commit
// agentstategraph_policy_check_tokens
{ "agent_id": "agent/deployer", "estimated_tokens": 5000 }
```
