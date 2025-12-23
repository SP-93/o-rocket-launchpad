import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LeaderboardEntry {
  wallet_address: string;
  display_address: string;
  total_winnings: number;
  games_won: number;
  biggest_win: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  stats: {
    total_rounds: number;
    average_crash_point: number;
    total_payouts: number;
  };
}

const Leaderboard = () => {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await supabase.functions.invoke('game-leaderboard', {
          body: {},
        });

        if (response.data) {
          setData(response.data);
        }
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center text-muted-foreground">{rank}</span>;
    }
  };

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="w-5 h-5 text-warning" />
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !data || data.leaderboard.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No winners yet. Be the first!
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {data.leaderboard.slice(0, 10).map((entry, index) => (
                <div
                  key={entry.wallet_address}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    index < 3 ? 'bg-primary/10' : 'bg-background/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {getRankIcon(index + 1)}
                    <span className="font-mono text-sm">{entry.display_address}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-success">
                      {entry.total_winnings.toLocaleString()} WOVER
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {entry.games_won} wins
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {data.stats && (
              <div className="mt-4 pt-4 border-t border-primary/10 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-primary">
                    {data.stats.total_rounds}
                  </div>
                  <div className="text-xs text-muted-foreground">Rounds</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-warning">
                    {data.stats.average_crash_point}x
                  </div>
                  <div className="text-xs text-muted-foreground">Avg Crash</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-success">
                    {data.stats.total_payouts.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">WOVER Won</div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default Leaderboard;
