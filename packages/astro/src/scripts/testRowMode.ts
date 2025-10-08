// packages/astro/src/scripts/testRowMode.ts
import { createMergeableStore } from "tinybase/mergeable-store";

async function testFragmentedMode() {
  console.log("🧪 Testing TinyBase Fragmented Mode Persistence...");

  const store = createMergeableStore();

  // Add mock data
  store.setRow("users", "u1", { name: "Thabiso", role: "Engineer" });
  store.setRow("users", "u2", { name: "Ada", role: "Designer" });

  console.log("➡️ Sending fragmented updates to Durable Object...");

  // Push rows to Durable Object via API
  for (const [rowId, row] of Object.entries(store.getTable("users"))) {
    await fetch("http://localhost:45699/__api__/save-row", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableId: "users",
        rowId,
        rowData: row,
      }),
    });
  }

  console.log("🔍 Fetching fragmented tables...");
  const res = await fetch("http://localhost:45699/tables-list");
  const tables = await res.json();

  console.log("✅ Fragmented tables persisted:", tables);
}

testFragmentedMode().catch((err) => console.error("❌ Error:", err));
