import { orm } from "../db/drizzle.ts";
import { users } from "../db/schema.ts";

const rows = await orm.select().from(users).all();
console.log('Users:', JSON.stringify(rows, null, 2));
