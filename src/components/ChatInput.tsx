import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 🔥 FIX: Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height untuk recalculate
    textarea.style.height = 'auto';
    
    // Set new height berdasarkan content (max 120px ~ 5 lines)
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = `${newHeight}px`;
  }, [message]);

  // 🔥 FIX: Prevent zoom on focus (iOS Safari)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const handleFocus = () => {
      // Scroll input ke view tanpa zoom
      setTimeout(() => {
        textarea.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest',
          inline: 'nearest'
        });
      }, 300);
    };

    textarea.addEventListener('focus', handleFocus);
    
    return () => {
      textarea.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (tapi bukan Shift+Enter)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white">
      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex gap-2 items-center">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik pesan..."
              disabled={disabled}
              rows={1}
              className="w-full px-4 py-3 pr-12 rounded-2xl border border-gray-300 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       resize-none overflow-y-auto
                       disabled:bg-gray-100 disabled:cursor-not-allowed"
              style={{
                minHeight: '48px',
                maxHeight: '120px',
                // 🔥 CRITICAL: Prevent zoom on iOS
                fontSize: '16px', // Must be >= 16px to prevent zoom!
                lineHeight: '1.5',
                // 🔥 Prevent text selection zoom
                WebkitTapHighlightColor: 'transparent',
                // 🔥 Prevent auto-zoom
                WebkitTextSizeAdjust: '100%'
              }}
            />
          </div>
          
          <button
            type="submit"
            disabled={!message.trim() || disabled}
            className="flex-shrink-0 p-3 rounded-full bg-blue-500 text-white 
                     hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors duration-200
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}