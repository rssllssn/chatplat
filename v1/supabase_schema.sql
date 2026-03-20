-- ============================================
-- Anonymous Chat Platform - Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT DEFAULT 'Stranger',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 2. ROOMS TABLE
CREATE TABLE IF NOT EXISTS rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID REFERENCES auth.users(id),
  user2_id UUID REFERENCES auth.users(id),
  user1_display_name TEXT DEFAULT 'Stranger',
  user2_display_name TEXT DEFAULT 'Stranger',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own rooms"
  ON rooms FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can update own rooms"
  ON rooms FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Authenticated users can insert rooms"
  ON rooms FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- 3. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  sender_name TEXT DEFAULT 'Stranger',
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read messages in their rooms"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = messages.room_id
      AND (rooms.user1_id = auth.uid() OR rooms.user2_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages in their rooms"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = messages.room_id
      AND rooms.status = 'active'
      AND (rooms.user1_id = auth.uid() OR rooms.user2_id = auth.uid())
    )
  );

-- 4. QUEUE TABLE
CREATE TABLE IF NOT EXISTS queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  display_name TEXT DEFAULT 'Stranger',
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read queue"
  ON queue FOR SELECT
  USING (true);

CREATE POLICY "Users can insert into queue"
  ON queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own queue entry"
  ON queue FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own queue entry"
  ON queue FOR DELETE
  USING (auth.uid() = user_id);

-- 5. MATCHMAKING FUNCTION
-- This function atomically finds a waiting partner and creates a room
CREATE OR REPLACE FUNCTION find_match(current_user_id UUID, current_display_name TEXT)
RETURNS JSON AS $$
DECLARE
  partner RECORD;
  new_room RECORD;
BEGIN
  -- Find the oldest waiting user that isn't us
  SELECT * INTO partner
  FROM queue
  WHERE status = 'waiting'
    AND user_id != current_user_id
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- No partner found
  IF partner IS NULL THEN
    RETURN json_build_object('matched', false);
  END IF;

  -- Create a room
  INSERT INTO rooms (user1_id, user2_id, user1_display_name, user2_display_name, status)
  VALUES (partner.user_id, current_user_id, partner.display_name, current_display_name, 'active')
  RETURNING * INTO new_room;

  -- Remove partner from queue
  DELETE FROM queue WHERE id = partner.id;

  -- Remove current user from queue
  DELETE FROM queue WHERE user_id = current_user_id AND status = 'waiting';

  RETURN json_build_object(
    'matched', true,
    'room_id', new_room.id,
    'partner_name', partner.display_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      'Stranger_' || SUBSTRING(NEW.id::TEXT FROM 1 FOR 8)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 7. ENABLE REALTIME on rooms and messages
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 8. CLEANUP FUNCTION (optional - call periodically or via cron)
-- Removes stale queue entries older than 5 minutes
CREATE OR REPLACE FUNCTION cleanup_stale_queue()
RETURNS void AS $$
BEGIN
  DELETE FROM queue
  WHERE status = 'waiting'
    AND created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
