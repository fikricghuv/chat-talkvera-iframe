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

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

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

  const handleFeedback = (messageId: string, feedbackType: 'like' | 'dislike') => {
    setSelectedMessageId(messageId);
    setSelectedFeedbackType(feedbackType);
    setShowFeedbackModal(true);
  };

  // Handler ketika modal di-submit
  const handleModalSubmit = async (feedbackText: string) => {
    if (!selectedMessageId || !selectedFeedbackType) return;

    try {
      // Update ke database
      await updateMessageFeedback(
        selectedMessageId, 
        selectedFeedbackType,
        feedbackText || null
      );
      
      // Update local state
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
      // Close modal
      setShowFeedbackModal(false);
      setSelectedMessageId(null);
      setSelectedFeedbackType(null);
    }
  };

  // Handler ketika modal di-close
  const handleModalClose = () => {
    setShowFeedbackModal(false);
    setSelectedMessageId(null);
    setSelectedFeedbackType(null);
  };

  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current || loadingMore || !hasMore) return;

    if (chatContainerRef.current.scrollTop === 0) {
      loadMessages(false);
    }
  }, [loadingMore, hasMore, offset]);

  const sendMessage = async (messageText: string) => {
    try {
      setSending(true);
      setWaitingForAgent(true);

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

        if (response.ok) {
          const agentResponses = await response.json();
          
          // N8N mengembalikan array of messages
          if (Array.isArray(agentResponses) && agentResponses.length > 0) {
            // Insert response agent ke database DULU
            const agentMessagesToInsert = agentResponses.map((msg: any) => ({
              sender_id: senderId,
              role: 'agent',
              message: msg.message,
              created_at: msg.created_at || new Date().toISOString(),
            }));

            const { data: insertedAgentMessages, error: agentError } = await supabase
              .from('chat_messages')
              .insert(agentMessagesToInsert)
              .select();

            if (agentError) {
              console.error('Error inserting agent messages:', agentError);
            } else if (insertedAgentMessages) {
              // Tambahkan ke state setelah berhasil insert ke database
              setMessages((prev) => [...prev, ...insertedAgentMessages as ChatMessage[]]);
            }
          }
        } else {
          console.error('N8N webhook error:', response.status, response.statusText);
        }
      }

      setWaitingForAgent(false);
    } catch (error) {
      console.error('Error sending message:', error);
      setWaitingForAgent(false);
    } finally {
      setSending(false);
    }
  };

  // Real-time subscription untuk pesan baru dari agent
  useEffect(() => {
    const storedSenderId = getSenderId();

    // Hindari multiple subscription
    if (isSubscribedRef.current) return;
    isSubscribedRef.current = true;

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
          const newMessage = payload.new as ChatMessage;
          
          // Hanya tambahkan jika pesan dari agent
          // Pesan user sudah ditambahkan langsung di sendMessage()
          if (newMessage.role === 'agent') {
            setMessages((prev) => {
              // Cek apakah pesan sudah ada (hindari duplikasi)
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              
              return [...prev, newMessage];
            });
            
            // Hide animasi typing ketika agent response diterima
            setWaitingForAgent(false);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      isSubscribedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Load messages dari database saat pertama kali
    loadMessages(true);
  }, []);

  useEffect(() => {
    if (isInitialLoadRef.current && !loading) {
      scrollToBottom();
      isInitialLoadRef.current = false;
      lastMessageCountRef.current = messages.length;
    } else if (!loading && messages.length > lastMessageCountRef.current) {
      scrollToBottom();
      lastMessageCountRef.current = messages.length;
    } else if (!loading && loadingMore === false && scrollPositionRef.current > 0) {
      if (chatContainerRef.current) {
        const newScrollHeight = chatContainerRef.current.scrollHeight;
        chatContainerRef.current.scrollTop = newScrollHeight - scrollPositionRef.current;
        scrollPositionRef.current = 0;
      }
    }
  }, [messages, loading, loadingMore]);

  return (
    <div className="h-screen flex flex-col bg-white">
      <ChatHeader />

      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50"
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
            
            {/* Loading indicator saat menunggu response agent */}
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