import { createBrowserClient } from '@supabase/ssr'

// Client-side Supabase instance (for use in components).
// Uses createBrowserClient so sessions are stored in cookies,
// allowing server-side API routes to verify the session via getServerSession().
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
