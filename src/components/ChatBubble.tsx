import { User, Bot, ThumbsUp, ThumbsDown } from 'lucide-react';
import { ChatMessage } from '../lib/supabase';

interface ChatBubbleProps {
  message: ChatMessage;
  onFeedback?: (messageId: string, feedback: 'like' | 'dislike') => void;
}

export function ChatBubble({ message, onFeedback }: ChatBubbleProps) {
  const isAgent = message.role === 'agent';
  const time = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const handleFeedback = (type: 'like' | 'dislike') => {
    if (!onFeedback) return;
    onFeedback(message.id, type);
  };

  return (
    <div className={`flex gap-2 mb-3 sm:mb-4 ${isAgent ? 'justify-start' : 'justify-end'}`}>
      {isAgent && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
      )}

      <div className="flex flex-col gap-1 max-w-[75%] sm:max-w-[70%]">
        <div
          className={`px-3 py-2 sm:px-4 rounded-[18px] shadow-sm ${
            isAgent
              ? 'bg-blue-500 text-white'
              : 'bg-white text-black border border-gray-200'
          }`}
        >
          <div className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.message}
          </div>
          <div className={`text-[10px] mt-1 ${isAgent ? 'text-blue-100' : 'text-gray-500'}`}>
            {time}
          </div>
        </div>

        {/* Feedback buttons - hanya untuk pesan agent */}
        {isAgent && onFeedback && (
          <div className="flex gap-1.5 sm:gap-2 px-1 sm:px-2 items-center">
            <button
              onClick={() => handleFeedback('like')}
              className={`p-1.5 rounded-full transition-all active:scale-95 touch-manipulation ${
                message.feedback === 'like'
                  ? 'bg-green-100 text-green-600'
                  : 'hover:bg-gray-100 text-gray-400 hover:text-green-600 active:bg-gray-200'
              }`}
              title="Like"
              aria-label="Like this message"
            >
              <ThumbsUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={() => handleFeedback('dislike')}
              className={`p-1.5 rounded-full transition-all active:scale-95 touch-manipulation ${
                message.feedback === 'dislike'
                  ? 'bg-red-100 text-red-600'
                  : 'hover:bg-gray-100 text-gray-400 hover:text-red-600 active:bg-gray-200'
              }`}
              title="Dislike"
              aria-label="Dislike this message"
            >
              <ThumbsDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            {message.feedback_text && (
              <span className="text-[10px] sm:text-xs text-gray-500 ml-0.5">
                ✓ Feedback diberikan
              </span>
            )}
          </div>
        )}
      </div>

      {!isAgent && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-cyan-500 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
      )}
    </div>
  );
}