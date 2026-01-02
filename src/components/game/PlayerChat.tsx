import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  wallet_address: string;
  message: string;
  created_at: string;
}

interface PlayerChatProps {
  walletAddress: string | undefined;
  isConnected: boolean;
  className?: string;
}

// Format wallet address for display
const formatAddress = (address: string) => {
  return `${address.slice(0, 4)}...${address.slice(-3)}`;
};

// Generate consistent color from wallet address
const getWalletColor = (address: string) => {
  const colors = [
    'text-orange-400',
    'text-blue-400', 
    'text-green-400',
    'text-pink-400',
    'text-yellow-400',
    'text-purple-400',
    'text-cyan-400',
  ];
  const hash = address.toLowerCase().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

const PlayerChat = ({ walletAddress, isConnected, className }: PlayerChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Spam protection: 3 seconds between messages
  const SPAM_COOLDOWN = 3000;
  const MAX_LENGTH = 80;

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('game_chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setMessages(data.reverse());
      }
    };

    fetchMessages();
  }, []);

  // Subscribe to realtime messages
  useEffect(() => {
    const channel = supabase
      .channel('game-chat')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_chat_messages'
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMsg.id)) return prev;
            // Keep only last 50 messages
            const updated = [...prev, newMsg];
            if (updated.length > 50) updated.shift();
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isExpanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  const handleSend = useCallback(async () => {
    if (!walletAddress || !newMessage.trim() || isSending) return;

    // Spam protection
    const now = Date.now();
    if (now - lastSentAt < SPAM_COOLDOWN) {
      toast.error(`Wait ${Math.ceil((SPAM_COOLDOWN - (now - lastSentAt)) / 1000)}s before sending`);
      return;
    }

    const messageText = newMessage.trim().slice(0, MAX_LENGTH);
    if (!messageText) return;

    setIsSending(true);
    setNewMessage('');

    try {
      const { error } = await supabase
        .from('game_chat_messages')
        .insert({
          wallet_address: walletAddress,
          message: messageText
        });

      if (error) throw error;
      setLastSentAt(Date.now());
    } catch (error: any) {
      toast.error('Failed to send message');
      setNewMessage(messageText); // Restore message
    } finally {
      setIsSending(false);
    }
  }, [walletAddress, newMessage, isSending, lastSentAt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Collapsed state - just show chat icon with message count
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg",
          "bg-card/80 backdrop-blur border border-border/50",
          "hover:bg-card hover:border-primary/30 transition-all",
          className
        )}
      >
        <MessageCircle className="w-4 h-4 text-primary" />
        <span className="text-xs font-medium">Chat</span>
        {messages.length > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] bg-primary/20 text-primary rounded-full">
            {messages.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={cn(
      "flex flex-col bg-card/90 backdrop-blur rounded-lg border border-border/50",
      "w-full max-w-sm h-[280px] md:h-[320px]",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Live Chat</span>
          <span className="text-[10px] text-muted-foreground">({messages.length})</span>
        </div>
        <button 
          onClick={() => setIsExpanded(false)}
          className="p-1 hover:bg-muted/50 rounded transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 text-xs">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            No messages yet. Be the first!
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = walletAddress?.toLowerCase() === msg.wallet_address.toLowerCase();
            return (
              <div 
                key={msg.id}
                className={cn(
                  "flex gap-1.5 break-words",
                  isOwn && "opacity-80"
                )}
              >
                <span className={cn("font-medium shrink-0", getWalletColor(msg.wallet_address))}>
                  {formatAddress(msg.wallet_address)}:
                </span>
                <span className="text-foreground/90">{msg.message}</span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-border/30">
        {isConnected ? (
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value.slice(0, MAX_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="h-8 text-xs bg-background/50"
              disabled={isSending}
              maxLength={MAX_LENGTH}
            />
            <Button 
              size="sm" 
              onClick={handleSend}
              disabled={isSending || !newMessage.trim()}
              className="h-8 px-2"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-1">
            Connect wallet to chat
          </p>
        )}
      </div>
    </div>
  );
};

export default PlayerChat;
