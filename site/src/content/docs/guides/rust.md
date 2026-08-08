---
title: Rust
description: Use AgentStateGraph natively from Rust — the core crate every other binding wraps.
---

Rust is the native home of AgentStateGraph. Every other binding (Python, TypeScript,
Go, Swift, .NET, WASM) wraps the same core crate you use here directly — no FFI, no
serialization boundary, no lost fidelity. All operations return `Result`, values move
in and out as `serde` types, and the full surface is available: repository CRUD,
branches, `diff`/`merge`, `log`/`blame`, speculation, query, `TaskStore`,
`PolicyStore`, taint/quarantine/watch, namespaces, epochs, sessions, CAS, search, and
migrate.

## Requirements

- Rust 1.75+ (2021 edition)
- No external toolchain — pure Rust, with optional storage-backend features

## Install

Add the core crate to your `Cargo.toml`:

```toml
[dependencies]
agentstategraph = "0.9"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

Storage backends are feature-gated. The in-memory and SQLite backends are on by
default; enable Postgres explicitly:

```toml
[dependencies]
agentstategraph = { version = "0.9", features = ["postgres"] }
```

## Create a store

```rust
use agentstategraph::Repository;

// In-memory (ephemeral)
let repo = Repository::in_memory()?;

// SQLite (durable)
let repo = Repository::open_sqlite("state.db")?;

// Postgres (multi-tenant) — requires the `postgres` feature
let repo = Repository::open_postgres("postgres://localhost/asg")?;
```

`Repository` is `Send + Sync`; wrap it in an `Arc` to share across tasks or threads.

## Basic CRUD

Every write carries an **intent category** and a human-readable description — that's
what makes the history explainable later. Writes are builder-style so provenance stays
optional but discoverable.

```rust
use agentstategraph::IntentCategory;
use serde::{Deserialize, Serialize};

// Raw JSON value
repo.set("/cluster/name", &"prod")
    .category(IntentCategory::Checkpoint)
    .description("Initialize cluster")
    .commit()?;

let name: String = repo.get("/cluster/name")?;   // "prod"

// Typed values via serde
#[derive(Serialize, Deserialize, PartialEq, Debug)]
struct Node { host: String, cores: u32 }

repo.set("/nodes/pico1", &Node { host: "pico1".into(), cores: 4 })
    .category(IntentCategory::Checkpoint)
    .description("Add node")
    .commit()?;

let node: Node = repo.get("/nodes/pico1")?;

// Full provenance
repo.set("/cluster/replicas", &3)
    .category(IntentCategory::Refine)
    .description("Scale to 3 replicas")
    .agent("agent/scaler")
    .reasoning("Traffic increased 40% over last hour")
    .confidence(0.85)
    .tags(["scaling", "auto"])
    .commit()?;

repo.delete("/nodes/pico1")
    .category(IntentCategory::Fix)
    .description("Decommission")
    .commit()?;
```

Prefer `get_opt` when a path may be absent — it returns `Option<T>` instead of an
error:

```rust
let maybe: Option<Node> = repo.get_opt("/nodes/pico2")?;
```

## Branches & merge

```rust
repo.branch("feature/new-network", "main")?;

repo.set("/cluster/network", &"flannel")
    .category(IntentCategory::Explore)
    .description("Try flannel")
    .reference("feature/new-network")
    .commit()?;

// Structured diff — the paths that differ and how
let changes = repo.diff("main", "feature/new-network")?;
for op in &changes {
    println!("{} {:?}", op.path, op.kind);
}

repo.merge("feature/new-network", "main")
    .description("Adopt flannel")
    .reasoning("Lower overhead than calico")
    .commit()?;

let branches = repo.list_branches()?;              // all
let filtered = repo.list_branches_prefix("feature/")?;
repo.delete_branch("feature/new-network")?;
```

Every read and write targets `main` unless you call `.reference(...)`.

## Log & blame

```rust
let history = repo.log("main").limit(50).run()?;   // recent commits
for entry in &history {
    println!("{}: {} (by {}, confidence {:.2})",
        entry.id, entry.intent.description, entry.agent, entry.confidence);
}

// Who last set a path, when, and why
let who = repo.blame("/cluster/replicas")?;
println!("{} — {}", who.agent, who.reasoning);
```

## Speculation

Lightweight, disposable branches for the "try many, pick one" pattern — O(1) to create
and to discard.

```rust
let spec_a = repo.speculate("main").label("approach-nfs").begin()?;
let spec_b = repo.speculate("main").label("approach-ceph").begin()?;

repo.set("/storage/type", &"nfs").speculation(&spec_a).commit()?;
repo.set("/storage/type", &"ceph").speculation(&spec_b).commit()?;
repo.set("/storage/replicas", &3).speculation(&spec_b).commit()?;

let picked: String = repo.get("/storage/type").speculation(&spec_a).run()?; // "nfs"

// Adopt the winner, drop the loser
repo.commit_speculation(&spec_a)
    .category(IntentCategory::Checkpoint)
    .description("Use NFS")
    .reasoning("Only 2 nodes, Ceph needs 3+")
    .confidence(0.9)
    .commit()?;

repo.discard_speculation(spec_b)?;
```

## Query

Composable filters over commit history — all filters are AND-combined.

```rust
let commits = repo.query()
    .agent("agent/scaler")
    .intent_category(IntentCategory::Refine)
    .tags(["scaling"])
    .reasoning_contains("traffic")
    .confidence_range(0.7, 1.0)
    .limit(5)
    .run()?;
```

## Tasks

`TaskStore` tracks plans and tasks with proof-gated completion and pull-based
scheduling (see the [Tasks & plans](/guides/tasks/) guide for the model). It
refcount-shares the underlying repository.

```rust
use agentstategraph::tasks::{TaskStore, Priority, Proof, ProofKind};

let tasks = TaskStore::new(&repo, "/tasks", "builder")?;
tasks.create_plan("launch", "Cut the release")?;

let t = tasks.add_task("launch", "Run the test matrix")
    .priority(Priority::High)
    .commit()?;

tasks.start_task("launch", &t.id)?;
tasks.complete_task("launch", &t.id,
    Proof::new(ProofKind::Commit, "abc123"))?;

let next = tasks.next_task("launch")?;   // highest-priority unblocked task
```

## Policies

`PolicyStore` adds authorization + cost-of-change gating with Cedar, Rego, and WASM
evaluators, plus Ed25519 signing (see the [Policy](/guides/policy/) guide).

```rust
use agentstategraph::policy::{PolicyStore, Decision};

let policies = PolicyStore::new(&repo, "/policies", "admin")?;
policies.propose(&policy).reference("main").commit()?;
policies.ratify("/policies/restrict-prod", "user", "reviewed")?;

match policies.evaluate_change(&proposal)? {
    Decision::Allow => { /* proceed */ }
    Decision::Deny(reason) => eprintln!("denied: {reason}"),
    Decision::RequireApproval(who) => { /* escalate to {who} */ }
}
```

## Taint, quarantine & watch

Protective markers are enforced at commit time (see
[Taint & Quarantine](/guides/taint-and-quarantine/)).

```rust
use agentstategraph::taint::TaintParams;

repo.taint("/cluster/prod", TaintParams::default())?;

let check = repo.check_taint("/cluster/prod/replicas")
    .agent("agent/deployer")
    .confidence(0.4)
    .run()?;

let taints = repo.list_taints("main")?;
```

`quarantine` (per-agent gate) and `watch` (observe-only) follow the same shape.

## Advanced repository

The full advanced surface is on the same handle:

```rust
// Namespaces — ref-layer isolation for multi-tenant deployments
repo.create_namespace("tenant-a")?;
let scoped = repo.scoped("tenant-a");

// Epochs — sealable, tamper-evident audit bundles
repo.create_epoch("2026-q3", "Q3 window")?;
repo.seal_epoch("2026-q3", "shipped")?;

// Sessions — durable, resumable work contexts
let session = repo.create_session("builder")?;
let mine = repo.sessions("builder")?;

// Compare-and-set — optimistic concurrency
repo.set_cas("/config/replicas", &5, expected_hash)?;
```

Also available: `head`, `merge_base` / `preview_merge`, `tree` / `list_paths`,
`search`, `stats`, `commit_graph`, and `intent_tree`.

## Migrate

```rust
let report = repo.migrate_check()?;         // is the store schema current?
repo.migrate_run("apply")?;                 // run pending migrations
```

## Intent categories

Every write takes an `IntentCategory` — the *why* behind the change, carried in
history and queryable via `blame` and `intent_tree`:

| Category | Use for |
|----------|---------|
| `Checkpoint` | Saving known-good state |
| `Explore` | Trying an approach |
| `Refine` | Improving existing state |
| `Fix` | Correcting errors |
| `Rollback` | Reverting to prior state |
| `Merge` | Combining branch work |
| `Migrate` | Schema/structural changes |

The full set includes the governance categories (`Taint`, `Quarantine`, `Watch`,
`PolicyPropose`, `PolicyRatify`, …) and `Custom(String)` for domain-specific intents.

## Error handling

Every fallible call returns `Result<T, agentstategraph::Error>`. The `Error` enum
distinguishes the cases you'll want to branch on — missing paths, merge conflicts,
taint/policy denials, and storage failures — so `?` composes cleanly and you can match
when you need to recover:

```rust
use agentstategraph::Error;

match repo.get::<Node>("/nodes/pico9") {
    Ok(node) => { /* … */ }
    Err(Error::NotFound(path)) => eprintln!("no value at {path}"),
    Err(e) => return Err(e.into()),
}
```

## Concurrency

`Repository` is `Send + Sync` and safe to share via `Arc<Repository>`. Commits are
atomic and serialized internally, so concurrent writers see a consistent, linearizable
history. For optimistic concurrency without locking, use `set_cas` and retry on a
hash mismatch.

## See also

- [Core Concepts](/guides/concepts/) — the graph, intents, branches, and merges
- [Tasks & plans](/guides/tasks/) · [Policy](/guides/policy/) · [Epochs](/guides/epochs/) — the governance & scheduling primitives the Rust API exposes
- [MCP Server](/guides/mcp-server/) — expose this same core to any agent over 73 tools
