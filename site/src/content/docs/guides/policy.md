---
title: Policy
description: Authorization and cost-of-change gating with a built-in evaluator and pluggable external engines — OPA/Rego, Cedar, and WASM.
---

The `agentstategraph-policy` crate adds an authorization and cost-of-change gating layer on top of commits. Policies are stored in the state graph itself under `/_meta/policies/`, so every policy change is auditable via `log` and `blame`.

## What policies do

A policy is a named rule with:
- **Subject** — which agent or role this applies to
- **Predicate** — which paths and intent categories are governed
- **Decision** — `Allow`, `Deny`, or `RequireApproval`
- **Fallback** — for `RequireApproval`, what to do while approval is pending

Policy is **advisory**: evaluating it returns a decision, and the caller acts on it. Ordinary commits (library calls, HTTP, MCP `set`) don't consult policy. The built-in gate is MCP `commit_spec`, which promotes a speculation only when policy allows it, or when nothing in the change is flagged for policy. Pair policy with hard enforcement (Cedar/OPA/IAM at the perimeter) when you need a runtime kill-switch.

## Decisions

Evaluation produces a decision:

- **`Allow`** — the change may proceed.
- **`Deny`** — the change shouldn't proceed; `commit_spec` refuses it.
- **`RequireApproval`** — the change needs sign-off; it carries a fallback action describing what to do while approval is pending.
- **`NoPolicyMatch`** — no policy applied. The MCP server applies a fail-safe, `deny` by default (`--policy-fail-safe allow` or `ASG_POLICY_FAIL_SAFE=allow` to change it): the `policy_evaluate` tools report the result as a deny, and `commit_spec` refuses a change that carries tokens (`destructive`, `large`, ...) no policy covers. A change with no tokens can't match any policy, so `commit_spec` promotes it.

Precedence is `deny > require_approval > allow`, so the most restrictive matching policy wins.

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
{ "policy_id": "restrict-prod-deletes", "ratifier": "user" }

// 3. It becomes active immediately after ratification
```

## Evaluating a change

Before committing a sensitive change, evaluate it against active policies and act on the decision:

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

The built-in selector handles most cases, but when you need a full policy
language, three external engines plug into the same `ExternalEvaluator`
interface — so you can swap engines without changing how policies are stored,
ratified, or audited. All three are implemented and tested.

| Backend | Engine | Runtime requirement |
|---|---|---|
| **Built-in** | Subject/predicate/decision selector rules | None — always available, and the default |
| **Rego** | Open Policy Agent (OPA), `.rego` policies | The `opa` binary on `$PATH` |
| **Cedar** | Amazon Cedar attribute-based access control | The `cedar` binary on `$PATH` |
| **WASM** | A custom evaluator compiled to WebAssembly | None external — runs in an embedded `wasmtime` host |

### Selecting an engine

External engines are **opt-in at two levels**: they must be compiled in as a
Cargo feature, and enabled at hub startup.

1. **Build** the hub with the feature(s) you want: `policy-rego`,
   `policy-cedar`, `policy-wasm`, or `all-external-evaluators` for all three.
2. **Register** them at launch with the repeatable `--external-evaluator` flag:

   ```bash
   agentstategraph-mcp --http \
     --external-evaluator rego \
     --external-evaluator cedar
   ```

If a kind is requested but its feature wasn't compiled in, the hub logs a
warning and skips it (rather than failing to start). Rego and Cedar shell out to
their respective binaries, so those must be present on `$PATH`; the WASM runner
is self-contained.

A policy uses an external engine through its `external_evaluator` field, set when you propose it. The source is inline, a file path, or a path in the state tree:

```json
// part of a policy proposed with agentstategraph_policy_propose
"external_evaluator": {
  "kind": "cedar",
  "source": { "kind": "inline", "body": "permit(principal, action == Action::\"set\", resource) when { ... };" }
}
```

`kind` is `cedar`, `rego` or `wasm`; the source's `kind` is `inline` (with `body`), `file_path` (with `path`) or `commit_ref` (with `path`). A policy whose engine isn't registered is skipped.

## Policy signing

For high-assurance environments, policies can be signed with Ed25519 keys. A store built `with_verifier(...)` and `with_require_signed(true)` (in the MCP server, `with_policy_verifier` and `with_require_signed_policies(true)`) skips any policy that is unsigned or whose signature doesn't verify, so it takes no part in evaluation.

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
