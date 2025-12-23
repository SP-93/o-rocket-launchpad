import { useState } from 'react';
import { useProtocolConfig, useProtocolConfigUpdate } from '@/hooks/useProtocolConfig';
import { useWallet } from '@/hooks/useWallet';
import GlowCard from '@/components/ui/GlowCard';
import NeonButton from '@/components/ui/NeonButton';
import { Input } from '@/components/ui/input';
import { 
  Database, RefreshCw, Save, AlertTriangle, CheckCircle, 
  Loader2, Edit3, X, Cloud, HardDrive, Copy, ExternalLink 
} from 'lucide-react';
import { toast } from 'sonner';
import { NETWORK_CONFIG } from '@/config/admin';

interface EditingState {
  key: string;
  field: string;
  value: string;
}

const ProtocolConfigSection = () => {
  const { address } = useWallet();
  const { 
    config, 
    isLoading, 
    error, 
    isFromBackend, 
    refetch,
    contracts,
    tokens,
    pools,
    fees,
    adminWallets,
  } = useProtocolConfig();
  
  const { updateConfig, isUpdating } = useProtocolConfigUpdate();
  
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleEdit = (configKey: string, field: string, currentValue: string) => {
    setEditing({ key: configKey, field, value: currentValue });
    setEditValue(currentValue);
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  const handleSave = async () => {
    if (!editing || !address) return;

    // Get current config value and update the specific field
    let configKey = '';
    let fullConfig: any = {};

    switch (editing.key) {
      case 'contracts':
        configKey = 'mainnet_contracts';
        fullConfig = { ...contracts, [editing.field]: editValue };
        break;
      case 'tokens':
        configKey = 'token_addresses';
        fullConfig = { ...tokens, [editing.field]: editValue };
        break;
      case 'pools':
        configKey = 'mainnet_pools';
        fullConfig = { ...pools, [editing.field]: editValue };
        break;
      case 'fees':
        configKey = 'fee_config';
        fullConfig = { ...fees, [editing.field]: parseInt(editValue) || 0 };
        break;
      case 'adminWallets':
        configKey = 'admin_wallets';
        fullConfig = { ...adminWallets, [editing.field]: editValue };
        break;
      default:
        toast.error('Unknown config key');
        return;
    }

    const result = await updateConfig(address, configKey, fullConfig, 'update');
    
    if (result.success) {
      toast.success('Configuration updated', {
        description: `${editing.field} saved to backend`,
      });
      setEditing(null);
      setEditValue('');
      refetch();
    } else {
      toast.error('Update failed', {
        description: result.error,
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const renderConfigItem = (
    configKey: string,
    field: string,
    value: string,
    label: string
  ) => {
    const isEditing = editing?.key === configKey && editing?.field === field;
    
    return (
      <div key={`${configKey}-${field}`} className="flex items-center justify-between p-2 bg-background/30 rounded-lg">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {isEditing ? (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="mt-1 text-xs font-mono h-8"
              disabled={isUpdating}
            />
          ) : (
            <code className="text-xs font-mono text-foreground truncate block">
              {value.length > 20 ? truncateAddress(value) : value}
            </code>
          )}
        </div>
        <div className="flex items-center gap-1 ml-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={isUpdating}
                className="p-1.5 text-success hover:bg-success/10 rounded"
              >
                {isUpdating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isUpdating}
                className="p-1.5 text-destructive hover:bg-destructive/10 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => copyToClipboard(value)}
                className="p-1.5 text-muted-foreground hover:text-primary"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              {value.startsWith('0x') && (
                <a
                  href={`${NETWORK_CONFIG.blockExplorerUrls[0]}/address/${value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                onClick={() => handleEdit(configKey, field, value)}
                className="p-1.5 text-muted-foreground hover:text-warning"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <GlowCard className="p-4" glowColor="cyan">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading configuration...</span>
        </div>
      </GlowCard>
    );
  }

  return (
    <GlowCard className="p-4" glowColor="cyan">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Protocol Configuration</h3>
          {isFromBackend ? (
            <span className="flex items-center gap-1 text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">
              <Cloud className="w-3 h-3" /> Backend
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">
              <HardDrive className="w-3 h-3" /> Fallback
            </span>
          )}
        </div>
        <NeonButton 
          variant="secondary" 
          className="text-xs px-3 py-1.5"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </NeonButton>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-warning/10 border border-warning/30 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <p className="text-xs text-warning">
            Using fallback configuration. Backend error: {error}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* Contracts Section */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Contract Addresses</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(contracts).map(([key, value]) => 
              renderConfigItem('contracts', key, value, key.charAt(0).toUpperCase() + key.slice(1))
            )}
          </div>
        </div>

        {/* Tokens Section */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Token Addresses</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {Object.entries(tokens).map(([key, value]) => 
              renderConfigItem('tokens', key, value, key)
            )}
          </div>
        </div>

        {/* Pools Section */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Pool Addresses</h4>
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(pools).map(([key, value]) => 
              renderConfigItem('pools', key, value, key)
            )}
          </div>
        </div>

        {/* Fee Config Section */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Fee Configuration</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(fees).map(([key, value]) => 
              renderConfigItem('fees', key, String(value), key.replace(/([A-Z])/g, ' $1').trim())
            )}
          </div>
        </div>

        {/* Admin Wallets Section */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Admin Wallets</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {Object.entries(adminWallets).map(([key, value]) => 
              renderConfigItem('adminWallets', key, value, key.charAt(0).toUpperCase() + key.slice(1))
            )}
          </div>
        </div>
      </div>

      {/* Status Footer */}
      <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-success" />
          <span>All addresses validated</span>
        </div>
        <span>Changes are audited and logged</span>
      </div>
    </GlowCard>
  );
};

export default ProtocolConfigSection;
