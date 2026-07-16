---
title: Namespaces
description: Ref-layer isolation for multi-project and multi-tenant deployments.
---

Namespaces give every project or tenant its own isolated ref space. Branches, commits, and state in namespace `tenant-a` are completely invisible to `tenant-b` — they share storage but not refs.

## Creating a namespace

```json
// Tool: agentstategraph_create_namespace
{ "namespace": "tenant-acme", "description": "ACME Corp state" }
```

## Listing and deleting

```json
// agentstategraph_list_namespaces
{}

// agentstategraph_delete_namespace
{ "namespace": "tenant-acme" }
```

## Per-call namespace override

Every tool accepts an optional `namespace` parameter. When set, the operation runs against that namespace instead of the server's configured default — no server restart required.

```json
// agentstategraph_set with namespace override
{
  "namespace": "tenant-acme",
  "path": "/config/region",
  "value": "us-west-2",
  "intent_category": "Checkpoint",
  "intent_description": "Set region for ACME"
}
```

## Cross-namespace merge

Merging across namespaces is possible but **denied by default**. To allow it, the source and target namespace policies must both permit the operation.

```json
// agentstategraph_cross_namespace_merge
{
  "source_namespace": "staging",
  "source_ref": "main",
  "target_namespace": "production",
  "target_ref": "main",
  "intent_description": "Promote staging to production",
  "reasoning": "All integration tests passed"
}
```

## Multi-tenant Postgres

When using the Postgres storage backend, each namespace maps to an isolated schema, enabling a single database server to host hundreds of tenants with full ref isolation and no cross-tenant data leakage.

```bash
# Start with Postgres + per-namespace schemas
agentstategraph-mcp --http --db postgres://user:pass@host/asg
```

## Common patterns

| Pattern | How |
|---|---|
| One namespace per environment | `dev`, `staging`, `production` |
| One namespace per team | `team-infra`, `team-ml`, `team-platform` |
| One namespace per customer | `tenant-acme`, `tenant-globex` |
| Shared state namespace | `shared` namespace with read-only cross-namespace merges |
