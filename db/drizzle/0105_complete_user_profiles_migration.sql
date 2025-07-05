-- Add missing fields to user_profiles table
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "last_mailbox_slug" text;
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "inviter_user_id" uuid;

-- Add foreign key constraint for inviter_user_id (if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_profiles_inviter_user_id_users_id_fk'
    ) THEN
        ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_inviter_user_id_users_id_fk" 
        FOREIGN KEY ("inviter_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;
    END IF;
END
$$;

-- Migrate existing data from user_metadata
UPDATE user_profiles 
SET 
    last_mailbox_slug = auth_users.raw_user_meta_data ->> 'lastMailboxSlug',
    inviter_user_id = (auth_users.raw_user_meta_data ->> 'inviter_user_id')::uuid,
    updated_at = now()
FROM auth.users auth_users
WHERE user_profiles.id = auth_users.id
  AND (
    (auth_users.raw_user_meta_data ? 'lastMailboxSlug' AND user_profiles.last_mailbox_slug IS NULL)
    OR (auth_users.raw_user_meta_data ? 'inviter_user_id' AND user_profiles.inviter_user_id IS NULL)
  );

-- Fix mailboxAccess migration to properly handle complex access patterns
UPDATE public.user_profiles 
SET 
    access = (
        SELECT jsonb_build_object(
            'role', COALESCE(
                CASE 
                    WHEN bool_or((value ->> 'role') = 'core') THEN 'core'
                    WHEN bool_or((value ->> 'role') = 'nonCore') THEN 'nonCore'
                    ELSE 'afk'
                END,
                'afk'
            ),
            'keywords', COALESCE(
                jsonb_agg(DISTINCT kw) FILTER (WHERE kw IS NOT NULL),
                '[]'::jsonb
            )
        )
        FROM auth.users u
        LEFT JOIN LATERAL jsonb_each(u.raw_user_meta_data -> 'mailboxAccess') AS mailbox_data ON true
        LEFT JOIN LATERAL jsonb_array_elements_text(mailbox_data.value -> 'keywords') AS kw ON true
        WHERE u.id = user_profiles.id
        AND u.raw_user_meta_data ? 'mailboxAccess'
        GROUP BY u.id
    ),
    updated_at = now()
WHERE 
    access = '{"role":"afk","keywords":[]}'::jsonb
    AND EXISTS (
        SELECT 1 FROM auth.users u 
        WHERE u.id = user_profiles.id 
        AND u.raw_user_meta_data ? 'mailboxAccess'
    );

-- Update the trigger to handle new fields
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    display_name,
    permissions,
    last_mailbox_slug,
    inviter_user_id,
    access,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    coalesce(new.raw_user_meta_data ->> 'permissions', 'member'),
    new.raw_user_meta_data ->> 'lastMailboxSlug',
    (new.raw_user_meta_data ->> 'inviter_user_id')::uuid,
    jsonb_build_object(
      'role', coalesce(new.raw_user_meta_data ->> 'role', 'afk'),
      'keywords', coalesce(
        (new.raw_user_meta_data -> 'keywords')::jsonb,
        '[]'::jsonb
      )
    ),
    now(),
    now()
  );
  return new;
END;
$$;
