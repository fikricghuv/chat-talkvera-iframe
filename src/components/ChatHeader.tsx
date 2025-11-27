import { User } from 'lucide-react';

export function ChatHeader() {
  return (
    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-2 sm:gap-3 shadow-md">
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center">
        <User className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-sm sm:text-base">Vera</div>
        <div className="text-[11px] sm:text-xs text-white/80">Online</div>
      </div>
    </div>
  );
}