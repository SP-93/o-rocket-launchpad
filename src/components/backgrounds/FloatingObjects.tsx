const FloatingObjects = () => {
  return (
    <div className="fixed inset-0 z-[3] pointer-events-none overflow-hidden">
      {/* Saturn with Rings - scaled for mobile */}
      <div className="absolute top-[8%] right-[8%] animate-float-slow" style={{ animationDuration: '25s' }}>
        <div className="relative scale-50 sm:scale-75 md:scale-100 origin-center">
          {/* Saturn body */}
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_60px_rgba(245,158,11,0.4)]">
            {/* Planet bands */}
            <div className="absolute top-[30%] left-0 right-0 h-2 bg-amber-600/40 rounded-full" />
            <div className="absolute top-[50%] left-0 right-0 h-3 bg-amber-800/30 rounded-full" />
            <div className="absolute top-[70%] left-0 right-0 h-1 bg-amber-600/30 rounded-full" />
          </div>
          {/* Saturn rings */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-10 border-4 border-amber-300/40 rounded-full transform rotate-[20deg]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-12 border-2 border-amber-200/30 rounded-full transform rotate-[20deg]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-14 border border-amber-100/20 rounded-full transform rotate-[20deg]" />
        </div>
      </div>

      {/* Earth-like Planet - scaled for mobile */}
      <div className="absolute bottom-[15%] left-[5%] animate-float" style={{ animationDuration: '20s' }}>
        <div className="relative w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16">
          <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 via-blue-600 to-blue-800 shadow-[0_0_40px_rgba(59,130,246,0.5)]">
            {/* Continent shapes */}
            <div className="absolute top-[20%] left-[30%] w-3 h-2 sm:w-4 sm:h-3 md:w-5 md:h-4 bg-green-500/60 rounded-full blur-[1px] transform rotate-12" />
            <div className="absolute top-[50%] left-[50%] w-2 h-2 sm:w-3 sm:h-2 md:w-4 md:h-3 bg-green-600/50 rounded-full blur-[1px]" />
            <div className="absolute top-[35%] right-[20%] w-2 h-1 sm:w-2 sm:h-2 md:w-3 md:h-2 bg-green-500/40 rounded-full blur-[1px]" />
          </div>
          {/* Atmosphere glow */}
          <div className="absolute inset-0 rounded-full bg-blue-400/20 blur-md scale-110" />
        </div>
      </div>

      {/* Mars - scaled for mobile */}
      <div className="absolute top-[45%] right-[3%] animate-float-slow" style={{ animationDuration: '18s', animationDelay: '5s' }}>
        <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-red-400 via-red-600 to-red-900 shadow-[0_0_30px_rgba(239,68,68,0.4)]">
          {/* Mars surface details */}
          <div className="absolute top-[40%] left-[30%] w-2 h-1 sm:w-2 sm:h-2 md:w-3 md:h-2 bg-red-800/50 rounded-full" />
          <div className="absolute top-[60%] left-[50%] w-1 h-1 sm:w-2 sm:h-2 bg-red-900/40 rounded-full" />
        </div>
      </div>

      {/* Neptune/Ice Giant - hidden on mobile, scaled on tablet */}
      <div className="hidden sm:block absolute top-[65%] left-[80%] animate-float" style={{ animationDuration: '22s', animationDelay: '3s' }}>
        <div className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-cyan-300 via-blue-500 to-indigo-700 shadow-[0_0_25px_rgba(6,182,212,0.5)]">
          <div className="absolute top-[30%] left-0 right-0 h-1 bg-cyan-200/30 rounded-full" />
        </div>
      </div>

      {/* Moon - scaled for mobile */}
      <div className="absolute top-[25%] left-[15%] w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-gray-200 via-gray-300 to-gray-500 shadow-[0_0_50px_rgba(255,255,255,0.2)] animate-float-slow" style={{ animationDuration: '30s' }}>
        {/* Moon craters */}
        <div className="absolute top-[20%] left-[30%] w-2 h-2 sm:w-2 sm:h-2 md:w-3 md:h-3 rounded-full bg-gray-500/40" />
        <div className="absolute top-[55%] left-[45%] w-2 h-2 sm:w-3 sm:h-3 md:w-4 md:h-4 rounded-full bg-gray-500/30" />
        <div className="absolute top-[35%] left-[65%] w-1 h-1 sm:w-2 sm:h-2 rounded-full bg-gray-500/35" />
        <div className="absolute top-[70%] left-[25%] w-1 h-1 sm:w-2 sm:h-2 rounded-full bg-gray-500/25" />
      </div>

      {/* Modern Spaceship - hidden on mobile */}
      <div className="hidden md:block absolute top-[30%] animate-fly-through" style={{ animationDuration: '25s', animationDelay: '2s' }}>
        <svg width="70" height="35" viewBox="0 0 70 35" className="drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]">
          {/* Main body */}
          <ellipse cx="35" cy="17" rx="30" ry="10" fill="url(#shipBodyGradient)" />
          {/* Cockpit */}
          <ellipse cx="50" cy="15" rx="10" ry="6" fill="url(#cockpitGradient)" opacity="0.9" />
          {/* Wing top */}
          <path d="M20,10 L30,5 L40,10" fill="#1e40af" opacity="0.8" />
          {/* Wing bottom */}
          <path d="M20,24 L30,29 L40,24" fill="#1e40af" opacity="0.8" />
          {/* Engine glow */}
          <ellipse cx="8" cy="17" rx="4" ry="3" fill="#3b82f6">
            <animate attributeName="opacity" values="0.5;1;0.5" dur="0.3s" repeatCount="indefinite" />
          </ellipse>
          <defs>
            <linearGradient id="shipBodyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
            <linearGradient id="cockpitGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </svg>
        {/* Engine trail */}
        <div className="absolute -left-8 top-1/2 transform -translate-y-1/2">
          <div className="w-16 h-1 bg-gradient-to-l from-blue-400 via-cyan-400/50 to-transparent blur-sm animate-pulse" />
          <div className="w-12 h-1 bg-gradient-to-l from-blue-500 via-blue-400/30 to-transparent blur-sm mt-1" />
        </div>
      </div>

      {/* UFO with beam - hidden on mobile */}
      <div className="hidden md:block absolute top-[55%] animate-zigzag" style={{ animationDuration: '30s', animationDelay: '8s' }}>
        <div className="relative">
          <svg width="60" height="45" viewBox="0 0 60 45" className="drop-shadow-[0_0_15px_rgba(139,92,246,0.7)]">
            {/* UFO dome */}
            <ellipse cx="30" cy="15" rx="12" ry="10" fill="url(#ufoDomeGradient)" opacity="0.9" />
            {/* UFO base */}
            <ellipse cx="30" cy="22" rx="25" ry="7" fill="url(#ufoBaseGradient)" />
            {/* Lights */}
            <circle cx="15" cy="22" r="2" fill="#a78bfa">
              <animate attributeName="opacity" values="1;0.3;1" dur="0.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="30" cy="24" r="2" fill="#c4b5fd">
              <animate attributeName="opacity" values="0.3;1;0.3" dur="0.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="45" cy="22" r="2" fill="#a78bfa">
              <animate attributeName="opacity" values="1;0.3;1" dur="0.5s" repeatCount="indefinite" begin="0.25s" />
            </circle>
            {/* Tractor beam */}
            <path d="M20,29 L15,45 L45,45 L40,29" fill="url(#beamGradient)" opacity="0.3" />
            <defs>
              <linearGradient id="ufoDomeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#c4b5fd" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
              <linearGradient id="ufoBaseGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#5b21b6" />
              </linearGradient>
              <linearGradient id="beamGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="transparent" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Comet with detailed tail - hidden on mobile */}
      <div className="hidden sm:block absolute animate-comet" style={{ animationDuration: '15s', animationDelay: '5s' }}>
        <div className="relative">
          {/* Comet core */}
          <div className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 bg-gradient-radial from-white via-cyan-200 to-blue-400 rounded-full shadow-[0_0_30px_rgba(255,255,255,0.8)]" />
          {/* Comet tail layers */}
          <div className="absolute top-1/2 left-1/2 transform -translate-y-1/2">
            <div className="w-[100px] sm:w-[140px] md:w-[180px] h-[3px] md:h-[4px] bg-gradient-to-r from-white/90 via-cyan-300/60 to-transparent blur-sm" />
            <div className="w-[70px] sm:w-[100px] md:w-[140px] h-[2px] md:h-[3px] bg-gradient-to-r from-cyan-200/70 via-blue-400/40 to-transparent blur-sm -mt-1" />
            <div className="w-[50px] sm:w-[70px] md:w-[100px] h-[1px] md:h-[2px] bg-gradient-to-r from-blue-300/50 via-purple-400/30 to-transparent blur-sm -mt-1" />
          </div>
        </div>
      </div>

      {/* Small asteroid belt particles - reduced on mobile */}
      <div className="hidden sm:block absolute top-[75%] left-[25%] w-2 h-2 md:w-3 md:h-3 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 animate-float opacity-60" style={{ animationDuration: '12s' }} />
      <div className="hidden md:block absolute top-[78%] left-[30%] w-2 h-2 rounded-full bg-gradient-to-br from-gray-500 to-gray-700 animate-float opacity-50" style={{ animationDuration: '10s', animationDelay: '2s' }} />
      <div className="hidden md:block absolute top-[72%] left-[35%] w-2 h-1 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 animate-float opacity-40" style={{ animationDuration: '14s', animationDelay: '4s' }} />
      
      {/* Distant stars/galaxies */}
      <div className="absolute top-[15%] left-[45%] w-1 h-1 bg-blue-300 rounded-full animate-twinkle shadow-[0_0_10px_rgba(147,197,253,0.8)]" />
      <div className="absolute top-[40%] left-[70%] w-1 h-1 bg-purple-300 rounded-full animate-twinkle-slow shadow-[0_0_8px_rgba(196,181,253,0.6)]" style={{ animationDelay: '1s' }} />
    </div>
  );
};

export default FloatingObjects;
