---
title: Swift
description: Use AgentStateGraph from Swift on macOS and iOS via SwiftPM over the stable C ABI.
---

The Swift binding is an idiomatic Swift layer over the native Rust core, calling
through the stable C ABI (`agentstategraph-ffi`) and packaged as a Swift Package
for **macOS 11+** and **iOS 14+**. All calls are `throws`, and results decode
into `Codable` Swift types. Available from **v0.9.17**.

It exposes the established cross-language surface plus the advanced native
repository contract used by branch-aware apps:

- **`AgentStateGraph`** — repository: `get` / `set` / `delete`, branches,
  `diff` / `merge`, `log`, `blame`, plus taint and migrate.
- **`TaskStore`** — plans and tasks with proof-gated completion, blockers,
  assignment, and `nextTask` scheduling.
- **`PolicyStore`** — propose / ratify / supersede, evaluate and change-cost
  evaluation, tenant-scoped variants, signing envelopes.
- **Taint / Quarantine / Watch** — protective markers on paths.
- **Migrate** — schema check / run.
- **Advanced repository** — namespaces, expected-head CAS, merge base and
  preview, state exploration/search, commit queries, atomic speculation,
  durable sessions, and epochs.

## Requirements

- macOS 11+ or iOS 14+
- Swift 5.9+ / a recent Xcode

No Rust toolchain is needed to *consume* a released version — SwiftPM downloads a
checksum-pinned XCFramework automatically.

## Install (SwiftPM — recommended)

Released versions are consumable directly from the repository root. Add the
package to your `Package.swift`:

```swift
.package(
    url: "https://github.com/agentstatelabs/agentstategraph.git",
    from: "0.9.21"
)
```

…and add `"AgentStateGraph"` to your target's dependencies. In Xcode, choose
**File ▸ Add Package Dependencies** and enter the same repository URL. SwiftPM
resolves the checksum-pinned release XCFramework — consumers do not build Rust or
generate native artifacts.

> Building against a local checkout instead? The repo ships
> `scripts/build-swift-xcframework.sh`, which produces a fat framework with
> static slices for macOS (arm64 + x86_64), iOS device (arm64), and the iOS
> simulator (arm64 + x86_64) — the mode required for real iOS devices.

## Quickstart

```swift
import AgentStateGraph

let asg = try AgentStateGraph()                    // in-memory; or AgentStateGraph(path:)
defer { asg.close() }

try asg.set("/name", json: "\"pico-cluster\"", category: .checkpoint, description: "init")
let name = try asg.get("/name")                    // "\"pico-cluster\""

// Typed values via Codable
struct Node: Codable { let host: String; let cores: Int }
try asg.set("/nodes/pico1", value: Node(host: "pico1", cores: 4),
            category: .checkpoint, description: "add node")
let node = try asg.get("/nodes/pico1", as: Node.self)

// Branches
_ = try asg.branch("feature", from: "main")
let branches = try asg.listBranches()

// Tasks — proof-gated completion
let tasks = try TaskStore(asg, prefix: "/tasks", agentId: "builder")
try tasks.createPlan("launch")
let t = try tasks.addTask(plan: "launch", title: "cut release", priority: .high)
_ = try tasks.startTask(plan: "launch", id: t.id)
_ = try tasks.completeTask(plan: "launch", id: t.id,
                           proof: Proof(kind: .commit, value: "abc123"))
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
- [Namespaces](/guides/namespaces/) and [Policy](/guides/policy/) — governance primitives the Swift `PolicyStore` and advanced repository expose
