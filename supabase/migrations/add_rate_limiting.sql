-- ============================================
-- 🚀 SUPABASE RATE LIMITING SYSTEM (SECURE & ATOMIC)
-- ============================================

-- 1. Create rate_limits table with unique constraint
CREATE TABLE IF NOT EXISTS rate_limits (
    id BIGSERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    endpoint VARCHAR(100) NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(identifier, endpoint) -- Prevents duplicate entries
);

-- 2. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
ON rate_limits(identifier, endpoint);

-- 3. Enable RLS (Security Layer)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- 4. CRITICAL: No direct access! Only functions can access this table
DROP POLICY IF EXISTS "No direct access" ON rate_limits;
CREATE POLICY "No direct access" ON rate_limits FOR ALL USING (false);

-- ============================================
-- 🔐 THE MASTER FUNCTION (Atomic & Race-Condition Proof)
-- ============================================

CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier VARCHAR,
    p_endpoint VARCHAR,
    p_max_requests INTEGER,
    p_window_seconds INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    is_allowed BOOLEAN;
BEGIN
    -- UPSERT: Insert and Update in ONE atomic operation
    -- No race condition possible!
    INSERT INTO rate_limits (identifier, endpoint, request_count, window_start)
    VALUES (p_identifier, p_endpoint, 1, NOW())
    ON CONFLICT (identifier, endpoint)
    DO UPDATE SET
        -- If window expired, reset to 1, otherwise increment
        request_count = CASE 
            WHEN (NOW() - rate_limits.window_start) > (p_window_seconds || ' seconds')::INTERVAL 
            THEN 1 
            ELSE rate_limits.request_count + 1 
        END,
        -- If window expired, start new window
        window_start = CASE 
            WHEN (NOW() - rate_limits.window_start) > (p_window_seconds || ' seconds')::INTERVAL 
            THEN NOW() 
            ELSE rate_limits.window_start 
        END
    RETURNING (request_count <= p_max_requests) INTO is_allowed;

    RETURN is_allowed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- SECURITY DEFINER = Runs with admin privileges, bypasses RLS

-- ============================================
-- 📊 GET RATE LIMIT INFO (For UI display)
-- ============================================

CREATE OR REPLACE FUNCTION get_rate_limit_status(
    p_identifier VARCHAR,
    p_endpoint VARCHAR,
    p_max_requests INTEGER,
    p_window_seconds INTEGER
)
RETURNS TABLE (
    is_allowed BOOLEAN,
    current_count INTEGER,
    seconds_remaining INTEGER
) AS $$
DECLARE
    v_record RECORD;
    v_allowed BOOLEAN;
    v_count INTEGER;
    v_remaining INTEGER;
BEGIN
    -- Get current state
    SELECT request_count, window_start INTO v_record
    FROM rate_limits 
    WHERE identifier = p_identifier AND endpoint = p_endpoint;

    IF NOT FOUND THEN
        -- No record = allowed
        RETURN QUERY SELECT TRUE, 0, 0;
    ELSE
        -- Check if window expired
        IF (NOW() - v_record.window_start) > (p_window_seconds || ' seconds')::INTERVAL THEN
            -- Window expired = allowed, 0 used
            RETURN QUERY SELECT TRUE, 0, 0;
        END IF;

        -- Calculate remaining time
        v_remaining := p_window_seconds - EXTRACT(EPOCH FROM (NOW() - v_record.window_start))::INTEGER;
        v_count := v_record.request_count;
        v_allowed := v_count <= p_max_requests;

        RETURN QUERY SELECT v_allowed, v_count, GREATEST(0, v_remaining);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 🧹 CLEANUP FUNCTION (Run periodically)
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS VOID AS $$
BEGIN
    DELETE FROM rate_limits 
    WHERE window_start < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 🔑 GRANT PERMISSIONS (Only to functions, not direct table access)
-- ============================================

GRANT EXECUTE ON FUNCTION check_rate_limit(VARCHAR, VARCHAR, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit(VARCHAR, VARCHAR, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit(VARCHAR, VARCHAR, INTEGER, INTEGER) TO anon;

GRANT EXECUTE ON FUNCTION get_rate_limit_status(VARCHAR, VARCHAR, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_rate_limit_status(VARCHAR, VARCHAR, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rate_limit_status(VARCHAR, VARCHAR, INTEGER, INTEGER) TO anon;

GRANT EXECUTE ON FUNCTION cleanup_expired_rate_limits() TO service_role;

-- ============================================
-- 📋 HOW TO USE IN YOUR CODE:
-- ============================================
--
-- const { data: isAllowed } = await supabase.rpc('check_rate_limit', {
--   p_identifier: user.id,        // or IP address
--   p_endpoint: 'messages',       // endpoint name
--   p_max_requests: 60,           // max requests allowed
--   p_window_seconds: 60          // window in seconds
-- });
--
-- if (!isAllowed) {
--   alert("Bhai bas kar! Bahut request bhej diye.");
--   return;
-- }
--
-- ============================================
-- 📊 RATE LIMITS CONFIG:
-- ============================================
--
-- General: 100 requests / 15 minutes (900 seconds)
-- Auth: 5 requests / 1 hour (3600 seconds)
-- Search: 30 requests / 1 minute (60 seconds)
-- Messages: 60 requests / 1 minute (60 seconds)
--
-- ============================================
