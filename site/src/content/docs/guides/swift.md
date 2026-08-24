---
title: Swift
description: Use AgentStateGraph from Swift on macOS and iOS via SwiftPM over the stable C ABI.
---

The Swift binding is an idiomatic Swift layer over the native Rust core, calling
through the stable C ABI (`agentstategraph-ffi`) and packaged as a Swift Package
for **macOS 11+** and **iOS 14+**. All calls are `throws`, and results decode
into `Codable` Swift types. Available from **v0.9.17**.

It exposes the full cross-language surface plus the advanced native repository
contract used by branch-aware apps: repository CRUD, branches, `diff`/`merge`,
`log`/`blame`, `TaskStore`, `PolicyStore`, taint/quarantine/watch, migrate, and
the advanced layer (namespaces, speculation, sessions, epochs, CAS, search).

## Requirements

- macOS 11+ or iOS 14+
- Swift 5.9+ / a recent Xcode

No Rust toolchain is needed to *consume* a released version — SwiftPM downloads a
checksum-pinned XCFramework automatically.

## Install (SwiftPM — recommended)

Add the package to your `Package.swift`, then add `"AgentStateGraph"` to your
target's dependencies:

```swift
.package(
    url: "https://github.com/agentstatelabs/AgentStateGraph.git",
    from: "1.0.0"
)
```

In Xcode, choose **File ▸ Add Package Dependencies** and enter the same
repository URL. SwiftPM resolves the checksum-pinned release XCFramework —
consumers do not build Rust or generate native artifacts.

> Building against a local checkout instead? The repo ships
> `scripts/build-swift-xcframework.sh`, which produces a fat framework with
> static slices for macOS (arm64 + x86_64), iOS device (arm64), and the iOS
> simulator (arm64 + x86_64) — the mode required for real iOS devices.

## Create a store

```swift
import AgentStateGraph

let asg = try AgentStateGraph()          // in-memory
// let asg = try AgentStateGraph(path: "/path/to/state.db")   // durable (SQLite)
defer { asg.close() }
```

## Basic CRUD

Every write carries an **intent category** and a human-readable description —
that's what makes the history explainable later.

```swift
// Raw JSON
_ = try asg.set("/name", json: "\"pico-cluster\"", category: .checkpoint, description: "init")
let name = try asg.get("/name")                       // "\"pico-cluster\""

// Typed values via Codable
struct Node: Codable, Equatable { let host: String; let cores: Int }
_ = try asg.set("/nodes/pico1", value: Node(host: "pico1", cores: 4),
                category: .checkpoint, description: "add node")
let node = try asg.get("/nodes/pico1", as: Node.self)

try asg.delete("/nodes/pico1", category: .correction, description: "decommission")
```

## Branches & merge

```swift
_ = try asg.branch("feature", from: "main")
_ = try asg.set("/config/replicas", json: "5", category: .refine,
                description: "scale up", ref: "feature")

let changes = try asg.diff("main", "feature")         // paths that differ
_ = try asg.merge(source: "feature", target: "main", description: "adopt scale-up")

let branches = try asg.listBranches()
_ = try asg.deleteBranch("feature")
```

## Log & blame

```swift
let history = try asg.log(limit: 50)                  // recent commits
let who = try asg.blame("/config/replicas")           // who last set it, when, and why
```

## Tasks

`TaskStore` tracks plans and tasks with proof-gated completion and pull-based
scheduling (see the [Tasks & plans](/guides/tasks/) guide for the model).

```swift
let tasks = try TaskStore(asg, prefix: "/tasks", agentId: "builder")
try tasks.createPlan("launch", description: "Cut the release")

let t = try tasks.addTask(plan: "launch", title: "Run the test matrix", priority: .high)
_ = try tasks.startTask(plan: "launch", id: t.id)
_ = try tasks.completeTask(plan: "launch", id: t.id,
                           proof: Proof(kind: .commit, value: "abc123"))

let next = try tasks.nextTask(plan: "launch")         // highest-priority unblocked task
```

## Policies

`PolicyStore` adds authorization + cost-of-change gating (see the
[Policy](/guides/policy/) guide).

```swift
let policies = try PolicyStore(asg, prefix: "/policies", agentId: "admin")
try policies.propose(policy, ref: "main")
_ = try policies.ratify(path: "/policies/restrict-prod", ratifier: "user",
                        reasoning: "reviewed")

let decision = try policies.evaluateChange(proposal)  // Allow / Deny / RequireApproval
```

## Taint, quarantine & watch

Protective markers live as an extension on the repository:

```swift
_ = try asg.taint("/cluster/prod", params: TaintParams(/* … */))
let check = try asg.checkTaint("/cluster/prod/replicas", agentId: "agent/deployer",
                               confidence: 0.4)
let taints = try asg.listTaints(ref: "main")
```

`quarantine` (per-agent gate) and `watch` (observe-only) follow the same shape;
see [Taint & Quarantine](/guides/taint-and-quarantine/).

## Advanced repository

The advanced layer is available on the same handle:

```swift
// Namespaces — per-tenant isolation
let db = try asg.createNamespace("tenant-a")
let scoped = asg.scoped(to: "tenant-a")

// Speculation — try changes without committing, then compare/commit/discard
let h = try asg.speculate(from: "main", label: "what-if")
try asg.setSpeculation(h, path: "/x", json: "2", category: .refine, description: "try")
_ = try asg.commitSpeculation(h, description: "adopt")

// Epochs — freeze a slice of history (see the Epochs guide)
let e = try asg.createEpoch(id: "2026-q3", description: "Q3 window")
_ = try asg.sealEpoch(id: "2026-q3", summary: "shipped")

// Sessions — durable, resumable work contexts
let s = try asg.createSession(/* … */)
let mine = try asg.sessions(agentId: "builder")
```

Also available: `head`, `queryCommits`, `setCAS` (compare-and-set),
`mergeBase` / `previewMerge`, `tree` / `listPaths`, `search`, `stats`,
`commitGraph`, and `intentTree`.

## Migrate

```swift
let report = try asg.migrateCheck()                   // is the store schema current?
_ = try asg.migrateRun(mode: "apply")                 // run pending migrations
```

## Intent categories

Every write takes an `IntentCategory` — the *why* behind the change, carried in
history and queryable via `blame` and `intentTree`:

```swift
.checkpoint   // a known-good state
.refine       // an incremental improvement
.correction   // fixing a prior mistake
.exploration  // a speculative or trial change
```

## Memory & threading

- `AgentStateGraph`, `TaskStore`, and `PolicyStore` own native handles. Call
  `close()` when done, or rely on `deinit`. Using a handle after `close()`
  throws `.closed`.
- `TaskStore` / `PolicyStore` refcount-share the repository; closing one does
  **not** close the `AgentStateGraph`.

## Signing note

Ed25519 policy signing and verification are available through the Rust API and
the MCP server. Registering a signer through the C ABI is not yet wired up, so
`sign` / `verify` return the FFI's raw JSON envelope; policies can still be
proposed, ratified, evaluated, and audited.

## See also

- [Core Concepts](/guides/concepts/) — the graph, intents, branches, and merges
- [Tasks & plans](/guides/tasks/) · [Policy](/guides/policy/) · [Epochs](/guides/epochs/) — the governance & scheduling primitives the Swift API exposes
