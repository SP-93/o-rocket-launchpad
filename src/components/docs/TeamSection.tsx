import { Users, ExternalLink, Twitter } from "lucide-react";

const TeamSection = () => {
  const team = [
    {
      name: "Over Hippo",
      role: "Founder & Lead Developer",
      description: "Visionary behind O'ROCKET ecosystem. Building the future of DeFi on Over Protocol.",
      twitter: "https://x.com/SteeWee_93",
      twitterHandle: "@SteeWee_93",
    },
    {
      name: "AI Assistant",
      role: "Development Partner",
      description: "AI-powered development support for smart contracts, frontend, and documentation.",
      twitter: null,
      twitterHandle: null,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="w-8 h-8 text-primary" />
        <h2 className="text-2xl md:text-3xl font-bold gradient-text">Team</h2>
      </div>

      {/* Team Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {team.map((member, index) => (
          <div
            key={index}
            className="glass-card p-6 rounded-xl border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:transform hover:scale-[1.02]"
          >
            {/* Avatar Placeholder */}
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4 mx-auto">
              <span className="text-3xl font-bold text-primary-foreground">
                {member.name.charAt(0)}
              </span>
            </div>

            {/* Info */}
            <div className="text-center">
              <h3 className="text-xl font-bold text-foreground mb-1">{member.name}</h3>
              <p className="text-primary font-medium mb-3">{member.role}</p>
              <p className="text-muted-foreground text-sm mb-4">{member.description}</p>

              {/* Social Links */}
              {member.twitter && (
                <a
                  href={member.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
                >
                  <Twitter className="w-4 h-4" />
                  <span>{member.twitterHandle}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Community Note */}
      <div className="glass-card p-6 rounded-xl border border-primary/20 text-center">
        <h3 className="text-lg font-semibold mb-2 text-foreground">Join Our Community</h3>
        <p className="text-muted-foreground mb-4">
          Follow us on X (Twitter) for the latest updates, announcements, and community discussions.
        </p>
        <a
          href="https://x.com/SteeWee_93"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 btn-primary px-6 py-2 rounded-lg text-sm font-medium"
        >
          <Twitter className="w-4 h-4" />
          Follow @SteeWee_93
        </a>
      </div>
    </div>
  );
};

export default TeamSection;
