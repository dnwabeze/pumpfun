"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import ConfigSection from "./ConfigSection";
import Button from "./Button";

interface ConfigFormProps {
  onSave: (config: Record<string, string>) => void;
  onRun: (config: Record<string, string>) => Promise<void>;
  initialConfig?: Record<string, string> | null;
  isRunning?: boolean;
}

const SECTIONS = [
  {
    id: "rpc",
    title: "RPC Configuration",
    description: "Solana RPC endpoints and network settings",
    fields: [
      { name: "RPC_URL", label: "RPC URL", type: "text", placeholder: "https://api.mainnet-beta.solana.com" },
      { name: "WSS_URL", label: "WebSocket URL", type: "text", placeholder: "wss://api.mainnet-beta.solana.com" },
      { name: "SOLANA_RPC_URL", label: "Solana RPC URL", type: "text", placeholder: "https://api.mainnet-beta.solana.com" },
    ],
  },
  {
    id: "targeting",
    title: "Target Configuration",
    description: "Specify which tokens to target",
    fields: [
      { name: "TARGET_X", label: "Target X Handle", type: "text", placeholder: "Leave blank to match any" },
      { name: "TARGET_TELEGRAM", label: "Target Telegram", type: "text", placeholder: "Leave blank to match any" },
    ],
  },
  {
    id: "wallet",
    title: "Wallet Configuration",
    description: "Solana wallets for trading (up to 4 wallets supported)",
    fields: [
      { name: "SOLANA_PRIVATE_KEY", label: "Main Private Key", type: "password", placeholder: "Your main wallet private key" },
      { name: "SOLANA_PRIVATE_KEY_2", label: "Private Key 2 (Optional)", type: "password", placeholder: "Optional second wallet" },
      { name: "SOLANA_PRIVATE_KEY_3", label: "Private Key 3 (Optional)", type: "password", placeholder: "Optional third wallet" },
      { name: "SOLANA_PRIVATE_KEY_4", label: "Private Key 4 (Optional)", type: "password", placeholder: "Optional fourth wallet" },
    ],
  },
  {
    id: "buying",
    title: "Jito Buying Configuration",
    description: "Settings for token purchases via Jito",
    fields: [
      { name: "BUY_AMOUNT_SOL", label: "Buy Amount (SOL)", type: "number", placeholder: "0.01" },
      { name: "JITO_TIP_AMOUNT_SOL", label: "Jito Tip (SOL)", type: "number", placeholder: "0.001" },
      { name: "JITO_BLOCK_ENGINE_URL", label: "Jito Block Engine URL", type: "text", placeholder: "https://mainnet.block-engine.jito.wtf/api/v1/bundles" },
      { name: "JITO_DRY_RUN", label: "Dry Run Mode", type: "checkbox" },
    ],
  },
  {
    id: "sltp",
    title: "Stop Loss / Take Profit",
    description: "Automatic sell conditions",
    fields: [
      { name: "SL_PERCENT", label: "Stop Loss %", type: "number", placeholder: "-15" },
      { name: "TP_PERCENT", label: "Take Profit %", type: "number", placeholder: "50" },
      { name: "DEV_SELL_ENABLED", label: "Enable Dev Sell Detection", type: "checkbox" },
    ],
  },
  {
    id: "follower",
    title: "Wallet Follower Configuration",
    description: "Follow other wallets and copy their trades",
    fields: [
      { name: "HELIUS_WS_URL", label: "Helius WebSocket URL", type: "text", placeholder: "wss://mainnet.helius-rpc.com/?api-key=..." },
      { name: "FOLLOW_WALLETS", label: "Wallets to Follow (comma-separated)", type: "textarea", placeholder: "wallet1,wallet2,wallet3" },
      { name: "JITO_TIP_FOLLOW", label: "Jito Tip for Following (SOL)", type: "number", placeholder: "0.01" },
      { name: "SLIPPAGE", label: "Slippage %", type: "number", placeholder: "15" },
      { name: "PRIORITY_FEE", label: "Priority Fee (SOL)", type: "number", placeholder: "0.0001" },
      { name: "STOP_AFTER_FIRST_BUY", label: "Stop After First Buy", type: "checkbox" },
    ],
  },
  {
    id: "telegram",
    title: "Telegram Configuration",
    description: "Connect to Telegram for notifications",
    fields: [
      { name: "FORWARD_BOT_USERNAME", label: "Forward Bot Username", type: "text", placeholder: "@your_bot_username" },
      { name: "TELEGRAM_API_ID", label: "Telegram API ID", type: "text", placeholder: "Your Telegram API ID" },
      { name: "TELEGRAM_API_HASH", label: "Telegram API Hash", type: "password", placeholder: "Your Telegram API Hash" },
    ],
  },
  {
    id: "security",
    title: "Security Filters",
    description: "Risk management and filtering options",
    fields: [
      { name: "REQUIRE_WEBSITE", label: "Require Website", type: "checkbox" },
      { name: "MAX_BUNDLE_SNIPED_SOL", label: "Max Bundle Sniped (SOL)", type: "number", placeholder: "15" },
      { name: "MIN_DEV_BUY_SOL", label: "Min Dev Buy (SOL)", type: "number", placeholder: "0.5" },
      { name: "KOTH_SELL_MC_SOL", label: "KOTH Sell Market Cap (SOL)", type: "number", placeholder: "80" },
    ],
  },
];

export default function ConfigForm({ onSave, onRun, initialConfig, isRunning = false }: ConfigFormProps) {
  const [formData, setFormData] = useState<Record<string, string>>(initialConfig || {});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["rpc", "targeting"]));
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const handleChange = (name: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [name]: typeof value === "boolean" ? (value ? "true" : "") : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    alert("Configuration saved! You can now use these settings to run your bot.");
  };

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      onSave(formData);
      await onRun(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = () => {
    const envContent = Object.entries(formData)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const blob = new Blob([envContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {SECTIONS.map((section) => (
        <ConfigSection
          key={section.id}
          section={section}
          formData={formData}
          onFieldChange={handleChange}
          isExpanded={expandedSections.has(section.id)}
          onToggle={() => toggleSection(section.id)}
        />
      ))}

      <div className="flex gap-4 sticky bottom-8 bg-background/80 backdrop-blur py-4 rounded-lg px-4 border border-secondary flex-wrap">
        <Button
          type="submit"
          variant="primary"
          className="flex-1 min-w-[150px]"
          disabled={isSubmitting || isRunning}
        >
          Save Configuration
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleExport}
          className="flex-1 min-w-[150px]"
          disabled={isSubmitting || isRunning}
        >
          Export as .env
        </Button>
        <Button
          type="button"
          onClick={handleRun}
          className="flex-1 min-w-[150px] bg-accent text-background hover:bg-accent/90 active:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting || isRunning}
        >
          {isSubmitting ? "Starting..." : isRunning ? "Running..." : "▶ Run Bot"}
        </Button>
      </div>
    </form>
  );
}
