import { useState, FormEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

const MAX_CHARACTERS = 500;

export function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled && message.length <= MAX_CHARACTERS) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Hanya update jika belum melebihi limit
    if (newValue.length <= MAX_CHARACTERS) {
      setMessage(newValue);
    }
  };

  const remainingChars = MAX_CHARACTERS - message.length;
  const isNearLimit = remainingChars <= 50;
  const isAtLimit = remainingChars === 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white px-4 py-3 border-t border-gray-200"
    >
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={message}
          onChange={handleChange}
          placeholder="Type a message..."
          disabled={disabled}
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0088cc] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!message.trim() || disabled || message.length > MAX_CHARACTERS}
          className="w-10 h-10 rounded-full bg-[#0088cc] text-white flex items-center justify-center hover:bg-[#0077b6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
      
      {/* Character counter - hanya muncul saat mengetik atau mendekati limit */}
      {message.length > 0 && (
        <div className="flex justify-end mt-1 px-2">
          <span
            className={`text-xs transition-colors ${
              isAtLimit
                ? 'text-red-500 font-semibold'
                : isNearLimit
                ? 'text-orange-500'
                : 'text-gray-400'
            }`}
          >
            {remainingChars} / {MAX_CHARACTERS}
          </span>
        </div>
      )}
    </form>
  );
}