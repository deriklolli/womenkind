-- The handle_new_user trigger was inserting into public.profiles which no longer
-- exists in Supabase (profiles moved to RDS). Profile creation now happens in
-- RDS via /api/auth/create-patient after email verification. Make this a no-op.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
begin
  -- profiles table lives in RDS; nothing to do in Supabase on signup
  return new;
end;
$$;
