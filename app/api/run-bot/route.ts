import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export async function POST(request: NextRequest) {
  try {
    const config = await request.json();

    // Validate required fields
    const requiredFields = ["SOLANA_PRIVATE_KEY", "RPC_URL"];
    const missing = requiredFields.filter((field) => !config[field]);

    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required configuration: ${missing.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Create .env file from config
    const envContent = Object.entries(config)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const envPath = path.join(process.cwd(), ".env.local");
    fs.writeFileSync(envPath, envContent);

    console.log("Starting pump.fun bot with config...");
    console.log("Environment variables written to .env.local");

    // Spawn the bot process
    const botProcess = spawn("node", ["index.js"], {
      cwd: process.cwd(),
      detached: true,
      stdio: "inherit",
      env: {
        ...process.env,
        ...Object.fromEntries(
          Object.entries(config).filter(([_, value]) => value)
        ),
      },
    });

    // Unref the process so Node doesn't wait for it
    botProcess.unref();

    return NextResponse.json(
      {
        success: true,
        message: "Bot started successfully",
        pid: botProcess.pid,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error starting bot:", error);
    return NextResponse.json(
      {
        error: `Failed to start bot: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}
