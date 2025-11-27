import { useState } from 'react';
import { ThumbsUp, ThumbsDown, X } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  feedbackType: 'like' | 'dislike';
  onClose: () => void;
  onSubmit: (text: string) => void;
}

export function FeedbackModal({ 
  isOpen, 
  feedbackType,
  onClose, 
  onSubmit 
}: FeedbackModalProps) {
  const [feedbackText, setFeedbackText] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit(feedbackText);
    setFeedbackText('');
  };

  const handleSkip = () => {
    onSubmit('');
    setFeedbackText('');
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const title = feedbackType === 'like' 
    ? 'Apa yang Anda sukai?' 
    : 'Apa yang perlu diperbaiki?';
  
  const placeholder = feedbackType === 'like'
    ? 'Misal: Jawabannya sangat membantu dan jelas...'
    : 'Misal: Jawabannya kurang relevan atau tidak akurat...';

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in slide-in-from-bottom sm:zoom-in duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            {feedbackType === 'like' ? (
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <ThumbsUp className="w-4 h-4 text-green-600" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <ThumbsDown className="w-4 h-4 text-red-600" />
              </div>
            )}
            <h3 className="font-semibold text-base sm:text-lg">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto">
          <p className="text-sm text-gray-600 mb-3">
            Feedback Anda akan membantu kami meningkatkan kualitas layanan. 
            <span className="font-medium"> (Opsional)</span>
          </p>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder={placeholder}
            className="w-full h-32 sm:h-36 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm touch-manipulation"
            autoFocus
          />
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t flex-shrink-0 pb-safe">
          <button
            onClick={handleSkip}
            className="flex-1 px-4 py-3 sm:py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg font-medium transition-colors text-sm sm:text-base touch-manipulation"
          >
            Lewati
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-3 sm:py-2 text-white bg-blue-500 hover:bg-blue-600 active:bg-blue-700 rounded-lg font-medium transition-colors text-sm sm:text-base touch-manipulation"
          >
            Kirim Feedback
          </button>
        </div>
      </div>
    </div>
  );
}