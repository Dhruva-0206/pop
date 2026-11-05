/**
 * Applies supabase/migrations/0001_init.sql to the schema for the current NETWORK_MODE
 * (testnet -> "public", fork -> "pop_fork"). Idempotent and non-destructive. Usage: npm run db:migrate
 */
import { mode } from "./chain";
import { migrate } from "./db";

const schema = await migrate(mode);
console.log(`migration 0001_init.sql applied to schema "${schema}" (NETWORK_MODE=${mode})`);
