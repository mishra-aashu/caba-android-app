-- Migration: Add RLS policies for call_history table
-- First, disable RLS to add policies
ALTER TABLE public.call_history DISABLE ROW LEVEL SECURITY;

-- Grant full access to authenticated users
GRANT ALL ON public.call_history TO authenticated;
GRANT ALL ON public.call_history TO anon;

-- Re-enable RLS with permissive policies
ALTER TABLE public.call_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all calls (for debugging)
-- In production, you might want to restrict this to only own calls
CREATE POLICY "Allow authenticated full access" ON public.call_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anon for read access (if needed)
CREATE POLICY "Allow anon read access" ON public.call_history
  FOR SELECT
  TO anon
  USING (true);
