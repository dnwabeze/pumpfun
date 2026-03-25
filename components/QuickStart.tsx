"use client";

import { ChevronRight, AlertCircle } from "lucide-react";

export default function QuickStart() {
  return (
    <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 border border-secondary rounded-lg p-6 mb-8">
      <div className="flex items-start gap-4">
        <div className="p-2 rounded-lg bg-accent/10">
          <AlertCircle className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-foreground mb-3">Quick Start</h2>
          <ol className="space-y-2 text-sm text-muted">
            <li className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-background text-xs font-bold flex-shrink-0">1</span>
              <span>Fill in your <span className="text-primary font-medium">RPC Configuration</span> with your Solana endpoints</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-background text-xs font-bold flex-shrink-0">2</span>
              <span>Set your <span className="text-primary font-medium">Target Configuration</span> (X handle or Telegram to monitor)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-background text-xs font-bold flex-shrink-0">3</span>
              <span>Add your <span className="text-primary font-medium">Private Keys</span> and wallet details</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-background text-xs font-bold flex-shrink-0">4</span>
              <span>Configure trading parameters (stop loss, take profit, buy amount)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-background text-xs font-bold flex-shrink-0">5</span>
              <span>Click <span className="text-accent font-medium">▶ Run Bot</span> to start trading!</span>
            </li>
          </ol>
          <div className="mt-4 p-3 rounded-lg bg-background/50 border border-secondary/50">
            <p className="text-xs text-muted">
              💡 <span className="text-foreground font-medium">Pro Tip:</span> Enable "Dry Run Mode" in Jito settings to test your configuration without spending real SOL.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
