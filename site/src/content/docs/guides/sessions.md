---
title: Sessions
description: Durable, resumable work contexts for agents — track where an agent is, scope what it can touch, and organize multi-agent work into a tree.
---

A **session** is a durable, resumable context for a unit of agent work. It records
which ref an agent is working on (its **head**), can be **scoped** to a subtree of
paths, and can nest into a **tree** of sub-sessions for multi-agent orchestration.
Sessions live in storage, so they survive process restarts — an agent can pick up
exactly where it left off.

Where an [epoch](/guides/epochs/) freezes a *finished* slice of history, a session
tracks *live, in-progress* work and who is doing it.

## Why sessions

- **Resumability** — a long-running or interrupted agent reattaches to its session
  and continues from its last head instead of restarting.
- **Scoping** — a session can be pinned to a path subtree; writes outside that scope
  are rejected, so a sub-agent can't wander into state it shouldn't touch.
- **Orchestration** — an orchestrator opens a session, spawns child sessions for its
  sub-agents, and the parent/child links form an intent tree you can audit later.

## Lifecycle

```rust
// Create a session — optionally scoped to a subtree
let session = repo.create_session("builder")?;

// Point the active session at it, then work normally
repo.set_active_session(&session.id)?;

// Advance the head as the agent commits
repo.update_session_head(&session.id, "main")?;

// End it when the work is done
repo.end_session(&session.id)?;
```

The equivalents are available over MCP and the advanced repository ABI:
`session.create`, `session.get`, `session.list`, `session.children`,
`session.update_head`, `session.end`, and `session.active.get` /
`session.active.set`.

## Sub-sessions & the session tree

```rust
// An orchestrator opens a session, then spawns children for each sub-agent
let orchestrator = repo.create_session("orchestrator")?;
let worker_a = repo.create_child_session(&orchestrator.id, "worker-a")?;
let worker_b = repo.create_child_session(&orchestrator.id, "worker-b")?;

// Enumerate the tree
let children = repo.session_children(&orchestrator.id)?;   // [worker-a, worker-b]
let mine = repo.sessions("orchestrator")?;                 // all sessions for an agent
```

Each child carries a link back to its parent, so the delegation chain is queryable
alongside the intent and authority already recorded on every commit.

## Sessions vs. branches vs. epochs

- **Branches** isolate *concurrent lines of work* you intend to compare and merge.
- **Sessions** track *who is working where, right now* — durable cursors with scope
  and a parent/child tree, spanning however many commits and branches the work takes.
- **Epochs** freeze a *completed slice* of history into an immutable, verifiable record.

An agent typically works **in** a session, **on** a branch, and its output may later
be sealed **into** an epoch.

## Availability

Sessions are `full` in the Rust, C FFI, Swift, Python, TypeScript, and WASM
bindings. They are not yet available in the Go or .NET bindings — see the
[binding capability matrix](/reference/capabilities/).

## See also

- [Namespaces](/guides/namespaces/) — the per-tenant isolation unit sessions live within
- [Epochs](/guides/epochs/) — seal a finished session's output into an audit bundle
- [Core Concepts](/guides/concepts/) — intents, branches, authority, and delegation
