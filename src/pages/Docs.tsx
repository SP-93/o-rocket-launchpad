import { useState } from "react";
import { FileText, Coins, Map, Users, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SpaceBackground from "@/components/backgrounds/SpaceBackground";
import WhitepaperSection from "@/components/docs/WhitepaperSection";
import TokenomicsSection from "@/components/docs/TokenomicsSection";
import RoadmapSection from "@/components/docs/RoadmapSection";
import TeamSection from "@/components/docs/TeamSection";
import DisclaimerSection from "@/components/docs/DisclaimerSection";

const Docs = () => {
  const [activeTab, setActiveTab] = useState("whitepaper");

  const tabs = [
    { id: "whitepaper", label: "Whitepaper", icon: FileText },
    { id: "tokenomics", label: "Tokenomics", icon: Coins },
    { id: "roadmap", label: "Roadmap", icon: Map },
    { id: "team", label: "Team", icon: Users },
    { id: "disclaimer", label: "Disclaimer", icon: AlertTriangle },
  ];

  return (
    <SpaceBackground>
      <div className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold gradient-text mb-4">
              Documentation
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Everything you need to know about O'ROCKET DEX, ROCKET token, and the Rocket.fun launchpad.
            </p>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full flex flex-wrap justify-center gap-2 bg-transparent h-auto mb-8">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=inactive]:bg-card/50 data-[state=inactive]:text-muted-foreground border border-primary/20 data-[state=active]:border-primary transition-all"
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="glass-card p-6 md:p-8 rounded-2xl border border-primary/20">
              <TabsContent value="whitepaper" className="mt-0">
                <WhitepaperSection />
              </TabsContent>

              <TabsContent value="tokenomics" className="mt-0">
                <TokenomicsSection />
              </TabsContent>

              <TabsContent value="roadmap" className="mt-0">
                <RoadmapSection />
              </TabsContent>

              <TabsContent value="team" className="mt-0">
                <TeamSection />
              </TabsContent>

              <TabsContent value="disclaimer" className="mt-0">
                <DisclaimerSection />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </SpaceBackground>
  );
};

export default Docs;
