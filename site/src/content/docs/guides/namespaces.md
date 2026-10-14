---
title: Namespaces
description: Separate sets of branches for projects or teams sharing one store.
---

A namespace is a separate set of branches in one store. Branches in namespace `acme` and namespace `globex` can share names (`main`, `release`) without colliding, and listing or reading branches in one namespace never shows the other's. One server and one database can hold many projects this way.

Namespaces partition **branches**. They are not a security boundary on their own: see [What a namespace doesn't separate](#what-a-namespace-doesnt-separate), and [Confining a client to one namespace](#confining-a-client-to-one-namespace) for how to keep a client inside one.

> **Availability:** namespaces are part of the advanced repository ABI. They are exposed over MCP and the HTTP API, and in the Rust, C FFI, and Swift bindings. The Python, TypeScript, WASM, Go, and .NET bindings do not expose namespaces yet — see the [binding capability matrix](/reference/capabilities/).

Every branch is keyed on a composite `(namespace, name)` primary key, in all four storage backends (in-memory, SQLite, Postgres, IndexedDB). A namespace name is ASCII letters, digits, `-` and `_`, 1–64 bytes; `default` is reserved.

## Creating a namespace

```json
// Tool: agentstategraph_create_namespace
{ "name": "acme" }
```

Creating a namespace that already exists succeeds and changes nothing.

## Listing and deleting

```json
// agentstategraph_list_namespaces
{}

// agentstategraph_delete_namespace
{ "name": "acme" }
```

Deleting a namespace deletes all of its refs. The `default` namespace can't be deleted.

## Per-call namespace override

The 17 ref-touching tools (`get`, `set`, `delete`, `branch`, `list_branches`, `merge`, `log`, `diff`, `speculate`, `query`, `blame`, `list_paths`, `get_tree`, `search`, `stats`, `commit_graph`, `intent_tree`) accept an optional `namespace` parameter. When set, the operation runs against that namespace instead of the server's configured default — no server restart required.

```json
// agentstategraph_set with namespace override
{
  "namespace": "acme",
  "path": "/config/region",
  "value": "us-west-2",
  "intent_category": "Checkpoint",
  "intent_description": "Set region for ACME"
}
```

The server's default namespace comes from `--namespace` or `ASG_NAMESPACE` (otherwise `default`). A session's `scope_namespace` overrides it for work done in that session.

## What a namespace doesn't separate

A store keeps one pool of objects and commits, shared by every namespace. Content addressing deduplicates identical data across namespaces, and a commit id names the same commit whichever namespace you ask from. So:

- **Commit ids reach across namespaces.** Anywhere a ref is accepted, a commit id or id prefix also works, and it resolves over every commit in the store. A caller who can name another namespace's commit can read that state.
- **The MCP server trusts its client.** Its tools take a per-call `namespace`, so an MCP client can work in any namespace.
- **Some operations cover the whole store:** GC (dry run, sweep, vacuum), the history report, sessions, taints and reminders.

## Confining a client to one namespace

Over HTTP, give the client an API key bound to the namespace: `namespace_id` when an admin creates it (`POST /api/admin/keys`). Requests with that key:

- read and write only that namespace;
- name refs by **branch only** — commit ids and prefixes get `403`, because they would reach other namespaces;
- can't use the store-wide endpoints (`/api/gc/*`, `/api/history`), which get `403`.

In the Rust library, the same limit is `Repository::fork_namespace(ns).with_branch_refs_only()`.

## Cross-namespace merge

`agentstategraph_cross_namespace_merge`, which merges a branch from another namespace into the current one, is **always refused** for now: the policy check that would allow it isn't built yet. Merges within one namespace are plain merges.

```json
// agentstategraph_cross_namespace_merge
{
  "source_namespace": "staging",
  "source_branch": "main",
  "target_branch": "main",
  "intent_description": "Promote staging to production"
}
```

Response:
```
Error: cross-namespace merge denied: no PolicyStore configured
```

## Tenants

A tenant is a separate store. On Postgres, tenants share a database and every row carries its tenant id, so each tenant's objects, commits and branches are its own. A server process serves one tenant (`--tenant`, default `default`), and a non-admin API key for another tenant is refused. On SQLite, a store is a file.

```bash
# Serve tenant "acme" from a shared Postgres database, over TLS
agentstategraph-mcp --http --storage postgres \
  --database-url "postgres://user:pass@host/asg?sslmode=verify-full" \
  --tenant acme
```

TLS needs a build with the `postgres-tls` feature; release binaries and the Docker image include it.

A tenant has many namespaces; a namespace belongs to one tenant. Sessions also carry a `scope_tenant`, which filters which policies apply; it doesn't choose where data lives.

## Common patterns

| Pattern | How |
|---|---|
| One namespace per environment | `dev`, `staging`, `production` |
| One namespace per team | `team-infra`, `team-ml`, `team-platform`; give each team's HTTP clients a key bound to its namespace |
| One store per customer | A tenant per customer on Postgres (`--tenant`), or a SQLite file each |
