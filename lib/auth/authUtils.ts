import { DbOrAuthUser, EnhancedUserData } from "@/db/supabaseSchema/auth";
import { userProfiles } from "@/db/schema/userProfiles";

type UserProfile = typeof userProfiles.$inferSelect;

export const hasDisplayName = (
  user: DbOrAuthUser | null | undefined,
  profile?: UserProfile | null,
): boolean => {
  // Check userProfile for display name
  if (profile?.displayName && profile.displayName.trim()) return true;
  return false;
};

export const getFullName = (user: DbOrAuthUser, profile?: UserProfile | null) => {
  // Prioritize userProfile displayName
  if (profile?.displayName && profile.displayName.trim()) {
    return profile.displayName.trim();
  }
  return user.email ?? user.id;
};

export const getFirstName = (user: DbOrAuthUser, profile?: UserProfile | null) => {
  return getFullName(user, profile).split(" ")[0];
};

// Enhanced utility for working with combined user data
export const getDisplayNameFromEnhanced = (user: EnhancedUserData): string => {
  return user.displayName?.trim() || user.email || user.id;
};

// Helper to check if user has admin permissions
export const isAdminUser = (user: EnhancedUserData): boolean => {
  return user.permissions === "admin";
};
