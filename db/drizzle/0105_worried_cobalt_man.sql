ALTER TABLE "user_profiles" ADD COLUMN "last_mailbox_slug" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "inviter_user_id" uuid;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_inviter_user_id_users_id_fk" FOREIGN KEY ("inviter_user_id") REFERENCES "auth"."users"("id") ON DELETE no action ON UPDATE no action;