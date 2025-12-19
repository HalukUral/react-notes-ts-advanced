import { drizzle } from "drizzle-orm/sql-js";
import { sqlDb } from "./connection.ts";
import * as schema from "./schema.ts";

export const orm = drizzle(sqlDb, { schema });
