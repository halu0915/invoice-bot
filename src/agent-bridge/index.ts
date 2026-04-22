/**
 * Agent Bridge – Bot-to-Bot Communication Middleware
 *
 * Monitors the Telegram group for messages from CEO Bot.
 * When CEO Bot mentions another agent, this middleware dispatches
 * a task message using the target agent's bot token so that
 * OpenClaw picks it up and processes it.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const GROUP_ID = -5116782508;

// Use invoice bot token to monitor group (it's NOT managed by OpenClaw, so no polling conflict)
const MONITOR_BOT_TOKEN = "8658679897:AAEcz8eJBHhL4dlT02Z6ug91DFmozA_uU58";
const CEO_BOT_USER_ID = 8515087063;

interface AgentConfig {
  name: string;
  token: string;
  patterns: RegExp[];
}

const AGENTS: AgentConfig[] = [
  {
    name: "Design",
    token: "8267447476:AAHk1marOX9D7Zpa8wWoh1B7d26xCzOCsm0",
    patterns: [/@design\b/i, /@NPSdesign_bot\b/i, /設計\s*Agent/i],
  },
  {
    name: "Estimation",
    token: "8724932838:AAEij1p-buN5GSQPxwh0atQJ_DPLPXWfd5w",
    patterns: [/@estimation\b/i, /@NPSestimate_bot\b/i, /估算\s*Agent/i],
  },
  {
    name: "Procurement",
    token: "8371177169:AAF1XTY_9m9uAn4ns4GaflLeVENP0lGdMEo",
    patterns: [/@procurement\b/i, /@NPSprocure_bot\b/i, /採購\s*Agent/i],
  },
  {
    name: "Intelligence",
    token: "8777764999:AAHUuvxc2-AQ5BuTAPG0EnRMG1MDGcryTrw",
    patterns: [/@intelligence\b/i, /@NPSinteligence_bot\b/i, /情報\s*Agent/i],
  },
  {
    name: "Finance",
    token: "8717149203:AAG55XWAf5eMoylG2ql7FTd8noZquTSY9_U",
    patterns: [/@finance\b/i, /@NPSfiance_bot\b/i, /財務\s*Agent/i],
  },
];

// ---------------------------------------------------------------------------
// Telegram Bot API helpers
// ---------------------------------------------------------------------------

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number };
  text?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

async function telegramApi<T>(
  token: string,
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!data.ok) {
    throw new Error(`Telegram API error [${method}]: ${data.description ?? "unknown"}`);
  }
  return data.result;
}

async function getUpdates(offset: number): Promise<TelegramUpdate[]> {
  return telegramApi<TelegramUpdate[]>(MONITOR_BOT_TOKEN, "getUpdates", {
    offset,
    timeout: 30, // long-poll 30 s
    allowed_updates: ["message"],
  });
}

async function sendMessageAs(
  agentToken: string,
  chatId: number,
  text: string,
): Promise<TelegramMessage> {
  return telegramApi<TelegramMessage>(agentToken, "sendMessage", {
    chat_id: chatId,
    text,
  });
}

// ---------------------------------------------------------------------------
// Dispatch logic
// ---------------------------------------------------------------------------

function detectMentionedAgents(text: string): AgentConfig[] {
  const matched: AgentConfig[] = [];
  for (const agent of AGENTS) {
    if (agent.patterns.some((p) => p.test(text))) {
      matched.push(agent);
    }
  }
  return matched;
}

function extractTaskText(text: string): string {
  // Strip all agent mention tokens so the task description is cleaner
  let cleaned = text;
  for (const agent of AGENTS) {
    for (const p of agent.patterns) {
      cleaned = cleaned.replace(p, "");
    }
  }
  return cleaned.replace(/\s+/g, " ").trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main polling loop
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  let offset = 0;

  console.log("[agent-bridge] Starting Bot-to-Bot bridge...");
  console.log(`[agent-bridge] Monitoring group ${GROUP_ID} for CEO Bot (${CEO_BOT_USER_ID}) messages`);
  console.log(`[agent-bridge] Registered agents: ${AGENTS.map((a) => a.name).join(", ")}`);

  while (true) {
    try {
      const updates = await getUpdates(offset);

      for (const update of updates) {
        offset = update.update_id + 1;

        const msg = update.message;
        if (!msg?.text || !msg.from) continue;

        // Only process messages in our target group
        if (msg.chat.id !== GROUP_ID) continue;

        // Only process messages from CEO Bot
        if (msg.from.id !== CEO_BOT_USER_ID) continue;

        // Skip messages from non-bot users who happen to share the ID (safety)
        // CEO Bot will always have is_bot = true
        if (!msg.from.is_bot) continue;

        const text = msg.text;
        const mentionedAgents = detectMentionedAgents(text);
        if (mentionedAgents.length === 0) continue;

        const taskText = extractTaskText(text);
        const taskDescription = taskText || text;

        console.log(
          `[agent-bridge] CEO dispatching to: ${mentionedAgents.map((a) => a.name).join(", ")}`,
        );
        console.log(`[agent-bridge] Task: ${taskDescription}`);

        for (const agent of mentionedAgents) {
          const dispatchMessage = `CEO 指派任務：${taskDescription}`;

          try {
            const sent = await sendMessageAs(agent.token, GROUP_ID, dispatchMessage);
            console.log(
              `[agent-bridge] Dispatched to ${agent.name} (message_id: ${sent.message_id})`,
            );
          } catch (dispatchErr) {
            console.error(`[agent-bridge] Failed to dispatch to ${agent.name}:`, dispatchErr);
          }

          // Rate-limit delay between dispatches
          if (mentionedAgents.length > 1) {
            await sleep(2000);
          }
        }

        // Always wait 2s after processing a CEO message to avoid rate limits
        await sleep(2000);
      }
    } catch (err) {
      console.error("[agent-bridge] Polling error:", err);
      await sleep(5000);
    }
  }
}

run();
