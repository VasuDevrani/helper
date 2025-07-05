import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, conversationMessages as emails } from "@/db/schema";
import { authUsers } from "@/db/supabaseSchema/auth";
import { userProfiles } from "@/db/schema/userProfiles";
import { getFullName } from "@/lib/auth/authUtils";
import { Mailbox } from "@/lib/data/mailbox";
import { UserRole, UserRoles } from "@/lib/data/user";

type DateRange = {
  startDate?: Date;
  endDate?: Date;
};

export type MemberStats = {
  id: string;
  email: string | undefined;
  displayName: string | null;
  replyCount: number;
  role: UserRole;
}[];

export async function getMemberStats(mailbox: Mailbox, dateRange?: DateRange): Promise<MemberStats> {
  const allUsers = await db
    .select({
      id: authUsers.id,
      email: authUsers.email,
      displayName: userProfiles.displayName,
      access: userProfiles.access,
    })
    .from(authUsers)
    .leftJoin(userProfiles, eq(authUsers.id, userProfiles.id));

  const memberIds = allUsers.map((user) => user.id);

  const dateConditions = [];
  if (dateRange?.startDate) {
    dateConditions.push(sql`${emails.createdAt} >= ${dateRange.startDate.toISOString()}`);
  }
  if (dateRange?.endDate) {
    dateConditions.push(sql`${emails.createdAt} <= ${dateRange.endDate.toISOString()}`);
  }

  const result = await db
    .select({
      id: emails.userId,
      replyCount: count(emails.id),
    })
    .from(emails)
    .innerJoin(conversations, eq(emails.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.mailboxId, mailbox.id),
        eq(emails.role, "staff"),
        sql`${emails.userId} IN ${memberIds}`,
        ...dateConditions,
      ),
    )
    .groupBy(emails.userId);

  const replyCounts = result.reduce<Record<string, number>>((acc, member) => {
    if (member.id) acc[member.id] = member.replyCount;
    return acc;
  }, {});

  return allUsers
    .map((user) => {
      const role = user.access?.role || UserRoles.AFK;

      return {
        id: user.id,
        email: user.email ?? undefined,
        displayName: user.displayName || 
                     user.email || 
                     user.id,
        replyCount: replyCounts[user.id] || 0,
        role: role,
      };
    })
    .sort((a, b) => b.replyCount - a.replyCount);
}
