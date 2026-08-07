---
title: Epochs
description: Bounded, sealable segments of work — freeze a slice of history into a tamper-evident, immutable record.
---

An **epoch** is a bounded, sealable segment of work for lifecycle management.
You open an epoch, do work inside it, then **seal** it — capturing a Merkle root
of its contents so the sealed segment is immutable and tamper-evident. Epochs are
how you turn a stretch of agent activity into an auditable, frozen record (a
release, a review window, a billing period) without stopping the live graph.

Available over MCP and the HTTP API.

## Lifecycle

```json
// agentstategraph_create_epoch
{ "id": "2026-q3-release", "description": "Q3 release window" }
```

```json
// agentstategraph_enter_epoch    → subsequent work is attributed to this epoch
{ "id": "2026-q3-release" }

// agentstategraph_exit_epoch     → stop attributing to it (still open/unsealed)
{ }
```

```json
// agentstategraph_seal_epoch     → make it immutable
{ "id": "2026-q3-release", "summary": "Shipped 0.9.21; 42 commits, 3 policy changes" }
```

Sealing records the seal time and a **Merkle root** of every object in the epoch,
computed from the then-current main chain. After sealing, the segment cannot be
modified — any later tampering is detectable by recomputing the root.

## Inspecting & archiving

```json
// agentstategraph_list_epochs    → all epochs with status (open / sealed)
{ }
```

- `agentstategraph_export_epoch` — export a (typically sealed) epoch as a portable
  record for audit or handoff.
- `agentstategraph_archive_epoch` — move a sealed epoch out of the active set once
  it's no longer day-to-day relevant.

## When to use epochs vs. branches

- **Branches** isolate *concurrent* lines of work you intend to merge back.
- **Epochs** freeze a *completed* slice of history into an immutable, verifiable
  record. Reach for an epoch when you need a defensible "this is exactly what
  happened during window X" — releases, audits, compliance windows.

## See also

- [Namespaces](/guides/namespaces/) — the per-tenant isolation unit epochs live within
- [Policy](/guides/policy/) — governance rules evaluated as work enters the graph
