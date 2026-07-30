import app from "./app";
import { logger } from "./lib/logger";
import { startTelegramBot, startAppointmentCleanupJob } from "./telegram-bot";
import TelegramBot from "node-telegram-bot-api";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const isDev = process.env.NODE_ENV === "development";

// Run schema migrations that may be needed in production
async function runMigrations() {
  const migrations = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_user_id TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_business_connection_id TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username_verified BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'basic'`,
    // business_connections table
    `ALTER TABLE business_connections ADD COLUMN IF NOT EXISTS owner_telegram_id TEXT`,
    // automod_messages table
    `ALTER TABLE automod_messages ADD COLUMN IF NOT EXISTS chat_id TEXT`,
  ];

  for (const migration of migrations) {
    try {
      await db.execute(sql.raw(migration));
    } catch (err) {
      logger.warn({ err, migration }, "Migration warning (non-fatal)");
    }
  }

  try {
    await db.execute(sql`
      ALTER TABLE users ADD CONSTRAINT users_telegram_user_id_unique UNIQUE (telegram_user_id)
    `);
  } catch {
    // constraint may already exist
  }

  try {
    await db.execute(sql`
      ALTER TABLE users ADD CONSTRAINT users_telegram_business_connection_id_unique UNIQUE (telegram_business_connection_id)
    `);
  } catch {
    // constraint may already exist
  }

  logger.info("DB migrations applied");
}

runMigrations();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startAppointmentCleanupJob();

  let botInstance: TelegramBot | null = null;

  const shutdown = () => {
    if (botInstance) {
      botInstance.stopPolling().finally(() => process.exit(0));
    } else {
      process.exit(0);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  const botEnabled = !isDev || process.env.BOT_ENABLED === "true";

  if (!botEnabled) {
    logger.info(
      "Development mode: Telegram bot disabled. Set BOT_ENABLED=true to enable in dev."
    );
  } else {
    if (isDev) {
      logger.info("Development mode: Starting Telegram bot (BOT_ENABLED=true)");
    }
    startTelegramBot()
      .then((bot) => {
        botInstance = bot;
      })
      .catch((err) => {
        logger.error({ err }, "Failed to start Telegram bot");
      });
  }
});
