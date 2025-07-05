import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db/client";
import { userProfiles } from "@/db/schema/userProfiles";
import { authUsers, EnhancedUserData } from "@/db/supabaseSchema/auth";
import { getFullName } from "@/lib/auth/authUtils";
import { createAdminClient } from "@/lib/supabase/server";
import { getSlackUser } from "../slack/client";

export const UserRoles = {
  CORE: "core",
  NON_CORE: "nonCore",
  AFK: "afk",
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

type MailboxAccess = {
  role: UserRole;
  keywords: string[];
  updatedAt: string;
};

export type UserWithMailboxAccessData = {
  id: string;
  displayName: string;
  email: string | undefined;
  role: UserRole;
  keywords: MailboxAccess["keywords"];
  permissions: string;
};

export const getProfile = cache(
  async (userId: string) => await db.query.userProfiles.findFirst({ where: eq(userProfiles.id, userId) }),
);

export const isAdmin = (profile?: typeof userProfiles.$inferSelect) => profile?.permissions === "admin";

// Enhanced user fetching utility
export const getEnhancedUser = cache(async (userId: string): Promise<EnhancedUserData | null> => {
  const [user] = await db
    .select({
      id: authUsers.id,
      email: authUsers.email,
      displayName: userProfiles.displayName,
      permissions: userProfiles.permissions,
      access: userProfiles.access,
    })
    .from(authUsers)
    .leftJoin(userProfiles, eq(authUsers.id, userProfiles.id))
    .where(eq(authUsers.id, userId));

  return user || null;
});

export const addUser = async (
  inviterUserId: string,
  emailAddress: string,
  displayName: string,
  permission?: string,
) => {
  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: emailAddress,
    user_metadata: {},
  });
  if (error) throw error;
  if (!data.user) throw new Error("Failed to create user");

  // Set permissions in userProfiles if specified and different from default
  if (permission && permission !== "member") {
    await db
      .update(userProfiles)
      .set({ permissions: permission })
      .where(eq(userProfiles.id, data.user.id));
  }

  // Set displayName and inviter in userProfiles 
  await db
    .update(userProfiles)
    .set({ 
      displayName: displayName,
      inviterUserId: inviterUserId 
    })
    .where(eq(userProfiles.id, data.user.id));
};

export const getUsersWithMailboxAccess = async (mailboxId: number): Promise<UserWithMailboxAccessData[]> => {
  const users = await db
    .select({
      id: authUsers.id,
      email: authUsers.email,
      displayName: userProfiles.displayName,
      permissions: userProfiles.permissions,
      access: userProfiles.access,
    })
    .from(authUsers)
    .leftJoin(userProfiles, eq(authUsers.id, userProfiles.id));

  return users.map((user) => {
    const access = user.access ?? { role: "afk", keywords: [] };
    const permissions = user.permissions ?? "member";

    return {
      id: user.id,
      displayName: user.displayName || "",
      email: user.email ?? undefined,
      role: access.role,
      keywords: access?.keywords ?? [],
      permissions,
    };
  });
};

export const updateUserMailboxData = async (
  userId: string,
  mailboxId: number, // Keep for backward compatibility but not used in new implementation
  // NOTE: The mailboxId parameter is kept for API compatibility but the new implementation
  // uses global access stored in userProfiles.access
  updates: {
    displayName?: string;
    role?: UserRole;
    keywords?: MailboxAccess["keywords"];
  },
): Promise<UserWithMailboxAccessData> => {
  // Get current user and profile data
  const [currentUser] = await db
    .select({
      id: authUsers.id,
      email: authUsers.email,
      displayName: userProfiles.displayName,
      permissions: userProfiles.permissions,
      access: userProfiles.access,
    })
    .from(authUsers)
    .leftJoin(userProfiles, eq(authUsers.id, userProfiles.id))
    .where(eq(authUsers.id, userId));

  if (!currentUser) throw new Error("User not found");

  // Get current access or default
  const currentAccess = currentUser.access ?? { role: "afk", keywords: [] };

  // Prepare update data
  const updateData: Partial<typeof userProfiles.$inferInsert> = {};

  if (updates.displayName !== undefined) {
    updateData.displayName = updates.displayName;
  }

  if (updates.role !== undefined || updates.keywords !== undefined) {
    updateData.access = {
      role: updates.role ?? currentAccess.role,
      keywords: updates.keywords ?? currentAccess.keywords,
    };
  }

  // Update userProfiles
  const [updatedProfile] = await db
    .update(userProfiles)
    .set(updateData)
    .where(eq(userProfiles.id, userId))
    .returning();

  if (!updatedProfile) throw new Error("Failed to update user profile");

  return {
    id: currentUser.id,
    displayName: updatedProfile.displayName || currentUser.displayName || "",
    email: currentUser.email ?? undefined,
    role: updatedProfile.access?.role || "afk",
    keywords: updatedProfile.access?.keywords || [],
    permissions: updatedProfile.permissions || currentUser.permissions || "member",
  };
};

export const findUserViaSlack = cache(async (token: string, slackUserId: string) => {
  const slackUser = await getSlackUser(token, slackUserId);
  return (await db.query.authUsers.findFirst({ where: eq(authUsers.email, slackUser?.profile?.email ?? "") })) ?? null;
});
