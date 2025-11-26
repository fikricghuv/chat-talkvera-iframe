import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, ChatMessage } from '../lib/supabase';
import { getSenderId } from '../utils/senderId';
import { sendMessageToN8n } from '../services/n8nWebhook';
import { ChatHeader } from './ChatHeader';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';

const MESSAGES_PER_PAGE = 10;

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [senderId] = useState(() => getSenderId());
  const [sending, setSending] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const isInitialLoadRef = useRef(true);
  const lastMessageCountRef = useRef(0);

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

      const currentOffset = isInitial ? 0 : offset;
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
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

  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current || loadingMore || !hasMore) return;

    if (chatContainerRef.current.scrollTop === 0) {
      loadMessages(false);
    }
  }, [loadingMore, hasMore, offset]);

  const sendMessage = async (messageText: string) => {
    try {
      setSending(true);

      const createdAt = new Date().toISOString();

      const newMessage: Omit<ChatMessage, 'id'> = {
        sender_id: senderId,
        role: 'user',
        message: messageText,
        created_at: createdAt,
      };

      const optimisticMessage: ChatMessage = {
        ...newMessage,
        id: `temp-${Date.now()}`,
      };

      setMessages((prev) => [...prev, optimisticMessage]);

      const { error } = await supabase.from('chat_messages').insert([
        {
          sender_id: senderId,
          role: 'user',
          message: messageText,
        },
      ]);

      if (error) throw error;

      await sendMessageToN8n({
        sender_id: senderId,
        role: 'user',
        message: messageText,
        created_at: createdAt,
      });

      await loadMessages(true);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => prev.filter((msg) => !msg.id.startsWith('temp-')));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
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
              <ChatBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>

      <ChatInput onSendMessage={sendMessage} disabled={sending} />
    </div>
  );
}
