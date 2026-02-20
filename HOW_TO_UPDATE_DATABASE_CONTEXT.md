# How to Update database_context.md

## ⚠️ IMPORTANT: Avoid Timeout Errors

**DO NOT run all queries at once!** Run them **ONE AT A TIME**.

### Recommended Approach:

1. **Use `FAST_EXPORT.sql`** - Simplest, fastest queries
2. **Or use `extract_by_table.sql`** - Process one table at a time
3. **Avoid `extract_database_structure.sql`** - Too complex, causes timeouts

## Step-by-Step Guide

### Step 1: Run SQL Queries (ONE AT A TIME)

1. Open Supabase SQL Editor
2. **Start with `FAST_EXPORT.sql`** - Run queries one by one
3. Export results after each query
4. If timeout occurs, use `extract_by_table.sql` instead

### Step 2: Extract Information

#### For Tables:
```sql
-- Run this query and export results
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

#### For RLS Policies:
```sql
-- Run this query
SELECT * FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

#### For Foreign Keys:
```sql
-- Run this query
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public';
```

#### For Views:
```sql
-- Run this query
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_schema = 'public';
```

#### For Functions:
```sql
-- Run this query
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prokind = 'f';
```

### Step 3: Update database_context.md

Update the following sections:

1. **Tables Section** - Add all tables with columns
2. **RLS Policies Section** - Add all policies
3. **Foreign Keys Section** - Add all relationships
4. **Views Section** - Add all views
5. **Functions Section** - Add all RPC functions

### Step 4: Compare with Frontend

1. Search frontend code for `.from('table_name')`
2. Check if table exists in database_context.md
3. Verify column names match
4. Check RLS policies allow the operations
5. Verify foreign keys are correct

### Step 5: Fix Mismatches

1. If frontend uses a column that doesn't exist → Add to SQL or fix frontend
2. If RLS blocks operation → Update RLS policy
3. If foreign key missing → Add foreign key constraint
4. If view/function missing → Add to SQL file

---

## Quick Reference Queries

### Get all table names:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### Get all columns for a specific table:
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'your_table_name'
ORDER BY ordinal_position;
```

### Get all RLS policies for a table:
```sql
SELECT * FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'your_table_name';
```

### Check if a column exists:
```sql
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
        AND table_name = 'your_table_name'
        AND column_name = 'your_column_name'
);
```

---

## Example Output Format for database_context.md

```markdown
## Tables

### users
- id: UUID (PRIMARY KEY)
- name: TEXT (NOT NULL)
- email: TEXT (UNIQUE)
- created_at: TIMESTAMPTZ (DEFAULT NOW())

## RLS Policies

| tablename | policyname | cmd | roles | qual | with_check |
|-----------|------------|-----|-------|------|------------|
| users | Users can view own profile | SELECT | {public} | (auth.uid() = id) | null |

## Foreign Keys

| table_name | column_name | foreign_table_name | foreign_column_name |
|------------|-------------|-------------------|---------------------|
| messages | sender_id | users | id |
```

---

## Tips

1. **Export as CSV** - Easier to work with in Excel/Sheets
2. **Use JSON export** - For programmatic processing
3. **Compare regularly** - Keep database_context.md updated
4. **Document changes** - Note when you add/remove tables/columns
5. **Test after updates** - Verify frontend still works
