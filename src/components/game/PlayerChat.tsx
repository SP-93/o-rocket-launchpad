import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Send, MessageCircle, X, RefreshCw, User, Edit2 } from 'lucide-react';
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

interface ChatProfile {
  wallet_address: string;
  nickname: string;
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
  const [nicknames, setNicknames] = useState<Map<string, string>>(new Map());
  const [myNickname, setMyNickname] = useState<string | null>(null);
  const [showNicknameInput, setShowNicknameInput] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');
  const [isSettingNickname, setIsSettingNickname] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<Date | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Spam protection: 3 seconds between messages
  const SPAM_COOLDOWN = 3000;
  const MAX_LENGTH = 80;
  const POLLING_INTERVAL = 10000; // 10 seconds fallback polling
  const REALTIME_TIMEOUT = 20000; // 20 seconds before considering realtime dead

  // Fetch chat profiles (nicknames)
  const fetchNicknames = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('chat_profiles')
        .select('wallet_address, nickname');
      
      if (!error && data) {
        const map = new Map<string, string>();
        data.forEach((p: ChatProfile) => {
          map.set(p.wallet_address.toLowerCase(), p.nickname);
        });
        setNicknames(map);
        
        // Set my nickname if exists
        if (walletAddress) {
          const myNick = map.get(walletAddress.toLowerCase());
          if (myNick) setMyNickname(myNick);
        }
      }
    } catch (err) {
      console.error('Failed to fetch nicknames:', err);
    }
  }, [walletAddress]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('game_chat_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setMessages(data.reverse());
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchMessages();
    fetchNicknames();
  }, [fetchMessages, fetchNicknames]);

  // Subscribe to realtime messages with fallback polling
  useEffect(() => {
    const channel = supabase
      .channel('game-chat-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_chat_messages'
        },
        (payload) => {
          setLastRealtimeEvent(new Date());
          setRealtimeConnected(true);
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
      .subscribe((status) => {
        console.log('[Chat] Realtime status:', status);
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    // Fallback polling - only when chat is expanded
    const startPolling = () => {
      if (pollingIntervalRef.current) return;
      pollingIntervalRef.current = setInterval(() => {
        const now = new Date();
        // If no realtime event in REALTIME_TIMEOUT, fetch manually
        if (!lastRealtimeEvent || (now.getTime() - lastRealtimeEvent.getTime() > REALTIME_TIMEOUT)) {
          console.log('[Chat] Fallback polling triggered');
          fetchMessages();
        }
      }, POLLING_INTERVAL);
    };

    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };

    if (isExpanded) {
      startPolling();
    }

    return () => {
      supabase.removeChannel(channel);
      stopPolling();
    };
  }, [isExpanded, fetchMessages, lastRealtimeEvent]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isExpanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isExpanded]);

  // Set nickname with signature verification
  const handleSetNickname = async () => {
    if (!walletAddress || !nicknameInput.trim()) return;
    
    const nickname = nicknameInput.trim();
    const nicknameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!nicknameRegex.test(nickname)) {
      toast.error('Nickname: 3-20 chars, alphanumeric + underscore only');
      return;
    }

    setIsSettingNickname(true);
    try {
      const nonce = Date.now().toString();
      const message = `Set nickname to "${nickname}" for oRocket chat.\n\nNonce: ${nonce}`;
      
      // Request signature from wallet
      const eth = (window as any).ethereum;
      if (!eth) {
        toast.error('Wallet not found');
        return;
      }
      
      const signature = await eth.request({
        method: 'personal_sign',
        params: [message, walletAddress],
      });

      // Call edge function
      const { data, error } = await supabase.functions.invoke('set-chat-nickname', {
        body: { wallet_address: walletAddress, nickname, signature, nonce }
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setMyNickname(nickname);
      setNicknames(prev => new Map(prev).set(walletAddress.toLowerCase(), nickname));
      setShowNicknameInput(false);
      setNicknameInput('');
      toast.success('Nickname set!');
    } catch (err: any) {
      console.error('Failed to set nickname:', err);
      if (err.code === 4001) {
        toast.error('Signature rejected');
      } else {
        toast.error(err.message || 'Failed to set nickname');
      }
    } finally {
      setIsSettingNickname(false);
    }
  };

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

  const handleReconnect = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    fetchMessages();
    toast.success('Chat reconnected');
  };

  // Get display name for address
  const getDisplayName = (address: string) => {
    const nickname = nicknames.get(address.toLowerCase());
    if (nickname) {
      return `${nickname}`;
    }
    return formatAddress(address);
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
          {!realtimeConnected && (
            <span className="text-[10px] text-warning">(polling)</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={handleReconnect}
            className="p-1 hover:bg-muted/50 rounded transition-colors"
            title="Reconnect"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button 
            onClick={() => setIsExpanded(false)}
            className="p-1 hover:bg-muted/50 rounded transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Nickname bar */}
      {isConnected && walletAddress && (
        <div className="px-3 py-1.5 border-b border-border/20 bg-card/30 flex items-center justify-between">
          {showNicknameInput ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder="Enter nickname (A-z, 0-9, _)"
                className="h-6 text-xs flex-1 normal-case"
                maxLength={20}
                disabled={isSettingNickname}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <Button 
                size="sm" 
                onClick={handleSetNickname}
                disabled={isSettingNickname || !nicknameInput.trim()}
                className="h-6 px-2 text-xs"
              >
                {isSettingNickname ? '...' : 'Set'}
              </Button>
              <button 
                onClick={() => setShowNicknameInput(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 text-xs">
                <User className="w-3 h-3 text-muted-foreground" />
                <span className={myNickname ? 'text-primary font-medium' : 'text-muted-foreground'}>
                  {myNickname || formatAddress(walletAddress)}
                </span>
              </div>
              <button
                onClick={() => {
                  setNicknameInput(myNickname || '');
                  setShowNicknameInput(true);
                }}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
              >
                <Edit2 className="w-2.5 h-2.5" />
                {myNickname ? 'Edit' : 'Set nickname'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 text-xs">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            No messages yet. Be the first!
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = walletAddress?.toLowerCase() === msg.wallet_address.toLowerCase();
            const displayName = getDisplayName(msg.wallet_address);
            const hasNickname = nicknames.has(msg.wallet_address.toLowerCase());
            return (
              <div 
                key={msg.id}
                className={cn(
                  "flex gap-1.5 break-words",
                  isOwn && "opacity-80"
                )}
              >
                <span className={cn("font-medium shrink-0", getWalletColor(msg.wallet_address))}>
                  {displayName}
                  {hasNickname && (
                    <span className="text-muted-foreground/50 text-[10px] ml-0.5">
                      ({formatAddress(msg.wallet_address)})
                    </span>
                  )}
                  :
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

export default memo(PlayerChat);
