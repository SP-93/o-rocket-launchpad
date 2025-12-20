import { useState } from "react";
import { FileText, Download, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

const WhitepaperSection = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let y = 20;

      const addTitle = (text: string, size: number = 20) => {
        pdf.setFontSize(size);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 100, 50);
        pdf.text(text, margin, y);
        y += size * 0.5;
      };

      const addSection = (title: string) => {
        if (y > 260) { pdf.addPage(); y = 20; }
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(50, 50, 50);
        pdf.text(title, margin, y);
        y += 8;
      };

      const addText = (text: string) => {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(80, 80, 80);
        const lines = pdf.splitTextToSize(text, maxWidth);
        lines.forEach((line: string) => {
          if (y > 280) { pdf.addPage(); y = 20; }
          pdf.text(line, margin, y);
          y += 5;
        });
        y += 3;
      };

      const addBullet = (text: string) => {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(80, 80, 80);
        const lines = pdf.splitTextToSize(`• ${text}`, maxWidth - 5);
        lines.forEach((line: string, i: number) => {
          if (y > 280) { pdf.addPage(); y = 20; }
          pdf.text(i === 0 ? line : `  ${line}`, margin, y);
          y += 5;
        });
      };

      // Title
      addTitle("O'ROCKET Whitepaper v1.0", 24);
      y += 5;
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Decentralized Exchange & Token Launchpad on Over Protocol", margin, y);
      y += 15;

      // 1. Introduction
      addSection("1. Introduction");
      addText("O'ROCKET is a decentralized exchange (DEX) and token launchpad ecosystem built natively on the Over Protocol blockchain. Our mission is to provide a seamless, secure, and community-driven platform for token creation, trading, and liquidity provision.");
      addText("The platform consists of two core products: a Uniswap V3-style DEX with concentrated liquidity, and Rocket.fun - a fair-launch token creation platform designed specifically for the Over Protocol ecosystem.");
      y += 5;

      // 2. Problem & Solution
      addSection("2. Problem & Solution");
      addText("The Problem:");
      addBullet("Over Protocol lacks native DeFi infrastructure for efficient token swaps");
      addBullet("No fair-launch platform exists for community-driven token creation");
      addBullet("Token launches often favor insiders over community members");
      y += 3;
      addText("Our Solution:");
      addBullet("Native DEX with concentrated liquidity for capital-efficient trading");
      addBullet("Rocket.fun provides fair, transparent token launches with bonding curves");
      addBullet("Community-first approach with sustainable tokenomics");
      y += 5;

      // 3. Technology Stack
      addSection("3. Technology Stack");
      addBullet("Blockchain: Over Protocol (EVM-compatible)");
      addBullet("Smart Contracts: Uniswap V3 Core, Rocket.fun bonding curves");
      addBullet("Frontend: React + TypeScript, Ethers.js, Web3Modal");
      addBullet("Security: Audited contracts, Multi-sig treasury");
      y += 5;

      // 4. ROCKET Tokenomics
      addSection("4. ROCKET Tokenomics");
      addText("Total Supply: 1,000,000,000 ROCKET (1 Billion)");
      addBullet("Presale (OVER/WOVER + USDT): 250M (25%)");
      addBullet("Initial Liquidity: 150M (15%)");
      addBullet("Farm Rewards (10 Years): 600M (60%)");
      y += 3;
      addText("Deflationary Mechanism: 10% of farm rewards (60M ROCKET) will be burned over the 10-year farming period.");
      y += 5;

      // 5. Rocket.fun Launchpad
      addSection("5. Rocket.fun Launchpad");
      addText("For Token Creators:");
      addBullet("Supply Options: 150M, 250M, 500M, 750M, or 1B tokens");
      addBullet("Creation Fee: Fixed fee in OVER");
      addBullet("DEX Migration: Auto-migrates when 80% sold");
      addBullet("Creator Royalties: 50% of DEX trading fee");
      addBullet("Monthly Payouts: Royalties sent to your wallet");
      y += 3;
      addText("For Traders:");
      addBullet("Bonding Curve Trading: 1.25% fee");
      addBullet("DEX Trading: 1% fee after migration");
      y += 5;

      // 6. Future Development
      addSection("6. Future Development");
      addBullet("Base Bridge Integration (expected end of 2026)");
      addBullet("Arbitrage Bots for advanced traders");
      addBullet("Governance voting for ROCKET holders");
      addBullet("Official ROCKET/USDC pool");
      y += 5;

      // 7. Disclaimer
      addSection("7. Disclaimer");
      addText("This document is for informational purposes only and does not constitute financial advice. Cryptocurrency investments carry significant risk. DYOR before making any investment decisions.");

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text("© 2025 O'ROCKET - Built on Over Protocol", margin, 290);

      pdf.save("OROCKET-Whitepaper-v1.0.pdf");
      
      toast({
        title: "PDF Downloaded",
        description: "Whitepaper has been saved to your device.",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Download Failed",
        description: "Could not generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link Copied",
      description: "Whitepaper link copied to clipboard.",
    });
  };
  return <div className="space-y-8">
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
          <Button size="sm" onClick={generatePDF} disabled={isGenerating} className="btn-primary">
            {isGenerating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {isGenerating ? "Generating..." : "Download PDF"}
          </Button>
        </div>
      </div>

      {/* Table of Contents */}
      

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
              Rocket.fun is a fair-launch token creation platform where anyone can create and launch tokens with transparent bonding curve mechanics. No coding required - just creativity and a vision.
            </p>
            
            <div>
              <h4 className="text-foreground font-medium mb-2">🚀 For Token Creators</h4>
              <ul className="list-disc list-inside space-y-2">
                <li><strong className="text-foreground">Supply Options:</strong> Choose from 150M, 250M, 500M, 750M, or 1B tokens</li>
                <li><strong className="text-foreground">Creation Fee:</strong> Fixed fee in OVER to launch your token</li>
                <li><strong className="text-foreground">Bonding Curve:</strong> Price automatically increases as demand grows</li>
                <li><strong className="text-foreground">DEX Migration:</strong> When 80% of tokens are sold, liquidity is automatically migrated to O'ROCKET DEX</li>
                <li><strong className="text-foreground">Creator Royalties:</strong> Earn 50% of the DEX trading fee from your token's pool</li>
                <li><strong className="text-foreground">Monthly Payouts:</strong> Royalties sent directly to your wallet every month</li>
              </ul>
            </div>

            <div>
              <h4 className="text-foreground font-medium mb-2">💰 For Traders</h4>
              <ul className="list-disc list-inside space-y-2">
                <li><strong className="text-foreground">Bonding Curve Trading:</strong> 1.25% fee per trade during launch phase</li>
                <li><strong className="text-foreground">DEX Trading:</strong> 1% fee after migration to the DEX</li>
                <li><strong className="text-foreground">Fair Launch:</strong> Everyone buys at the same bonding curve - no insider advantage</li>
              </ul>
            </div>

            <div>
              <h4 className="text-foreground font-medium mb-2">📊 Fee Structure</h4>
              <div className="space-y-3 mt-3">
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                  <span>Bonding Curve Phase</span>
                  <span className="font-semibold text-primary">1.25% per trade</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                  <span>DEX Trading (after migration)</span>
                  <span className="font-semibold text-primary">1% per trade</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-success/10 rounded-lg">
                  <span>Creator Share (DEX)</span>
                  <span className="font-semibold text-success">50% of trading fee</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-warning/10 rounded-lg">
                  <span>Platform Share (DEX)</span>
                  <span className="font-semibold text-warning">50% of trading fee</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-foreground font-medium mb-2">🔄 How Migration Works</h4>
              <ol className="list-decimal list-inside space-y-2">
                <li>Creator launches token with bonding curve</li>
                <li>Traders buy tokens, price increases with each purchase</li>
                <li>When 80% of supply is sold, admin initiates DEX migration</li>
                <li>Remaining tokens + raised OVER form initial liquidity pool</li>
                <li>Platform holds LP position and collects fees for creator royalties</li>
                <li>Creators receive 50% of trading fees monthly</li>
              </ol>
            </div>

            <div className="mt-4 p-4 border border-primary/30 rounded-lg bg-primary/5">
              <h4 className="text-foreground font-medium mb-2">💡 Why Rocket.fun?</h4>
              <p>Unlike other launchpads, Rocket.fun provides ongoing passive income for creators through trading fee royalties. Your token's success is your success - the more it trades, the more you earn.</p>
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
                <a href="https://x.com/SteeWee_93" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm flex items-center gap-1">
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
    </div>;
};
export default WhitepaperSection;