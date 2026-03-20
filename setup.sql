-- ==========================================
-- RANDOM CHAT FEATURE SETUP (ISOLATED)
-- ==========================================

-- 1. Create waiting_users table
CREATE TABLE IF NOT EXISTS waiting_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username text,
    gender text,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Create random_sessions table
CREATE TABLE IF NOT EXISTS random_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user1 text,
    user2 text,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- 3. Create random_messages table
CREATE TABLE IF NOT EXISTS random_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid REFERENCES random_sessions(id) ON DELETE CASCADE,
    sender text,
    message text,
    created_at timestamp with time zone DEFAULT now()
);

-- 4. Enable RLS for all tables
ALTER TABLE waiting_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE random_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE random_messages ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS Policies (Allow all for simplicity as requested)
DROP POLICY IF EXISTS "Allow all access to waiting_users" ON waiting_users;
CREATE POLICY "Allow all access to waiting_users" ON waiting_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to random_sessions" ON random_sessions;
CREATE POLICY "Allow all access to random_sessions" ON random_sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to random_messages" ON random_messages;
CREATE POLICY "Allow all access to random_messages" ON random_messages FOR ALL USING (true) WITH CHECK (true);

-- 6. Add Index for performance
DROP INDEX IF EXISTS idx_waiting_users_created;
CREATE INDEX idx_waiting_users_created ON waiting_users(created_at);

-- 7. Enable Realtime for matchmaking and chat
-- This allows the app to listen for new users and matches instantly
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'waiting_users') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE waiting_users;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'random_sessions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE random_sessions;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'random_messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE random_messages;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- If publication doesn't exist, ignore or handle accordingly
        RAISE NOTICE 'Could not add tables to publication. Ensure publication "supabase_realtime" exists.';
END $$;