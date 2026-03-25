"use client";

import { AlertCircle, CheckCircle, Zap } from "lucide-react";

interface StatusPanelProps {
  status: "idle" | "running" | "error";
}

export default function StatusPanel({ status }: StatusPanelProps) {
  if (status === "idle") return null;

  const config = {
    running: {
      icon: Zap,
      title: "Bot Running",
      message: "Your pump.fun bot is actively scanning and trading...",
      color: "text-accent border-accent/30 bg-accent/5",
      iconColor: "text-accent",
    },
    error: {
      icon: AlertCircle,
      title: "Error",
      message: "There was an error running the bot. Check your configuration and try again.",
      color: "text-red-500 border-red-500/30 bg-red-500/5",
      iconColor: "text-red-500",
    },
  };

  const current = config[status];
  const Icon = current.icon;

  return (
    <div className={`border rounded-lg p-4 mb-6 flex items-center gap-4 ${current.color}`}>
      <Icon className={`w-6 h-6 ${current.iconColor} flex-shrink-0`} />
      <div className="flex-1">
        <h3 className="font-semibold text-foreground">{current.title}</h3>
        <p className="text-sm text-muted">{current.message}</p>
      </div>
    </div>
  );
}
