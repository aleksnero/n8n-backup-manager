# 📱 Telegram Notifications Setup

Setting up Telegram notifications allows you to receive instant alerts when a backup succeeds or fails.

## Step 1: Create a Telegram Bot

1. Open Telegram and search for the **[@BotFather](https://t.me/BotFather)** bot.
2. Send the `/newbot` command.
3. Follow the prompts to choose a **Name** and a **Username** (must end in `bot`, e.g., `n8n_backup_alert_bot`).
4. Once created, BotFather will give you a **HTTP API Token**. It looks like this:
   `123456789:AABBccDDeeFFggHHiiJJkkLLmmNNoo`
5. **Copy this token**. You will need it for the Backup Manager settings.

## Step 2: Get Your Chat ID

You need to tell the bot where to send messages. It can send them directly to you, or to a group chat.

### Option A: Send to yourself (Direct Message)
1. Search for **[@userinfobot](https://t.me/userinfobot)** or **[@getmyid_bot](https://t.me/getmyid_bot)** on Telegram.
2. Start the bot. It will reply with your personal **Chat ID** (a number like `123456789`).
3. **Important:** Go to your new bot (the one you created in Step 1) and click **Start** or send it a message (like "hello") so it is allowed to message you.

### Option B: Send to a Group
1. Add your new bot to the desired Telegram group.
2. Add **[@getmyid_bot](https://t.me/getmyid_bot)** to the same group.
3. The bot will instantly reply with the Group ID. It usually starts with a minus sign (e.g., `-1001234567890`).
4. Remove `@getmyid_bot` from the group after you copy the ID.

## Step 3: Configure Backup Manager

1. Open **n8n Backup Manager** and go to **Settings → Notifications**.
2. Check the **Enable Telegram notifications** box.
3. Paste the **Telegram Bot Token** from Step 1.
4. Paste the **Telegram Chat ID** from Step 2.
5. Click **Send Test Message**. You should receive a test alert in Telegram immediately!
6. Click **Save Settings**.
