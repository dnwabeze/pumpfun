import { Zap, Shield } from "lucide-react";

export default function Header() {
  return (
    <header className="border-b border-secondary bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Pump.fun Bot
                </h1>
                <p className="text-muted text-xs mt-0.5 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Configuration Dashboard
                </p>
              </div>
            </div>
          </div>
          <div className="text-right text-sm text-muted space-y-1">
            <p className="font-semibold text-foreground">v1.0</p>
            <p className="text-xs">Solana Trading Bot</p>
            <p className="text-xs text-primary font-medium">Ready to Trade</p>
          </div>
        </div>
      </div>
    </header>
  );
}
