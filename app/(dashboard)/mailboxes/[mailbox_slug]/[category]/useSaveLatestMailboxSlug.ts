import { useEffect, useRef } from "react";
import { api } from "@/trpc/react";

export const useSaveLatestMailboxSlug = (mailboxSlug: string | undefined) => {
  const lastMailboxSlug = useRef<string | null>(null);
  const updateSlug = api.user.updateLastMailboxSlug.useMutation();

  useEffect(() => {
    if (mailboxSlug && lastMailboxSlug.current !== mailboxSlug) {
      lastMailboxSlug.current = mailboxSlug;
      updateSlug.mutate({ slug: mailboxSlug });
    }
  }, [mailboxSlug, updateSlug]);
};
