import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Bot } from 'lucide-react';
import { supabase, ChatMessage } from '../lib/supabase';
import { getSenderId } from '../utils/senderId';
import { sendMessageToN8n } from '../services/n8nWebhook';
import { ChatHeader } from './ChatHeader';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { updateMessageFeedback } from '../lib/supabase';
import { FeedbackModal } from './FeedbackModal'; 

const MESSAGES_PER_PAGE = 10;

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [senderId] = useState(() => getSenderId());
  const [sending, setSending] = useState(false);
  const [waitingForAgent, setWaitingForAgent] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const isInitialLoadRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  const isSubscribedRef = useRef(false);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedFeedbackType, setSelectedFeedbackType] = useState<'like' | 'dislike' | null>(null);

  // Fungsi scroll to bottom yang lebih smooth
  const scrollToBottom = useCallback((smooth = false) => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }, []);

  const loadMessages = async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
        if (chatContainerRef.current) {
          scrollPositionRef.current = chatContainerRef.current.scrollHeight;
        }
      }

      const storedSenderId = getSenderId();
      const currentOffset = isInitial ? 0 : offset;
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('sender_id', storedSenderId)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + MESSAGES_PER_PAGE - 1);

      if (error) throw error;

      if (data) {
        const reversedData = [...data].reverse();

        if (isInitial) {
          setMessages(reversedData);
          setOffset(data.length);
        } else {
          setMessages((prev) => [...reversedData, ...prev]);
          setOffset((prev) => prev + data.length);
        }

        setHasMore(data.length === MESSAGES_PER_PAGE);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Fungsi untuk refresh pesan terbaru (hanya 10 terakhir + pesan baru)
  const refreshLatestMessages = async () => {
    try {
      console.log('🔄 Refreshing latest messages...');
      const storedSenderId = getSenderId();
      
      // Ambil hanya 10 pesan terakhir
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('sender_id', storedSenderId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (data) {
        console.log('✅ Refreshed messages count:', data.length);
        // Reverse karena kita query descending
        const reversedData = [...data].reverse();
        setMessages(reversedData);
        setOffset(data.length);
        setHasMore(data.length === 10);
        
        // Scroll to bottom setelah refresh
        setTimeout(() => {
          scrollToBottom(true); // Smooth scroll
        }, 100);
      }
    } catch (error) {
      console.error('❌ Error refreshing messages:', error);
    }
  };

  const handleFeedback = (messageId: string, feedbackType: 'like' | 'dislike') => {
    setSelectedMessageId(messageId);
    setSelectedFeedbackType(feedbackType);
    setShowFeedbackModal(true);
  };

  const handleModalSubmit = async (feedbackText: string) => {
    if (!selectedMessageId || !selectedFeedbackType) return;

    try {
      await updateMessageFeedback(
        selectedMessageId, 
        selectedFeedbackType,
        feedbackText || null
      );
      
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === selectedMessageId 
            ? { 
                ...msg, 
                feedback: selectedFeedbackType,
                feedback_text: feedbackText || null
              } 
            : msg
        )
      );
      
      console.log('Feedback saved:', {
        messageId: selectedMessageId,
        feedback: selectedFeedbackType,
        feedbackText: feedbackText || '(no text)'
      });
    } catch (error) {
      console.error('Error updating feedback:', error);
    } finally {
      setShowFeedbackModal(false);
      setSelectedMessageId(null);
      setSelectedFeedbackType(null);
    }
  };

  const handleModalClose = () => {
    setShowFeedbackModal(false);
    setSelectedMessageId(null);
    setSelectedFeedbackType(null);
  };

  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current || loadingMore || !hasMore) return;

    // Cek jika user scroll ke paling atas (threshold 50px untuk lebih smooth)
    if (chatContainerRef.current.scrollTop < 50) {
      console.log('📜 User scrolled to top, loading more messages...');
      loadMessages(false);
    }
  }, [loadingMore, hasMore, offset]);

  const sendMessage = async (messageText: string) => {
    try {
      setSending(true);

      const createdAt = new Date().toISOString();

      // Insert pesan user ke database
      const { data: insertedData, error } = await supabase
        .from('chat_messages')
        .insert([
          {
            sender_id: senderId,
            role: 'user',
            message: messageText,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Tambahkan pesan user ke state secara langsung
      if (insertedData) {
        setMessages((prev) => [...prev, insertedData as ChatMessage]);
        
        // Scroll ke bawah setelah pesan user ditambahkan
        setTimeout(() => {
          scrollToBottom(true);
        }, 100);
        
        // Tampilkan animasi typing setelah pesan user masuk
        setTimeout(() => {
          setWaitingForAgent(true);
          // Scroll lagi untuk memastikan typing indicator terlihat
          setTimeout(() => {
            scrollToBottom(true);
          }, 100);
        }, 300);
      }

      // Kirim ke N8N webhook dan tunggu response
      const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
      
      if (n8nUrl) {
        const response = await fetch(n8nUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender_id: senderId,
            role: 'user',
            message: messageText,
            created_at: createdAt,
          }),
        });

        // Handle error response dari N8N
        if (!response.ok) {
          setWaitingForAgent(false);
          
          // Baca response body untuk mendapatkan pesan error
          let errorMessage = 'Mohon maaf terjadi kesalahan pada server kami.';
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage = errorText;
            }
          } catch (e) {
            console.error('Failed to read error response:', e);
          }

          // Insert pesan error dari server ke database
          await supabase
            .from('chat_messages')
            .insert([{
              sender_id: senderId,
              role: 'agent',
              message: errorMessage,
              created_at: new Date().toISOString(),
            }]);

          // Refresh setelah error
          setTimeout(() => {
            refreshLatestMessages();
          }, 1000);

          return;
        }

        // Handle successful response
        console.log('✅ N8N Response 200 OK - waiting 5 seconds before refresh...');
        
        // Tunggu 5 detik kemudian refresh pesan terbaru dari database
        setTimeout(async () => {
          console.log('⏰ 5 seconds passed, refreshing latest messages now...');
          await refreshLatestMessages();
          setWaitingForAgent(false);
        }, 5000);
      } else {
        setWaitingForAgent(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setWaitingForAgent(false);
      
      // Handle network error
      try {
        await supabase
          .from('chat_messages')
          .insert([{
            sender_id: senderId,
            role: 'agent',
            message: 'Mohon maaf, terjadi kesalahan dalam mengirim pesan. Silakan coba lagi.',
            created_at: new Date().toISOString(),
          }]);
        
        // Refresh setelah error
        setTimeout(() => {
          refreshLatestMessages();
        }, 1000);
      } catch (insertError) {
        console.error('Failed to insert error message:', insertError);
        // Fallback: tampilkan di UI saja tanpa database
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          sender_id: senderId,
          role: 'agent',
          message: 'Mohon maaf, terjadi kesalahan dalam mengirim pesan. Silakan coba lagi.',
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        setWaitingForAgent(false);
      }
    } finally {
      setSending(false);
    }
  };

  // Real-time subscription untuk pesan baru
  useEffect(() => {
    const storedSenderId = getSenderId();

    if (isSubscribedRef.current) return;
    isSubscribedRef.current = true;

    console.log('🔌 Setting up realtime subscription for sender:', storedSenderId);

    const subscription = supabase
      .channel('chat_messages_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `sender_id=eq.${storedSenderId}`,
        },
        (payload) => {
          console.log('📩 Realtime INSERT received:', payload);
          const newMessage = payload.new as ChatMessage;
          
          // Tambahkan pesan baru jika belum ada
          setMessages((prev) => {
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) {
              console.log('⚠️ Message already exists, skipping:', newMessage.id);
              return prev;
            }
            
            console.log('✅ Adding new message via realtime:', newMessage.role);
            return [...prev, newMessage];
          });
          
          // Hide animasi typing dan scroll ke bawah ketika agent response diterima
          if (newMessage.role === 'agent') {
            console.log('🤖 Agent message received via realtime, hiding loader');
            setWaitingForAgent(false);
            
            // Scroll ke bawah setelah agent message muncul
            setTimeout(() => {
              scrollToBottom(true);
            }, 100);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime subscription active!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime subscription error!');
        }
      });

    return () => {
      console.log('🔌 Unsubscribing from realtime');
      subscription.unsubscribe();
      isSubscribedRef.current = false;
    };
  }, [scrollToBottom]);

  useEffect(() => {
    loadMessages(true);
  }, []);

  // Effect untuk auto-scroll berdasarkan perubahan messages
  useEffect(() => {
    if (isInitialLoadRef.current && !loading) {
      scrollToBottom();
      isInitialLoadRef.current = false;
      lastMessageCountRef.current = messages.length;
    } else if (!loading && !loadingMore && messages.length > lastMessageCountRef.current) {
      // Hanya scroll ke bawah jika ada pesan baru (bukan dari load more)
      scrollToBottom(true);
      lastMessageCountRef.current = messages.length;
    } else if (!loading && loadingMore === false && scrollPositionRef.current > 0) {
      // Setelah load more, pertahankan posisi scroll relatif
      if (chatContainerRef.current) {
        const newScrollHeight = chatContainerRef.current.scrollHeight;
        const scrollDiff = newScrollHeight - scrollPositionRef.current;
        chatContainerRef.current.scrollTop = scrollDiff;
        scrollPositionRef.current = 0;
      }
    }
  }, [messages, loading, loadingMore, scrollToBottom]);

  // Effect khusus untuk auto-scroll saat waitingForAgent berubah
  useEffect(() => {
    if (waitingForAgent) {
      // Scroll ke bawah saat typing indicator muncul
      setTimeout(() => {
        scrollToBottom(true);
      }, 100);
    }
  }, [waitingForAgent, scrollToBottom]);

  return (
    <div className="h-screen flex flex-col bg-white">
      <ChatHeader />

      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50"
        style={{ overflowAnchor: 'none' }}
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
          </div>
        ) : (
          <div>
            {messages.map((message) => (
              <ChatBubble 
                key={message.id} 
                message={message}
                onFeedback={handleFeedback}
              />
            ))}
            
            {waitingForAgent && (
              <div className="flex items-start gap-2 mb-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div className="bg-blue-500 text-white rounded-[18px] px-4 py-3 shadow-sm max-w-[70%]">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-blue-100 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-blue-100 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-blue-100 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ChatInput onSendMessage={sendMessage} disabled={sending} />
      {selectedFeedbackType && (
        <FeedbackModal
          isOpen={showFeedbackModal}
          feedbackType={selectedFeedbackType}
          onClose={handleModalClose}
          onSubmit={handleModalSubmit}
        />
      )}
    </div>
  );
}