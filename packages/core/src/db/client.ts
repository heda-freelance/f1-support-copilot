import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDbClient(connectionString: string) {
  const client = postgres(connectionString, { max: 5 });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDbClient>;

export function closeDb(db: Db): Promise<void> {
  return db.$client.end();
}
