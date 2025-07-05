import { Provider } from "@supabase/supabase-js";
import { pgSchema } from "drizzle-orm/pg-core";
import { userProfiles } from "../schema/userProfiles";

const authSchema = pgSchema("auth");

// Deliberately a subset of the Supabase auth.users table, for simpler queries and testing
export const authUsers = authSchema.table("users", (t) => ({
  id: t.uuid().primaryKey(),
  email: t.text(),
  // snake_case to match what the Supabase client returns
  user_metadata: t.jsonb("raw_user_meta_data").$type<Record<string, any>>(),
  created_at: t.timestamp().defaultNow(),
  updated_at: t
    .timestamp()
    .defaultNow()
    .$onUpdate(() => new Date()),
}));

export const authIdentities = authSchema.table("identities", (t) => ({
  id: t.uuid().primaryKey(),
  user_id: t
    .uuid()
    .notNull()
    .references(() => authUsers.id),
  provider: t.text().notNull().$type<Provider>(),
  provider_id: t.text().notNull(),
}));

export type DbOrAuthUser = {
  id: string;
  email?: string | null;
  user_metadata: Record<string, any> | null;
};

// Enhanced type that includes userProfile data
export type UserWithProfile = DbOrAuthUser & {
  profile?: typeof userProfiles.$inferSelect | null;
};

// Type for user data with both auth and profile information
export type EnhancedUserData = {
  id: string;
  email?: string | null;
  displayName?: string | null;
  permissions?: string | null;
  access?: { role: string; keywords: string[] } | null;
};
