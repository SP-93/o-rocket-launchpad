import { FileText, Download, ExternalLink, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const WhitepaperSection = () => {
  const handleDownload = () => {
    // Placeholder - PDF will be added later
    window.open('/docs/orocket-whitepaper.pdf', '_blank');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-primary" />
          <h2 className="text-2xl md:text-3xl font-bold gradient-text">O'ROCKET Whitepaper v1.0</h2>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={handleShare}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button size="sm" onClick={handleDownload} className="btn-primary">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Table of Contents */}
      <div className="glass-card p-6 rounded-xl border border-primary/20">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Table of Contents</h3>
        <nav className="space-y-2 text-muted-foreground">
          <a href="#introduction" className="block hover:text-primary transition-colors">1. Introduction</a>
          <a href="#problem" className="block hover:text-primary transition-colors">2. Problem & Solution</a>
          <a href="#technology" className="block hover:text-primary transition-colors">3. Technology Stack</a>
          <a href="#tokenomics" className="block hover:text-primary transition-colors">4. ROCKET Tokenomics</a>
          <a href="#rocket-fun" className="block hover:text-primary transition-colors">5. Rocket.fun Launchpad</a>
          <a href="#future" className="block hover:text-primary transition-colors">6. Future Development</a>
          <a href="#team" className="block hover:text-primary transition-colors">7. Team</a>
          <a href="#disclaimer" className="block hover:text-primary transition-colors">8. Disclaimer</a>
        </nav>
      </div>

      {/* Whitepaper Content */}
      <Accordion type="multiple" className="space-y-4">
        <AccordionItem value="introduction" id="introduction" className="glass-card border border-primary/20 rounded-xl px-6">
          <AccordionTrigger className="text-lg font-semibold hover:text-primary">
            1. Introduction
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed space-y-4 pb-6">
            <p>
              O'ROCKET is a decentralized exchange (DEX) and token launchpad ecosystem built natively on the Over Protocol blockchain. Our mission is to provide a seamless, secure, and community-driven platform for token creation, trading, and liquidity provision.
            </p>
            <p>
              The platform consists of two core products: a Uniswap V3-style DEX with concentrated liquidity, and Rocket.fun - a fair-launch token creation platform inspired by pump.fun mechanics but designed specifically for the Over Protocol ecosystem.
            </p>
            <p>
              ROCKET is the native utility token powering the entire O'ROCKET ecosystem, serving as the primary incentive mechanism for liquidity providers, governance participants, and platform users.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="problem" id="problem" className="glass-card border border-primary/20 rounded-xl px-6">
          <AccordionTrigger className="text-lg font-semibold hover:text-primary">
            2. Problem & Solution
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed space-y-4 pb-6">
            <div>
              <h4 className="text-foreground font-medium mb-2">The Problem</h4>
              <ul className="list-disc list-inside space-y-2">
                <li>Over Protocol lacks native DeFi infrastructure for efficient token swaps</li>
                <li>No fair-launch platform exists for community-driven token creation</li>
                <li>Existing DEX solutions on other chains don't leverage Over's unique capabilities</li>
                <li>Token launches often favor insiders over community members</li>
              </ul>
            </div>
            <div>
              <h4 className="text-foreground font-medium mb-2">Our Solution</h4>
              <ul className="list-disc list-inside space-y-2">
                <li>Native DEX with concentrated liquidity for capital-efficient trading</li>
                <li>Rocket.fun provides fair, transparent token launches with bonding curves</li>
                <li>Built specifically for Over Protocol with optimized gas costs</li>
                <li>Community-first approach with sustainable tokenomics</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="technology" id="technology" className="glass-card border border-primary/20 rounded-xl px-6">
          <AccordionTrigger className="text-lg font-semibold hover:text-primary">
            3. Technology Stack
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed space-y-4 pb-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-foreground font-medium mb-2">Blockchain</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Over Protocol (EVM-compatible)</li>
                  <li>Future: Base integration via bridge</li>
                </ul>
              </div>
              <div>
                <h4 className="text-foreground font-medium mb-2">Smart Contracts</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Uniswap V3 Core (concentrated liquidity)</li>
                  <li>Custom Rocket.fun bonding curve contracts</li>
                  <li>Staking & farming contracts</li>
                </ul>
              </div>
              <div>
                <h4 className="text-foreground font-medium mb-2">Frontend</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>React + TypeScript</li>
                  <li>Ethers.js for blockchain interaction</li>
                  <li>Web3Modal for wallet connectivity</li>
                </ul>
              </div>
              <div>
                <h4 className="text-foreground font-medium mb-2">Security</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Audited Uniswap V3 contracts</li>
                  <li>Multi-sig treasury management</li>
                  <li>Transparent on-chain operations</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="tokenomics" id="tokenomics" className="glass-card border border-primary/20 rounded-xl px-6">
          <AccordionTrigger className="text-lg font-semibold hover:text-primary">
            4. ROCKET Tokenomics
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed space-y-4 pb-6">
            <p><strong className="text-foreground">Total Supply:</strong> 1,000,000,000 ROCKET (1 Billion)</p>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                <span>Presale (OVER/WOVER + USDT)</span>
                <span className="font-semibold text-primary">250M (25%)</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                <span>Initial Liquidity</span>
                <span className="font-semibold text-primary">150M (15%)</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                <span>Farm Rewards (10 Years)</span>
                <span className="font-semibold text-primary">600M (60%)</span>
              </div>
            </div>

            <div className="mt-4 p-4 border border-warning/30 rounded-lg bg-warning/5">
              <h4 className="text-foreground font-medium mb-2">🔥 Deflationary Mechanism</h4>
              <p>10% of farm rewards (60M ROCKET) will be burned over the 10-year farming period, reducing circulating supply and increasing scarcity.</p>
            </div>

            <div className="mt-4">
              <h4 className="text-foreground font-medium mb-2">Farm Distribution (600M over 10 years)</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Annual emission: 54M ROCKET (after 10% burn)</li>
                <li>75% to LP stakers (405M total)</li>
                <li>25% to platform development (135M total)</li>
                <li>Pools: ROCKET/USDT LP, ROCKET/USDC LP (pending official pool)</li>
              </ul>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="rocket-fun" id="rocket-fun" className="glass-card border border-primary/20 rounded-xl px-6">
          <AccordionTrigger className="text-lg font-semibold hover:text-primary">
            5. Rocket.fun Launchpad
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed space-y-4 pb-6">
            <p>
              Rocket.fun is a fair-launch token creation platform where anyone can create and launch tokens with transparent bonding curve mechanics.
            </p>
            
            <div>
              <h4 className="text-foreground font-medium mb-2">How It Works</h4>
              <ol className="list-decimal list-inside space-y-2">
                <li>Create a token with custom name, symbol, and metadata</li>
                <li>Token launches with a bonding curve - price increases with demand</li>
                <li>When market cap reaches threshold, liquidity is automatically migrated to the DEX</li>
                <li>LP tokens are burned, ensuring permanent liquidity</li>
              </ol>
            </div>

            <div>
              <h4 className="text-foreground font-medium mb-2">Fee Structure</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>Token creation: Small fixed fee in OVER</li>
                <li>Trading fee: 1% of each trade</li>
                <li>Fee allocation: Buyback ROCKET, platform development, liquidity</li>
              </ul>
            </div>

            <div>
              <h4 className="text-foreground font-medium mb-2">ROCKET Token Integration</h4>
              <p>Fees from Rocket.fun fuel the ROCKET ecosystem through strategic buybacks, adding buy pressure and supporting the token's long-term value.</p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="future" id="future" className="glass-card border border-primary/20 rounded-xl px-6">
          <AccordionTrigger className="text-lg font-semibold hover:text-primary">
            6. Future Development
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed space-y-4 pb-6">
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="text-primary">🌉</span>
                <div>
                  <strong className="text-foreground">Base Bridge Integration</strong>
                  <p>Pending Over Protocol's bridge to Base network. Expected by end of 2026.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary">🤖</span>
                <div>
                  <strong className="text-foreground">Arbitrage Bots</strong>
                  <p>Automated market making and arbitrage tools for advanced traders.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary">🏛️</span>
                <div>
                  <strong className="text-foreground">Governance</strong>
                  <p>ROCKET holders will be able to vote on platform upgrades and fee parameters.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary">💱</span>
                <div>
                  <strong className="text-foreground">USDC Pool</strong>
                  <p>Official ROCKET/USDC pool pending Over Protocol's native USDC integration.</p>
                </div>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="team" id="team" className="glass-card border border-primary/20 rounded-xl px-6">
          <AccordionTrigger className="text-lg font-semibold hover:text-primary">
            7. Team
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed space-y-4 pb-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="text-foreground font-medium mb-1">Over Hippo</h4>
                <p className="text-sm text-muted-foreground mb-2">Founder & Lead Developer</p>
                <a 
                  href="https://x.com/SteeWee_93" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  @SteeWee_93
                </a>
              </div>
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="text-foreground font-medium mb-1">AI Assistant</h4>
                <p className="text-sm text-muted-foreground">Development Partner</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="disclaimer" id="disclaimer" className="glass-card border border-primary/20 rounded-xl px-6">
          <AccordionTrigger className="text-lg font-semibold hover:text-primary">
            8. Disclaimer
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed space-y-4 pb-6">
            <p className="text-warning">
              ⚠️ This document is for informational purposes only and does not constitute financial advice.
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>Cryptocurrency investments carry significant risk. You may lose some or all of your investment.</li>
              <li>Past performance does not guarantee future results.</li>
              <li>Do Your Own Research (DYOR) before making any investment decisions.</li>
              <li>The roadmap is subject to change based on market conditions, partnerships, and technical requirements.</li>
              <li>Some features are dependent on Over Protocol ecosystem developments (bridge to Base, official USDC pool).</li>
              <li>O'ROCKET team makes no guarantees regarding token price, returns, or platform performance.</li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default WhitepaperSection;
