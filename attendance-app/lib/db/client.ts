import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "@/lib/env";

import * as schema from "./schema";

const queryClient = postgres(getEnv().DATABASE_URL, { prepare: false, max: 2, idle_timeout: 10, connect_timeout: 10 });

export const db = drizzle(queryClient, { schema });
