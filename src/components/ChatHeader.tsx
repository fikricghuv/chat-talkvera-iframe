// Jika menggunakan Vite, pastikan path-nya sesuai dengan folder public
// Biasanya cukup dengan "/assets/profile-vera.png"
const VERA_IMAGE_URL = "/assets/profile-vera.png";

export function ChatHeader() {
  return (
    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-2 sm:gap-3 shadow-md">
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white/20">
        <img 
          src={VERA_IMAGE_URL} 
          alt="Vera AI" 
          className="w-full h-full object-cover"
          // Menambahkan fallback jika gambar gagal dimuat
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=Vera&background=0D8ABC&color=fff';
          }}
        />
      </div>
      <div className="flex-1">
        <div className="font-semibold text-sm sm:text-base flex items-center gap-1.5">
          Vera
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]"></span>
        </div>
        <div className="text-[11px] sm:text-xs text-white/80">Online</div>
      </div>
    </div>
  );
}