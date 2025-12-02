const ShootingStars = () => {
  return (
    <div className="fixed inset-0 z-[2] pointer-events-none overflow-hidden">
      {/* Shooting Stars */}
      {[...Array(3)].map((_, i) => (
        <div
          key={`shooting-${i}`}
          className="absolute w-[2px] h-[100px] bg-gradient-to-b from-white via-cyan-300 to-transparent animate-shooting-star"
          style={{
            top: `${Math.random() * 50}%`,
            right: `${Math.random() * 100}%`,
            animationDelay: `${i * 8}s`,
            animationDuration: '3s',
          }}
        />
      ))}

      {/* Meteors */}
      {[...Array(2)].map((_, i) => (
        <div
          key={`meteor-${i}`}
          className="absolute animate-meteor"
          style={{
            top: `${Math.random() * 30}%`,
            right: `${Math.random() * 100}%`,
            animationDelay: `${i * 10 + 5}s`,
          }}
        >
          <div className="relative">
            {/* Meteor head */}
            <div className="w-3 h-3 bg-gradient-to-r from-orange-400 to-yellow-300 rounded-full shadow-[0_0_20px_rgba(251,191,36,0.8)]" />
            {/* Meteor tail */}
            <div className="absolute top-1/2 left-0 w-[100px] h-[2px] bg-gradient-to-r from-orange-400/80 to-transparent transform -translate-y-1/2 blur-sm" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ShootingStars;
