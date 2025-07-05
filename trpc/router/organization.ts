import { type TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { authUsers } from "@/db/supabaseSchema/auth";
import { userProfiles } from "@/db/schema/userProfiles";
import { addUser } from "@/lib/data/user";
import { protectedProcedure } from "../trpc";

export const organizationRouter = {
  getMembers: protectedProcedure.query(async () => {
    const users = await db
      .select({
        id: authUsers.id,
        email: authUsers.email,
        displayName: userProfiles.displayName,
      })
      .from(authUsers)
      .leftJoin(userProfiles, eq(authUsers.id, userProfiles.id));

    return users.map((user) => ({
      id: user.id,
      displayName: user.displayName || user.email || user.id,
      email: user.email,
    }));
  }),
  addMember: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        displayName: z.string(),
        permissions: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await addUser(ctx.user.id, input.email, input.displayName, input.permissions);
    }),
} satisfies TRPCRouterRecord;
