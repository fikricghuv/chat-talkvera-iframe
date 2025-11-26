/*
  # Create chat_messages table

  1. New Tables
    - `chat_messages`
      - `id` (uuid, primary key) - Unique identifier for each message
      - `sender_id` (text) - UUID stored in localStorage to identify the sender
      - `role` (text) - Either 'agent' or 'user' to distinguish message sender
      - `message` (text) - The actual message content
      - `created_at` (timestamptz) - Timestamp when the message was created

  2. Security
    - Enable RLS on `chat_messages` table
    - Add policy to allow anyone to read messages (public chat interface)
    - Add policy to allow anyone to insert messages (users can send messages)

  3. Indexes
    - Add index on created_at for efficient sorting and pagination
    - Add index on sender_id for filtering messages by sender
*/

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('agent', 'user')),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read chat messages"
  ON chat_messages
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert chat messages"
  ON chat_messages
  FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);