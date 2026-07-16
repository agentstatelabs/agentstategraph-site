---
title: C# / .NET
description: Use AgentStateGraph from C# / .NET via P/Invoke over the stable C ABI.
---

The .NET binding is a thin, idiomatic C# layer over the native Rust core, calling through P/Invoke against the stable C ABI. It targets `net8.0` and `net10.0` and runs on Windows, macOS, and Linux (x64 + arm64). All handle types (`Repository`, `TaskStore`, `PolicyStore`) are `IDisposable` — always dispose them, ideally with `using`.

## Prerequisites

- .NET SDK 8.0+ (`net10.0` recommended)
- Rust toolchain (to build the native FFI library)

## Build from Source

The NuGet id `agentstatelabs.AgentStateGraph` is reserved, but auto-publish is still gated as manual-only. Until it ships, build from source: compile the native FFI crate, then build the .NET project.

```bash
# 1. Clone the repo
git clone https://github.com/agentstatelabs/AgentStateGraph.git
cd AgentStateGraph

# 2. Build the Rust FFI crate — produces the native cdylib the
#    P/Invoke layer loads (agentstategraph_ffi).
cargo build -p agentstategraph-ffi --release

# 3. Build the C# binding
dotnet build bindings/dotnet/AgentStateGraph -c Release
```

This produces the native library the binding loads at runtime:

| OS      | File name                       |
|---------|---------------------------------|
| Linux   | `libagentstategraph_ffi.so`     |
| macOS   | `libagentstategraph_ffi.dylib`  |
| Windows | `agentstategraph_ffi.dll`       |

### Locating the native library at runtime

The loader searches, in order:

1. **`AGENTSTATEGRAPH_FFI_PATH`** — if set, treated as a directory to look in. This is the explicit override, and the recommended way to point at a `cargo` build during development:

   ```bash
   AGENTSTATEGRAPH_FFI_PATH=$PWD/target/release dotnet run
   ```

2. **Alongside the managed assembly** — the NuGet `runtimes/<rid>/native/` convention (used once the package is published).
3. **Cargo target directory** — a development convenience: the loader walks up from the app base directory looking for `target/debug/` or `target/release/`, so you can `dotnet run` straight out of a clone.

If none of these finds the library, it falls back to the default .NET resolver (`LD_LIBRARY_PATH`, `DYLD_LIBRARY_PATH`, `PATH`, etc.).

> **Once published**, install will be a one-liner: `dotnet add package agentstatelabs.AgentStateGraph`. The package ships the native library under `runtimes/<rid>/native/`, so no extra configuration is needed.

## Quickstart

```csharp
using AgentStateGraph;

// SQLite-backed (durable) — or `new Repository()` for in-memory.
using var repo = Repository.OpenSqlite("state.db");

// Set a value — every write is an atomic commit with intent.
// Signature: Set(path, jsonValue, intentCategory, intentDescription).
CommitId commit = repo.Set("/cluster/name", "\"prod\"",
    "Checkpoint", "Initialize cluster");

// Read it back (returns the raw JSON string).
string name = repo.Get("/cluster/name");   // "prod"

// Serialize a C# value straight to JSON.
repo.SetJson("/cluster/replicas", 3, "Refine", "Scale to 3 replicas");

// Branch, write on the branch, then merge back.
repo.Branch("feature/new-network");
repo.Set("/cluster/network", "\"flannel\"", "Explore", "Try flannel",
    refName: "feature/new-network");

string diff = repo.Diff("main", "feature/new-network");   // JSON
CommitId merge = repo.Merge("feature/new-network", "main", "Adopt flannel");

// Blame — who last modified a path, and why (raw JSON).
string blame = repo.Blame("/cluster/replicas");

// History, newest-first.
foreach (Commit c in repo.Log(limit: 5))
{
    Console.WriteLine($"{c.Id}: {c.IntentDescription} (by {c.Agent})");
}
```

Every read/write method takes an optional trailing `refName` argument (defaulting to `Repository.DefaultRef`, i.e. `"main"`).

## Repository

| Method | Description |
|--------|-------------|
| `new Repository()` | Create an in-memory (ephemeral) store |
| `Repository.OpenSqlite(path)` | Open (or create) a SQLite-backed store |
| `Get(path, refName?)` | Read the JSON value at a path (string) |
| `Set(path, jsonValue, intentCategory, intentDescription, refName?)` | Write with intent; returns a `CommitId` |
| `SetJson<T>(path, value, intentCategory, intentDescription, refName?)` | Serialize a C# value, then `Set` |
| `Delete(path, intentCategory, intentDescription, refName?)` | Delete with intent |
| `Branch(name, from?)` | Create a branch |
| `ListBranches(prefix?)` | List branches (optionally prefix-filtered) — `IReadOnlyList<BranchEntry>` |
| `DeleteBranch(name)` | Remove a branch; returns `true` if it existed |
| `Diff(refA, refB)` | Structured diff (raw JSON) |
| `Merge(source, target, description)` | Merge branches; returns the merge `CommitId` |
| `Log(limit?, refName?)` | Commit history, newest-first — `IReadOnlyList<Commit>` |
| `Blame(path, refName?)` | Who last modified a path and why (raw JSON) |

## TaskStore

Plans and tasks, bound to a repo, path prefix, and agent id. All writes commit as `Plan` intents.

```csharp
using var repo = new Repository();
using var tasks = new TaskStore(repo, "/plans", "agent/planner");

Plan plan = tasks.CreatePlan("main", "migration", "Move to flannel");

Task t = tasks.AddTask("main", "migration", "Drain node3", Priority.High);
tasks.StartTask("main", "migration", t.Id);

// Complete with a typed proof (Commit / File / Test / Text).
tasks.CompleteTask("main", "migration", t.Id,
    Proof.Test("integration_suite", "all green"));

// Pull the next unblocked task for an agent.
Task? next = tasks.NextTaskFor("main", "migration",
    agent: "agent/worker", includeUnassigned: true);
```

Also available: `ListPlans`, `ListPlansByStatus`, `GetPlan`, `ArchivePlan`, `DeletePlan`; `ListTasks`, `TaskIds`, `GetTask`, `AbandonTask`, `SetPriority`, `SetBlockers`, `AssignTask`, `UnassignTask`, `NextTask`, `DerivedStatus`; and `AddTaskWithExtensions` for threading a JSON `payload`, `parentChange`, and an `OnCompleteHook` through a task.

## PolicyStore

Propose / ratify / supersede authorization policies, then evaluate them. All policy writes commit as `Plan` intents.

```csharp
using var repo = new Repository();
using var policies = new PolicyStore(repo, "/policies", "agent/governance");

var policy = new Policy(
    Path: "infra/restart",
    Version: 1,
    Situation: "pod is failing in prod",
    SituationSelector: new Selector.Eq("namespace", "prod"),
    ProposedBy: "agent/governance",
    ProposedAt: DateTimeOffset.UtcNow,
    ActiveFrom: DateTimeOffset.UtcNow,
    Allow: new[] { new AuthorizedAction("restart_pod") });

string handle = policies.Propose("main", policy);          // "infra/restart@1"
policies.Ratify("main", "infra/restart", "ops-lead", "approved after review");

// Evaluate an action against a situation fact-map.
Decision d = policies.Evaluate("main",
    new Dictionary<string, string> { ["namespace"] = "prod" },
    action: "restart_pod",
    agentId: "agent/ops");

// Decision is a tagged union — pattern-match on the variant.
if (d is Decision.Allow allow)
    Console.WriteLine($"allowed by {allow.MatchedPolicy}");
else if (d is Decision.Deny deny)
    Console.WriteLine($"denied: {deny.Reason}");
```

The `Decision` variants are `Allow`, `Deny`, `RequireApproval`, and `NoPolicyMatch`. `SituationSelector` is a composable `Selector` tree (`Eq`, `Ne`, `Matches`, `Exists`, `Gt`/`Gte`/`Lt`/`Lte`, `All`/`Any`/`Not`, `Always`/`Never`).

Also available: `Supersede`, `List`, `Active`, `Get`, `History`, `EvaluateChange` (change-proposal evaluation), and `CheckTokens` (active policies whose triggers intersect a token set).

## Taint / Quarantine / Watch

Attach pre-commit guards to paths, then check them before writing.

```csharp
using var repo = new Repository();

// Block writes under a path until the taint is cleared.
string id = repo.Taint("/cluster",
    new TaintParams(
        Name: "incident-42",
        Effect: TaintEffect.Block,
        Reason: "under investigation",
        AgentId: "agent/security"));

TaintCheck check = repo.CheckTaint("/cluster/inner",
    agentId: "agent/worker", confidence: 1.0);
if (!check.CanWrite)
    Console.WriteLine("write blocked by an active taint");

// Clear it.
repo.Untaint("/cluster", "incident-42",
    new UntaintParams(Reason: "resolved", AgentId: "agent/security"));
```

`TaintEffect` controls pre-commit behavior: `Warn`, `Block`, `Review` (requires confidence ≥ 0.9), `Isolate`, or `Advisory`. Alongside taints there are **quarantines** (`Quarantine` / `Unquarantine`, gated to a set of authorized agents) and **watches** (`Watch` / `Unwatch`, threshold-based advisories). `ListTaints(pathPrefix?, kind?, includeResolved?)` enumerates all three.
