import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getBaseUrl } from "@/components/constants";
import { db } from "@/db/client";
import { mailboxes } from "@/db/schema";
import { userProfiles } from "@/db/schema/userProfiles";
import { getMailboxBySlug } from "@/lib/data/mailbox";
import { listRepositories } from "@/lib/github/client";
import { captureExceptionAndThrowIfDevelopment } from "@/lib/shared/sentry";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const installationId = request.nextUrl.searchParams.get("installation_id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${getBaseUrl()}/login`);

  // Get user profile with lastMailboxSlug
  const [userProfile] = await db
    .select({ lastMailboxSlug: userProfiles.lastMailboxSlug })
    .from(userProfiles)
    .where(eq(userProfiles.id, user.id));

  const lastMailboxSlug = userProfile?.lastMailboxSlug;
  if (!lastMailboxSlug) return NextResponse.redirect(`${getBaseUrl()}/mailboxes`);

  const mailbox = await getMailboxBySlug(lastMailboxSlug);
  if (!mailbox) return NextResponse.redirect(`${getBaseUrl()}/mailboxes`);

  const redirectUrl = new URL(`${getBaseUrl()}/mailboxes/${mailbox.slug}/settings`);

  if (!installationId) return NextResponse.redirect(`${redirectUrl}/integrations?githubConnectResult=error`);

  try {
    if ((await listRepositories(installationId)).length === 0) {
      return NextResponse.redirect(`${redirectUrl}/integrations?githubConnectResult=error`);
    }

    await db.update(mailboxes).set({ githubInstallationId: installationId }).where(eq(mailboxes.id, mailbox.id));

    return NextResponse.redirect(`${redirectUrl}/integrations?githubConnectResult=success`);
  } catch (error) {
    captureExceptionAndThrowIfDevelopment(error);
    return NextResponse.redirect(`${redirectUrl}/integrations?githubConnectResult=error`);
  }
}
