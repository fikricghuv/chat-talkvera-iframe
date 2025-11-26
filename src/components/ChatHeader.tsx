import { User } from 'lucide-react';

export function ChatHeader() {
  return (
    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-3 flex items-center gap-3 shadow-md">
      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
        <User className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-base">Vera</div>
        <div className="text-xs text-white/80">Online</div>
      </div>
    </div>
  );
}
