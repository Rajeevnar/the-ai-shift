import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type DbSnapshot = {
  collections: Record<string, unknown[]>;
  meta: Record<string, unknown>;
};

/** Returns the full dataset as a JSON string (parsed on the client). */
export const loadDbStateRaw = createServerFn({ method: "GET" }).handler(async () => {
  const { getSql, loadAll } = await import("./db.server");
  const snapshot = await loadAll(getSql());
  return JSON.stringify(snapshot);
});

export async function loadDbState(): Promise<DbSnapshot> {
  return JSON.parse(await loadDbStateRaw()) as DbSnapshot;
}

const saveSchema = z.object({
  payload: z.string(),
});

export const saveDbChangesRaw = createServerFn({ method: "POST" })
  .validator((d: { payload: string }) => saveSchema.parse(d))
  .handler(async ({ data }) => {
    const { getSql, upsertRows, upsertMeta, TABLES } = await import("./db.server");
    const parsed = z
      .object({
        upserts: z.record(z.string(), z.array(z.object({ id: z.string() }).passthrough())),
        meta: z.record(z.string(), z.any()).optional(),
      })
      .parse(JSON.parse(data.payload));
    const sql = getSql();
    let count = 0;
    for (const [key, rows] of Object.entries(parsed.upserts)) {
      if (!(key in TABLES) || rows.length === 0) continue;
      await upsertRows(sql, key as keyof typeof TABLES, rows);
      count += rows.length;
    }
    if (parsed.meta && Object.keys(parsed.meta).length) await upsertMeta(sql, parsed.meta);
    return { saved: count };
  });

export function saveDbChanges(changes: { upserts: Record<string, unknown[]>; meta?: Record<string, unknown> }) {
  return saveDbChangesRaw({ data: { payload: JSON.stringify(changes) } });
}
