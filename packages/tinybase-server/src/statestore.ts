// packages/tinybase-server/src/statestore.ts
import type { MergeableStore } from "tinybase";
import { createMergeableStore } from "tinybase/mergeable-store";
import { createDurableObjectSqlStoragePersister } from "tinybase/persisters/persister-durable-object-sql-storage";
import { WsServerDurableObject } from "tinybase/synchronizers/synchronizer-ws-server-durable-object";
import { handleApiRequest } from "../api";

export class StateStore extends WsServerDurableObject {
  state: DurableObjectState;
  store: MergeableStore | null = null;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname.endsWith("values-list")) {
      const values = await this.ctx.storage.sql.exec(
        `SELECT * FROM tinybase_values`
      );
      console.log("🧠 Values:", values.toArray());
      return new Response(JSON.stringify(values.toArray()), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.endsWith("tables-list")) {
      const tables = await this.ctx.storage.sql.exec(
        `SELECT * FROM tinybase_tables`
      );
      console.log("📊 Tables:", tables.toArray());
      return new Response(JSON.stringify(tables.toArray()), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname.includes("__api__")) {
      return handleApiRequest(request, { store: this.store });
    }

    return super.fetch?.(request) || new Response("Not found", { status: 404 });
  }

  createPersister() {
    this.store = this.store ?? createMergeableStore();

    const persister = createDurableObjectSqlStoragePersister(
      this.store,
      this.ctx.storage.sql,
      {
        mode: "fragmented", // ✅ Store data in fragmented mode
        // tablesTableName: "tinybase_tables",
        // valuesTableName: "tinybase_values",
      }
    );

    persister.startAutoLoad().then(() => {
      console.log("📦 Fragmented data loaded from Durable Object storage");
      persister.startAutoSave();
      console.log("💾 Auto-save enabled (fragmented mode)");
    });

    return persister;
  }
}
