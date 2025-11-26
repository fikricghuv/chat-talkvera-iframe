import { User, Bot } from 'lucide-react';
import { ChatMessage } from '../lib/supabase';

interface ChatBubbleProps {
  message: ChatMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isAgent = message.role === 'agent';
  const time = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div className={`flex gap-2 mb-4 ${isAgent ? 'justify-start' : 'justify-end'}`}>
      {isAgent && (
        <div className="w-8 h-8 rounded-full bg-[#0088cc] flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}

      <div
        className={`max-w-[70%] px-4 py-2 rounded-[18px] shadow-sm ${
          isAgent
            ? 'bg-[#0088cc] text-white'
            : 'bg-white text-black border border-gray-200'
        }`}
      >
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.message}
        </div>
        <div className={`text-[10px] mt-1 ${isAgent ? 'text-blue-100' : 'text-gray-500'}`}>
          {time}
        </div>
      </div>

      {!isAgent && (
        <div className="w-8 h-8 rounded-full bg-[#31a24c] flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-white" />
        </div>
      )}
    </div>
  );
}
