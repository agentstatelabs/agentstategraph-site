---
title: Binding Capability Matrix
description: Which AgentStateGraph capabilities are available in each language binding.
---

Every binding wraps the same native Rust core, but they are brought current at
different rates. The core surface — repository CRUD, tasks, policy, taint, and
migration — is available everywhere. The **advanced repository ABI** (namespaces,
CAS writes, safe merge, exploration, and richer session/epoch operations) is fully
present in the Rust, C FFI, and Swift bindings and is rolling out to the rest.

This page reflects the cross-language capability manifest shipped with the core.

- **Reviewed core version:** 0.9.21
- **Advanced ABI contract:** v1

Legend: **✓** full · **◐** partial · **—** not yet available

| Capability | Rust | C FFI | Swift | Python | TypeScript | WASM | Go | .NET |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Repository (CRUD, branch, diff, merge) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tasks & plans | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Policy | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Taint / quarantine / watch | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Migration | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ |
| Speculation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Commit query | ✓ | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Sessions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Epochs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Namespaces | ✓ | ✓ | ✓ | — | — | — | — | — |
| CAS / expected-head writes | ✓ | ✓ | ✓ | — | — | — | — | — |
| Merge safety (base / preview / checked) | ✓ | ✓ | ✓ | — | — | — | — | — |
| Explorer (paths, tree, search, stats, graphs) | ✓ | ✓ | ✓ | — | — | — | — | — |
| Schema registration | ◐ | — | — | — | — | — | — | — |

## How to read this

- **Rust, C FFI, Swift** carry the complete advanced ABI today. If you need
  namespaces, CAS writes, safe merge, or the repository explorer from a binding,
  these are the ones that have them.
- **Python & TypeScript** have the full core plus speculation, commit query,
  sessions, and epochs — but not yet namespaces, CAS, safe merge, or the explorer.
- **WASM** matches Python/TypeScript minus commit query.
- **Go & .NET** currently cover the core surface (repository, tasks, policy, taint,
  migration); the advanced ABI is on the roadmap.

If a capability you need isn't available in your binding yet, you can always reach
it over the [MCP Server](/guides/mcp-server/) or the HTTP REST API, which expose the
full core surface regardless of language.

## See also

- [Introduction](/guides/introduction/) — the full feature list and crate map
- [Sessions](/guides/sessions/) · [Namespaces](/guides/namespaces/) · [Epochs](/guides/epochs/) — the advanced primitives above
