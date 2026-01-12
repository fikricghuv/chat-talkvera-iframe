import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase, ChatMessage } from '../lib/supabase';
import { getSenderId } from '../utils/senderId';
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [waitingForAgent, setWaitingForAgent] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const isInitialLoadRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  const isSubscribedRef = useRef(false);
  
  const sessionCreationInProgressRef = useRef(false);
  const sessionCreationPromiseRef = useRef<Promise<string> | null>(null);

  const waitingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedFeedbackType, setSelectedFeedbackType] = useState<'like' | 'dislike' | null>(null);

  const clientId = "7f91bc37-3173-4bec-98bc-ec27627624f1";

  // 🔥 NEW: Track keyboard state
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const initialViewportHeightRef = useRef(window.innerHeight);

  // 🔥 NEW: Detect keyboard open/close
  useEffect(() => {
    // Save initial viewport height
    initialViewportHeightRef.current = window.innerHeight;

    const handleResize = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const heightDiff = initialViewportHeightRef.current - currentHeight;
      
      // Keyboard dianggap terbuka jika viewport berkurang > 150px
      const keyboardIsOpen = heightDiff > 150;
      
      if (keyboardIsOpen !== isKeyboardOpen) {
        setIsKeyboardOpen(keyboardIsOpen);
        console.log('🎹 Keyboard state:', keyboardIsOpen ? 'OPEN' : 'CLOSED');
        
        // Scroll to bottom ketika keyboard buka
        if (keyboardIsOpen) {
          setTimeout(() => {
            scrollToBottom(false);
          }, 300);
        }
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, [isKeyboardOpen]);

  const scrollToBottom = useCallback((smooth = false) => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }, []);

  const getOrCreateSession = async (): Promise<string> => {
    if (sessionId) {
      console.log('✅ Using cached sessionId:', sessionId);
      return sessionId;
    }

    if (sessionCreationInProgressRef.current && sessionCreationPromiseRef.current) {
      console.log('⏳ Session creation already in progress, waiting...');
      return sessionCreationPromiseRef.current;
    }

    sessionCreationInProgressRef.current = true;
    
    const sessionPromise = (async () => {
      try {
        const storedSenderId = getSenderId();

        console.log('🔍 Checking for existing session...');
        
        const { data: existingSession, error: sessionCheckError } = await supabase
          .from('dt_chat_sessions')
          .select('id')
          .eq('sender_id', storedSenderId)
          .eq('status', 'IN_PROGRESS')
          .eq('client_id', clientId)
          .eq('source', 'landing_page')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sessionCheckError) {
          throw sessionCheckError;
        }

        if (existingSession) {
          console.log('✅ Found existing session:', existingSession.id);
          setSessionId(existingSession.id);
          return existingSession.id;
        }

        console.log('✨ Creating new session...');
        const { data: newSession, error: createSessionError } = await supabase
          .from('dt_chat_sessions')
          .insert([
            {
              client_id: clientId,
              source: 'landing_page',
              sender_id: storedSenderId,
              status: 'IN_PROGRESS',
              total_messages: 0,
            },
          ])
          .select('id')
          .single();

        if (createSessionError) {
          if (createSessionError.code === '23505') {
            console.log('⚠️ Duplicate session detected, fetching existing...');
            const { data: existingAfterError } = await supabase
              .from('dt_chat_sessions')
              .select('id')
              .eq('sender_id', storedSenderId)
              .eq('status', 'IN_PROGRESS')
              .eq('client_id', clientId)
              .eq('source', 'landing_page')
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            
            if (existingAfterError) {
              setSessionId(existingAfterError.id);
              return existingAfterError.id;
            }
          }
          throw createSessionError;
        }

        console.log('✨ Created new session:', newSession.id);
        setSessionId(newSession.id);
        return newSession.id;
      } finally {
        sessionCreationInProgressRef.current = false;
        sessionCreationPromiseRef.current = null;
      }
    })();

    sessionCreationPromiseRef.current = sessionPromise;
    
    return sessionPromise;
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

      const currentSessionId = await getOrCreateSession();

      const currentOffset = isInitial ? 0 : offset;
      
      const { data, error } = await supabase
        .from('dt_lp_chat_messages')
        .select('*')
        .eq('session_id', currentSessionId)
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

  const refreshLatestMessages = async () => {
    try {
      console.log('🔄 Refreshing latest messages...');
      
      if (!sessionId) {
        console.warn('⚠️ No session ID available, cannot refresh');
        return;
      }
      
      const { data, error } = await supabase
        .from('dt_lp_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (data) {
        console.log('✅ Refreshed messages count:', data.length);
        const reversedData = [...data].reverse();
        setMessages(reversedData);
        setOffset(data.length);
        setHasMore(data.length === 10);
        
        setTimeout(() => {
          scrollToBottom(true);
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

    if (chatContainerRef.current.scrollTop < 50) {
      console.log('📜 User scrolled to top, loading more messages...');
      loadMessages(false);
    }
  }, [loadingMore, hasMore, offset, sessionId]);

  const sendMessage = async (messageText: string) => {
    try {
      setSending(true);

      const createdAt = new Date().toISOString();
      const currentSessionId = await getOrCreateSession();

      const { data: insertedData, error } = await supabase
        .from('dt_lp_chat_messages')
        .insert([
          {
            client_id: clientId,
            session_id: currentSessionId,
            role: 'user',
            message: messageText,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (insertedData) {
        setMessages((prev) => [...prev, insertedData as ChatMessage]);
        
        setTimeout(() => {
          scrollToBottom(true);
        }, 100);
        
        waitingTimeoutRef.current = setTimeout(() => {
          setWaitingForAgent(true);
          setTimeout(() => {
            scrollToBottom(true);
          }, 100);
        }, 300);
      }

      const n8nUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
      const authToken = import.meta.env.VITE_AUTH_WEBHOOK_TOKEN;
      const hmacSecret = import.meta.env.VITE_HMAC_SECRET;
      
      if (n8nUrl) {
        const payload = {
          sender_id: senderId,
          session_id: currentSessionId,
          client_id: clientId,
          role: 'user',
          message: messageText,
          created_at: createdAt,
        };
        
        const payloadString = JSON.stringify(payload);
        const encoder = new TextEncoder();
        const data = encoder.encode(payloadString);
        const keyData = encoder.encode(hmacSecret);
        
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
        
        const signatureHex = Array.from(new Uint8Array(signature))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        const headers = {
          'Content-Type': 'application/json',
          'X-Api-Key': authToken,
          'X-Signature': signatureHex,
        };
        
        const response = await fetch(n8nUrl, {
          method: 'POST',
          headers: headers,
          body: payloadString,
        });

        if (!response.ok) {
          if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
          setWaitingForAgent(false);
          
          let errorMessage = 'Mohon maaf terjadi kesalahan pada server kami.';
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage = errorText;
            }
          } catch (e) {
            console.error('Failed to read error response:', e);
          }

          await supabase
            .from('dt_lp_chat_messages')
            .insert([{
              client_id: clientId,
              session_id: currentSessionId,
              role: 'agent',
              message: errorMessage,
              created_at: new Date().toISOString(),
            }]);

          setTimeout(() => {
            refreshLatestMessages();
          }, 1000);

          return;
        }

        console.log('✅ N8N Response 200 OK - waiting 5 seconds before refresh...');
        
        setTimeout(async () => {
          console.log('⏰ 5 seconds passed, refreshing latest messages now...');
          await refreshLatestMessages();
          if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
          setWaitingForAgent(false);
        }, 5000);
      } else {
        if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
        setWaitingForAgent(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      if (waitingTimeoutRef.current) clearTimeout(waitingTimeoutRef.current);
      setWaitingForAgent(false);
      
      try {
        const currentSessionId = sessionId || await getOrCreateSession();
        
        await supabase
          .from('dt_lp_chat_messages')
          .insert([{
            client_id: clientId,
            session_id: currentSessionId,
            role: 'agent',
            message: 'Mohon maaf, terjadi kesalahan dalam mengirim pesan. Silakan coba lagi.',
          }]);
        
        setTimeout(() => {
          refreshLatestMessages();
        }, 1000);
      } catch (insertError) {
        console.error('Failed to insert error message:', insertError);
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          session_id: sessionId || '',
          client_id: clientId,
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

  useEffect(() => {
    if (isSubscribedRef.current || !sessionId) return;
    isSubscribedRef.current = true;

    console.log('🔌 Setting up realtime subscription for session:', sessionId);

    const subscription = supabase
      .channel('lp_chat_messages_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dt_lp_chat_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('📩 Realtime INSERT received:', payload);
          const newMessage = payload.new as ChatMessage;
          
          setMessages((prev) => {
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) {
              console.log('⚠️ Message already exists, skipping:', newMessage.id);
              return prev;
            }
            
            console.log('✅ Adding new message via realtime:', newMessage.role);
            return [...prev, newMessage];
          });
          
          if (newMessage.role === 'agent') {
            console.log('🤖 Agent message received via realtime, hiding loader');
            setWaitingForAgent(false);
            
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
  }, [sessionId, scrollToBottom]);

  useEffect(() => {
    let isMounted = true;
    
    const initializeChat = async () => {
      if (isMounted) {
        await loadMessages(true);
      }
    };
    
    initializeChat();
    
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isInitialLoadRef.current && !loading) {
      scrollToBottom();
      isInitialLoadRef.current = false;
      lastMessageCountRef.current = messages.length;
    } else if (!loading && !loadingMore && messages.length > lastMessageCountRef.current) {
      scrollToBottom(true);
      lastMessageCountRef.current = messages.length;
    } else if (!loading && loadingMore === false && scrollPositionRef.current > 0) {
      if (chatContainerRef.current) {
        const newScrollHeight = chatContainerRef.current.scrollHeight;
        const scrollDiff = newScrollHeight - scrollPositionRef.current;
        chatContainerRef.current.scrollTop = scrollDiff;
        scrollPositionRef.current = 0;
      }
    }
  }, [messages, loading, loadingMore, scrollToBottom]);

  useEffect(() => {
    if (waitingForAgent) {
      setTimeout(() => {
        scrollToBottom(true);
      }, 100);
    }
  }, [waitingForAgent, scrollToBottom]);

  return (
    <div 
      className="h-screen flex flex-col bg-white"
      style={{
        // 🔥 FIX: Prevent viewport zoom on input focus
        height: '100dvh', // Dynamic viewport height (support keyboard)
        maxHeight: '100dvh',
        overflow: 'hidden'
      }}
    >
      <ChatHeader />

      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50"
        style={{ 
          overflowAnchor: 'none',
          // 🔥 FIX: Prevent scroll bounce & zoom
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}
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
              <div className="flex gap-2 mb-3 sm:mb-4 justify-start animate-in fade-in duration-300">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm border border-gray-100">
                  <img 
                    src="/assets/profile-vera.png" 
                    alt="Vera" 
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex flex-col gap-1 max-w-[75%] sm:max-w-[70%]">
                  <div className="bg-blue-500 px-3 py-2 sm:px-4 sm:py-3 shadow-sm rounded-[18px] rounded-tl-[4px] w-fit">
                    <div className="flex gap-1.5 items-center h-5">
                      <div 
                        className="w-1.5 h-1.5 bg-blue-100 rounded-full animate-bounce" 
                        style={{ animationDelay: '0ms' }}
                      ></div>
                      <div 
                        className="w-1.5 h-1.5 bg-blue-100 rounded-full animate-bounce" 
                        style={{ animationDelay: '150ms' }}
                      ></div>
                      <div 
                        className="w-1.5 h-1.5 bg-blue-100 rounded-full animate-bounce" 
                        style={{ animationDelay: '300ms' }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🔥 WRAPPER untuk ChatInput agar stay at bottom */}
      <div 
        className="flex-shrink-0"
        style={{
          // Prevent input area dari ikut scroll
          position: 'sticky',
          bottom: 0,
          zIndex: 10
        }}
      >
        <ChatInput onSendMessage={sendMessage} disabled={sending} />
      </div>

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