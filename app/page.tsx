"use client";

import { useState, useEffect } from "react";
import ConfigForm from "@/components/ConfigForm";
import Header from "@/components/Header";
import StatusPanel from "@/components/StatusPanel";
import QuickStart from "@/components/QuickStart";

export default function Home() {
  const [savedConfig, setSavedConfig] = useState<Record<string, string> | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [botStatus, setBotStatus] = useState<"idle" | "running" | "error">("idle");

  // Load config from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("pumpfun_config");
    if (stored) {
      try {
        setSavedConfig(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load saved config:", e);
      }
    }
    setIsLoading(false);
  }, []);

  const handleSave = (config: Record<string, string>) => {
    setSavedConfig(config);
    localStorage.setItem("pumpfun_config", JSON.stringify(config));
    console.log("Configuration saved:", config);
  };

  const handleRun = async (config: Record<string, string>) => {
    setIsLoading(true);
    setBotStatus("running");
    try {
      const response = await fetch("/api/run-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setBotStatus("idle");
        alert("Bot started successfully! Check the console for output.");
      } else {
        setBotStatus("error");
        alert("Failed to start bot. Check the console for details.");
      }
    } catch (error) {
      setBotStatus("error");
      console.error("Error running bot:", error);
      alert("Error running bot: " + (error instanceof Error ? error.message : "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted">Loading configuration...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <StatusPanel status={botStatus} />
        <QuickStart />
        <ConfigForm 
          onSave={handleSave} 
          onRun={handleRun}
          initialConfig={savedConfig} 
          isRunning={botStatus === "running"}
        />
      </div>
    </main>
  );
}
