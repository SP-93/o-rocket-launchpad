import { AlertTriangle, Shield, Info, Scale } from "lucide-react";

const DisclaimerSection = () => {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Scale className="w-8 h-8 text-warning" />
        <h2 className="text-2xl md:text-3xl font-bold text-warning">Legal Disclaimer</h2>
      </div>

      {/* Main Warning */}
      <div className="glass-card p-6 rounded-xl border border-warning/30 bg-warning/5">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-8 h-8 text-warning flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-warning mb-2">Important Notice</h3>
            <p className="text-foreground">
              This website and all associated documentation are provided for informational purposes only and do not constitute financial, investment, legal, or tax advice. The information presented should not be construed as a recommendation to buy, sell, or hold any cryptocurrency or digital asset.
            </p>
          </div>
        </div>
      </div>

      {/* Risk Warnings */}
      <div className="glass-card p-6 rounded-xl border border-destructive/30 bg-destructive/5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-destructive" />
          <h3 className="text-lg font-semibold text-destructive">Risk Warnings</h3>
        </div>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-1">•</span>
            <span><strong className="text-foreground">Loss of Capital:</strong> Cryptocurrency investments are highly volatile. You may lose some or all of your invested capital. Only invest what you can afford to lose.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-1">•</span>
            <span><strong className="text-foreground">No Guarantees:</strong> Past performance is not indicative of future results. There are no guarantees regarding token price, returns, or platform performance.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-1">•</span>
            <span><strong className="text-foreground">Smart Contract Risk:</strong> Despite security measures, smart contracts may contain vulnerabilities. Use at your own risk.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-1">•</span>
            <span><strong className="text-foreground">Regulatory Risk:</strong> Cryptocurrency regulations vary by jurisdiction and may change. Ensure compliance with your local laws.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-1">•</span>
            <span><strong className="text-foreground">Technology Risk:</strong> Blockchain technology is still evolving. Network issues, bugs, or exploits may occur.</span>
          </li>
        </ul>
      </div>

      {/* DYOR */}
      <div className="glass-card p-6 rounded-xl border border-primary/20">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Do Your Own Research (DYOR)</h3>
        </div>
        <p className="text-muted-foreground mb-4">
          Before participating in any cryptocurrency project, including O'ROCKET, we strongly encourage you to:
        </p>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">✓</span>
            <span>Research the project thoroughly, including the team, technology, and tokenomics</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">✓</span>
            <span>Understand the risks involved in cryptocurrency investments</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">✓</span>
            <span>Consult with qualified financial and legal advisors</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">✓</span>
            <span>Never invest more than you can afford to lose</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">✓</span>
            <span>Verify all information from multiple sources</span>
          </li>
        </ul>
      </div>

      {/* Roadmap Flexibility */}
      <div className="glass-card p-6 rounded-xl border border-warning/20 bg-warning/5">
        <h3 className="text-lg font-semibold text-foreground mb-3">Roadmap & Development</h3>
        <p className="text-muted-foreground mb-3">
          The roadmap and development plans outlined in this documentation are subject to change based on:
        </p>
        <ul className="space-y-2 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-warning">•</span>
            <span>Market conditions and cryptocurrency ecosystem changes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-warning">•</span>
            <span>Technical requirements and development challenges</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-warning">•</span>
            <span>Partnership opportunities and strategic decisions</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-warning">•</span>
            <span>Dependencies on third-party infrastructure (e.g., Over Protocol bridge to Base)</span>
          </li>
        </ul>
      </div>

      {/* External Dependencies */}
      <div className="glass-card p-6 rounded-xl border border-primary/20">
        <h3 className="text-lg font-semibold text-foreground mb-3">External Dependencies</h3>
        <p className="text-muted-foreground">
          Certain features of the O'ROCKET platform are dependent on developments within the Over Protocol ecosystem. Specifically:
        </p>
        <ul className="mt-3 space-y-2 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span><strong className="text-foreground">Bridge to Base:</strong> Cross-chain functionality is pending Over Protocol's bridge implementation.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span><strong className="text-foreground">Official USDC Pool:</strong> ROCKET/USDC farming requires Over Protocol's native USDC integration.</span>
          </li>
        </ul>
      </div>

      {/* Rocket.fun Disclaimer */}
      <div className="glass-card p-6 rounded-xl border border-destructive/30 bg-destructive/5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h3 className="text-lg font-semibold text-destructive">Rocket.fun Token Disclaimer</h3>
        </div>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-1">•</span>
            <span><strong className="text-foreground">No Affiliation:</strong> Tokens created on Rocket.fun are NOT affiliated with, endorsed by, or created by the O'ROCKET team. Each token is created by independent third parties.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-1">•</span>
            <span><strong className="text-foreground">DYOR Required:</strong> Always Do Your Own Research before investing in any token launched on Rocket.fun. Verify the project, team, and use case independently.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-1">•</span>
            <span><strong className="text-foreground">Creator Royalties:</strong> Creator royalties depend on trading volume. Low volume tokens may generate minimal or no royalties.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-1">•</span>
            <span><strong className="text-foreground">No Refunds:</strong> Token creation fees are non-refundable. Migration fees are charged upon successful DEX deployment.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-destructive mt-1">•</span>
            <span><strong className="text-foreground">Scam Tokens:</strong> O'ROCKET is not responsible for scam tokens or rug pulls created by third parties on the platform.</span>
          </li>
        </ul>
      </div>

      {/* Final Statement */}
      <div className="text-center py-8 border-t border-primary/20">
        <p className="text-muted-foreground text-sm">
          By using the O'ROCKET platform, you acknowledge that you have read, understood, and agree to this disclaimer.
        </p>
        <p className="text-muted-foreground text-sm mt-2">
          © 2025 O'ROCKET. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default DisclaimerSection;
