import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface ChatMessage {
  id: string;
  sender_id: string;
  role: 'agent' | 'user';
  message: string;
  created_at: string;
  feedback?: 'like' | 'dislike' | null;
  feedback_text?: string | null; // Field baru untuk teks feedback
}

// Fungsi untuk update feedback beserta teks opsionalnya
export async function updateMessageFeedback(
  messageId: string, 
  feedback: 'like' | 'dislike' | null,
  feedbackText?: string | null
) {
  const { data, error } = await supabase
    .from('chat_messages')
    .update({ 
      feedback,
      feedback_text: feedbackText || null 
    })
    .eq('id', messageId)
    .select()
    .single();

  if (error) throw error;
  return data;
}