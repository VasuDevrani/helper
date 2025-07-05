import { userFactory } from "@tests/support/factories/users";
import { createTestTRPCContext } from "@tests/support/trpcUtils";
import { describe, expect, inject, it, vi } from "vitest";
import { createCaller } from "@/trpc";

vi.mock("@/lib/env", () => ({
  env: {
    POSTGRES_URL: inject("TEST_DATABASE_URL"),
  },
}));

describe("organizationRouter", () => {
  describe("getMembers", () => {
    it("returns all users", async () => {
      const { user } = await userFactory.createRootUserWithProfile({
        profileOverrides: {
          displayName: "Test User",
        },
      });
      const caller = createCaller(createTestTRPCContext(user));

      const result = await caller.organization.getMembers();

      expect(result).toEqual([
        {
          id: user.id,
          displayName: "Test User",
          email: user.email,
        },
      ]);
    });
  });
});
