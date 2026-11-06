import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { db } from "../lib/db";

const API = "https://api.telegram.org";

export function isTelegramEnabled() {
  return Boolean(env.TELEGRAM_BOT_TOKEN?.trim());
}

export function botUsername() {
  return env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "").trim() || "";
}

async function telegramApi(method: string, body: Record<string, unknown>) {
  if (!isTelegramEnabled()) return null;
  const url = `${API}/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; description?: string };
    if (!json.ok) {
      logger.warn("telegram_api_error", { method, description: json.description });
    }
    return json;
  } catch (e) {
    logger.error("telegram_api_failed", { method, error: String(e) });
    return null;
  }
}

export async function sendTelegramMessage(chatId: string, text: string) {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

function randomCode(len = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}

export async function createTelegramLinkCode(userId: number) {
  const code = randomCode(8);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await db.user.update({
    where: { id: userId },
    data: {
      telegramLinkCode: code,
      telegramLinkExpiresAt: expiresAt,
    },
  });
  return { code, expiresAt, botUsername: botUsername() };
}

export async function unlinkTelegram(userId: number) {
  await db.user.update({
    where: { id: userId },
    data: {
      telegramChatId: null,
      telegramLinkCode: null,
      telegramLinkExpiresAt: null,
    },
  });
}

export async function getTelegramStatus(userId: number) {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: {
      telegramChatId: true,
      telegramLinkCode: true,
      telegramLinkExpiresAt: true,
    },
  });
  return {
    enabled: isTelegramEnabled(),
    linked: Boolean(u?.telegramChatId),
    botUsername: botUsername(),
    pendingCode:
      u?.telegramLinkCode &&
      u.telegramLinkExpiresAt &&
      u.telegramLinkExpiresAt > new Date()
        ? u.telegramLinkCode
        : null,
    pendingExpiresAt:
      u?.telegramLinkCode &&
      u.telegramLinkExpiresAt &&
      u.telegramLinkExpiresAt > new Date()
        ? u.telegramLinkExpiresAt.toISOString()
        : null,
  };
}

type TgUpdate = {
  message?: {
    chat?: { id: number | string; type?: string };
    text?: string;
    from?: { id: number; username?: string; first_name?: string };
  };
};

export async function handleTelegramUpdate(update: TgUpdate) {
  const msg = update.message;
  const text = msg?.text?.trim() ?? "";
  const chatId = msg?.chat?.id != null ? String(msg.chat.id) : null;
  if (!chatId || !text) return;

  if (text === "/start" || text.startsWith("/start ")) {
    const uname = botUsername();
    await sendTelegramMessage(
      chatId,
      [
        "<b>Bot Arsip Surat</b>",
        "",
        "Hubungkan akun aplikasi agar menerima notifikasi surat bidang Anda.",
        "",
        "1. Login di aplikasi → Notifikasi / Hubungkan Telegram",
        "2. Salin kode taut",
        `3. Kirim: <code>/link KODE</code>`,
        "",
        "Lepas tautan: <code>/unlink</code>",
        uname ? `\nBot: @${uname}` : "",
      ].join("\n"),
    );
    return;
  }

  if (text.startsWith("/link")) {
    const code = text.replace(/^\/link\s*/i, "").trim().toUpperCase();
    if (!code) {
      await sendTelegramMessage(chatId, "Format: <code>/link KODE</code>");
      return;
    }
    const user = await db.user.findFirst({
      where: {
        telegramLinkCode: code,
        telegramLinkExpiresAt: { gt: new Date() },
        status: true,
      },
      select: { id: true, nama: true, role: { select: { name: true } } },
    });
    if (!user) {
      await sendTelegramMessage(chatId, "Kode tidak valid atau sudah kedaluwarsa. Buat kode baru di aplikasi.");
      return;
    }
    if (user.role.name === "Super Admin") {
      await sendTelegramMessage(
        chatId,
        "Super Admin menerima notifikasi in-app saja (tanpa Telegram).",
      );
      return;
    }
    // Lepas chat_id dari user lain jika dipakai
    await db.user.updateMany({
      where: { telegramChatId: chatId, NOT: { id: user.id } },
      data: { telegramChatId: null },
    });
    await db.user.update({
      where: { id: user.id },
      data: {
        telegramChatId: chatId,
        telegramLinkCode: null,
        telegramLinkExpiresAt: null,
      },
    });
    await sendTelegramMessage(
      chatId,
      `✅ Terhubung dengan akun <b>${escapeHtml(user.nama)}</b>.\nAnda akan menerima notifikasi surat bidang Anda.`,
    );
    return;
  }

  if (text === "/unlink" || text.startsWith("/unlink ")) {
    const updated = await db.user.updateMany({
      where: { telegramChatId: chatId },
      data: {
        telegramChatId: null,
        telegramLinkCode: null,
        telegramLinkExpiresAt: null,
      },
    });
    await sendTelegramMessage(
      chatId,
      updated.count > 0
        ? "Tautan Telegram dilepas. Notifikasi push dihentikan."
        : "Chat ini belum terhubung ke akun mana pun.",
    );
    return;
  }

  await sendTelegramMessage(
    chatId,
    "Perintah: /start · /link KODE · /unlink",
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
