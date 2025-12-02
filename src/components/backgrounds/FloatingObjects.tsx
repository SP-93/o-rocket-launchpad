const FloatingObjects = () => {
  return (
    <div className="fixed inset-0 z-[3] pointer-events-none overflow-hidden">
      {/* Moon */}
      <div className="absolute top-[10%] right-[10%] w-32 h-32 rounded-full bg-gradient-to-br from-gray-200 to-gray-400 shadow-[0_0_80px_rgba(255,255,255,0.3)] animate-float-slow">
        {/* Moon craters */}
        <div className="absolute top-[20%] left-[30%] w-4 h-4 rounded-full bg-gray-500/30" />
        <div className="absolute top-[60%] left-[50%] w-6 h-6 rounded-full bg-gray-500/20" />
        <div className="absolute top-[40%] left-[70%] w-3 h-3 rounded-full bg-gray-500/25" />
      </div>

      {/* Spaceship */}
      <div className="absolute top-[20%] animate-fly-through" style={{ animationDelay: '2s' }}>
        <svg width="60" height="30" viewBox="0 0 60 30" className="drop-shadow-[0_0_15px_rgba(0,245,255,0.6)]">
          <path d="M0,15 L20,5 L50,10 L60,15 L50,20 L20,25 Z" fill="url(#spaceshipGradient)" />
          <circle cx="45" cy="15" r="3" fill="#00f5ff" opacity="0.8" />
          <defs>
            <linearGradient id="spaceshipGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>
        </svg>
        {/* Engine glow */}
        <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-4 h-2 bg-cyan-400 rounded-full blur-sm animate-pulse" />
      </div>

      {/* Alien Ship (UFO) */}
      <div className="absolute top-[60%] animate-zigzag" style={{ animationDelay: '5s' }}>
        <svg width="50" height="30" viewBox="0 0 50 30" className="drop-shadow-[0_0_15px_rgba(191,0,255,0.6)]">
          {/* UFO dome */}
          <ellipse cx="25" cy="12" rx="15" ry="8" fill="url(#ufoGradient)" opacity="0.8" />
          {/* UFO base */}
          <ellipse cx="25" cy="20" rx="25" ry="6" fill="url(#ufoBaseGradient)" />
          {/* Light beam */}
          <path d="M15,26 L10,35 L40,35 L35,26 Z" fill="#bf00ff" opacity="0.2" />
          <defs>
            <linearGradient id="ufoGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#bf00ff" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="ufoBaseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
        </svg>
        {/* Blinking lights */}
        <div className="absolute bottom-2 left-3 w-1 h-1 bg-green-400 rounded-full animate-pulse" />
        <div className="absolute bottom-2 left-1/2 w-1 h-1 bg-red-400 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-2 right-3 w-1 h-1 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Comet */}
      <div className="absolute animate-comet" style={{ animationDelay: '8s' }}>
        <div className="relative">
          {/* Comet core */}
          <div className="w-4 h-4 bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 rounded-full shadow-[0_0_30px_rgba(0,245,255,0.8)]" />
          {/* Comet tail */}
          <div className="absolute top-1/2 left-1/2 transform -translate-y-1/2">
            <div className="w-[200px] h-[3px] bg-gradient-to-r from-cyan-400/80 via-blue-400/40 to-transparent blur-sm" />
            <div className="w-[150px] h-[2px] bg-gradient-to-r from-purple-400/60 via-pink-400/30 to-transparent blur-sm mt-1" />
          </div>
        </div>
      </div>

      {/* Small Planets/Asteroids */}
      <div className="absolute top-[70%] left-[15%] w-12 h-12 rounded-full bg-gradient-to-br from-red-900 to-orange-800 animate-float opacity-70 shadow-[0_0_20px_rgba(220,38,38,0.3)]" />
      <div className="absolute top-[30%] left-[80%] w-8 h-8 rounded-full bg-gradient-to-br from-blue-900 to-cyan-800 animate-float-slow opacity-60 shadow-[0_0_15px_rgba(8,145,178,0.3)]" style={{ animationDelay: '3s' }} />
    </div>
  );
};

export default FloatingObjects;
