// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Updated ChatMessage type untuk table baru
export interface ChatMessage {
  id: string;
  client_id: string;
  session_id: string;
  role: 'agent' | 'user';
  message: string;
  created_at: string;
  feedback?: 'like' | 'dislike' | null;
  feedback_text?: string | null;
}

// Updated function untuk update feedback di table baru
export async function updateMessageFeedback(
  messageId: string,
  feedback: 'like' | 'dislike',
  feedbackText: string | null
) {
  const { data, error } = await supabase
    .from('dt_lp_chat_messages')
    .update({
      feedback,
      feedback_text: feedbackText,
    })
    .eq('id', messageId)
    .select()
    .single();

  if (error) {
    console.error('Error updating feedback:', error);
    throw error;
  }

  return data;
}