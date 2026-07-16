// Demo data for the AgentStateGraph Explorer.
// Illustrative sample data shaped to the CURRENT agentstategraph-core model
// (crates/agentstategraph-core/src/commit.rs + intent.rs):
//   Commit { id, state_root, parents, timestamp, agent_id, authority, intent, reasoning, confidence, tool_calls }
//   Intent { id, category, description, tags, parent_intent, lifecycle }
//   IntentCategory native variants: Explore, Refine, Fix, Rollback, Checkpoint,
//     Merge, Migrate, Plan, Taint, Untaint, Quarantine, Unquarantine, Watch,
//     Unwatch, PolicyPropose, PolicyRatify, PolicySupersede, PolicySign, Custom(..)
//
// This is a static, in-browser viewer — there is no WASM module. All data below
// is hand-authored to simulate a real cluster-management scenario.

const DEMO = {
  stats: {
    commit_count: 47,
    branch_count: 5,
    path_count: 23,
    epoch_count: 2,
    agents: ["agent/monitor", "agent/planner", "agent/setup", "agent/network", "agent/compliance"],
    // Native IntentCategory variants exercised by this dataset.
    categories: ["Checkpoint", "Explore", "Refine", "Fix", "Merge", "Rollback"],
    latest_commit: {
      id: "f5b2..17",
      agent: "agent/compliance",
      intent: "Seal Q1 operations epoch",
      timestamp: "2026-04-10T14:33:00Z",
    },
  },

  paths: [
    "/cluster/name",
    "/cluster/region",
    "/cluster/nodes/0/hostname",
    "/cluster/nodes/0/status",
    "/cluster/nodes/0/gpu_memory_mb",
    "/cluster/nodes/0/role",
    "/cluster/nodes/1/hostname",
    "/cluster/nodes/1/status",
    "/cluster/nodes/1/gpu_memory_mb",
    "/cluster/nodes/1/role",
    "/cluster/nodes/2/hostname",
    "/cluster/nodes/2/status",
    "/cluster/nodes/2/gpu_memory_mb",
    "/cluster/nodes/2/role",
    "/cluster/network/topology",
    "/cluster/network/subnet",
    "/cluster/network/dns",
    "/cluster/storage/type",
    "/cluster/storage/capacity_gb",
    "/cluster/config/log_level",
    "/cluster/config/auto_failover",
    "/cluster/config/max_retries",
    "/cluster/version",
  ],

  state: {
    cluster: {
      name: "picoclaw-prod",
      region: "us-west-2",
      version: "0.5.0-beta.1",
      nodes: [
        { hostname: "picorpi0", status: "healthy", gpu_memory_mb: 8192, role: "leader" },
        { hostname: "picorpi1", status: "healthy", gpu_memory_mb: 8192, role: "worker" },
        { hostname: "picorpi2", status: "draining", gpu_memory_mb: 4096, role: "worker" },
      ],
      network: { topology: "mesh", subnet: "10.0.0.0/24", dns: "1.1.1.1" },
      storage: { type: "nfs", capacity_gb: 4000 },
      config: { log_level: "info", auto_failover: true, max_retries: 3 },
    },
  },

  // Each entry mirrors a Commit. `category` is the intent.category, `description`
  // is the intent.description, and `authority` is authority.principal — flattened
  // here for convenient rendering.
  commits: [
    { id: "f5b2..17", agent: "agent/compliance", category: "Checkpoint", description: "Seal Q1 operations epoch", tags: ["compliance", "epoch"], authority: "ops-policy/quarterly-seal", confidence: 0.99, timestamp: "2026-04-10T14:33:00Z", parents: ["d1e8..9a"], is_merge: false },
    { id: "d1e8..9a", agent: "agent/monitor", category: "Fix", description: "Reroute traffic from failed node-2", tags: ["incident", "failover"], authority: "ops-policy/auto-failover", confidence: 0.73, timestamp: "2026-04-10T02:14:07Z", parents: ["c3f1..ab"], is_merge: false, reasoning: "Node-2 health check failed 3x in 60s. Rerouting to node-0 and node-1. Not restarting — disk I/O errors suggest hardware." },
    { id: "c3f1..ab", agent: "agent/planner", category: "Merge", description: "Merge mesh topology into main", tags: ["topology", "merge"], authority: "human/ops-lead", confidence: 0.89, timestamp: "2026-04-09T16:45:00Z", parents: ["b2a0..cd", "e4d7..90"], is_merge: true, reasoning: "Mesh topology selected over star — better fault tolerance for 3-node cluster. Merging explore/mesh-topology into main." },
    { id: "b2a0..cd", agent: "agent/planner", category: "Explore", description: "Evaluate network topology options", tags: ["topology"], authority: "human/ops-lead", confidence: 0.72, timestamp: "2026-04-09T16:30:00Z", parents: ["a1b2..ef"], is_merge: false },
    { id: "a1b2..ef", agent: "agent/network", category: "Refine", description: "Set DNS to Cloudflare", tags: ["network", "dns"], authority: "human/ops-lead", confidence: 0.95, timestamp: "2026-04-09T15:00:00Z", parents: ["9f3a..12"], is_merge: false },
    { id: "9f3a..12", agent: "agent/setup", category: "Checkpoint", description: "Configure NFS storage at 4TB", tags: ["storage"], authority: "human/ops-lead", confidence: 0.98, timestamp: "2026-04-09T14:30:00Z", parents: ["8e2b..34"], is_merge: false },
    { id: "8e2b..34", agent: "agent/setup", category: "Checkpoint", description: "Add node-2 (picorpi2) as worker", tags: ["provisioning"], authority: "human/ops-lead", confidence: 0.97, timestamp: "2026-04-09T14:15:00Z", parents: ["7d1c..56"], is_merge: false },
    { id: "7d1c..56", agent: "agent/setup", category: "Checkpoint", description: "Add node-1 (picorpi1) as worker", tags: ["provisioning"], authority: "human/ops-lead", confidence: 0.97, timestamp: "2026-04-09T14:10:00Z", parents: ["6c0d..78"], is_merge: false },
    { id: "6c0d..78", agent: "agent/setup", category: "Checkpoint", description: "Initialize cluster with node-0 as leader", tags: ["provisioning", "bootstrap"], authority: "human/ops-lead", confidence: 0.99, timestamp: "2026-04-09T14:00:00Z", parents: [], is_merge: false },
  ],

  branches: [
    { name: "main", commit: "f5b2..17" },
    { name: "explore/star-topology", commit: "b2a0..cd" },
    { name: "explore/mesh-topology", commit: "e4d7..90" },
    { name: "agents/monitor/workspace", commit: "d1e8..9a" },
    { name: "archive/q1-setup", commit: "9f3a..12" },
  ],

  epochs: [
    { id: "2026-Q1-setup", description: "Initial cluster setup and configuration", status: "Sealed", commits: 8, agents: ["agent/setup", "agent/network"], sealed_at: "2026-04-09T17:00:00Z", seal_hash: "a7f3c2e8..b91d" },
    { id: "2026-Q1-ops", description: "Q1 operational incidents and maintenance", status: "Active", commits: 39, agents: ["agent/monitor", "agent/planner", "agent/compliance"], sealed_at: null, seal_hash: null },
  ],

  // Blame for a path resolves to the commit whose intent last wrote it.
  // Fields map to Commit { agent_id, confidence, reasoning, timestamp, tool_calls }
  // and the nested Intent { category, description, tags, lifecycle.status } plus
  // Authority { principal }.
  blame: {
    "/cluster/nodes/2/status": {
      path: "/cluster/nodes/2/status",
      commit_id: "d1e8..9a",
      agent_id: "agent/monitor",
      intent_category: "Fix",
      intent_description: "Reroute traffic from failed node-2",
      intent_tags: ["incident", "failover"],
      intent_status: "Completed",
      reasoning: "Node-2 health check failed 3x in 60s. Rerouting to node-0 and node-1. Not restarting — disk I/O errors suggest hardware.",
      confidence: 0.73,
      timestamp: "2026-04-10T02:14:07Z",
      authority: "ops-policy/auto-failover",
      tool_calls: ["cluster_health_probe", "stategraph_set"],
    },
  },

  search_results: [
    { path: "/cluster/name", value: "picoclaw-prod" },
    { path: "/cluster/nodes/0/hostname", value: "picorpi0" },
    { path: "/cluster/nodes/1/hostname", value: "picorpi1" },
    { path: "/cluster/nodes/2/hostname", value: "picorpi2" },
    { path: "/cluster/network/topology", value: "mesh" },
  ],
};
