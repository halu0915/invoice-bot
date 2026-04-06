import { Bot, InputFile } from 'grammy';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { recognizeInvoice } from '../ocr/index.js';
import { insertInvoice, getInvoices, getStats, deleteInvoice } from '../db/index.js';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../data/uploads');

// Ensure upload directory exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('請設定 TELEGRAM_BOT_TOKEN 環境變數');
  process.exit(1);
}

const bot = new Bot(token);

// /start command
bot.command('start', async (ctx) => {
  await ctx.reply(
    `🧾 發票收據管理 Bot

📸 拍照或上傳發票圖片 → 自動辨識建檔
📊 /stats → 本月消費統計
📋 /list → 最近 10 筆發票
🏢 /company → 公司進項發票
🗑️ /delete [ID] → 刪除指定發票
👥 /all → 全部使用者統計（管理員）
❓ /help → 使用說明`
  );
});

// /help command
bot.command('help', async (ctx) => {
  await ctx.reply(
    `使用方式：

1️⃣ 直接拍照或傳送發票圖片
   → Bot 會自動 OCR 辨識並存檔
   → 有統編的自動標記為公司進項

2️⃣ 查詢指令：
   /stats - 本月消費統計
   /stats 2024-03 - 指定月份統計
   /list - 最近 10 筆
   /list 20 - 最近 20 筆
   /company - 公司進項發票
   /delete 5 - 刪除 ID 為 5 的發票
   /all - 全部使用者統計（管理員）`
  );
});

// /stats command
bot.command('stats', async (ctx) => {
  const arg = ctx.match?.trim();
  let start: Date;
  let end: Date;

  if (arg && /^\d{4}-\d{2}$/.test(arg)) {
    start = new Date(`${arg}-01`);
    end = endOfMonth(start);
  } else {
    start = startOfMonth(new Date());
    end = endOfMonth(new Date());
  }

  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');
  const userId = ctx.from?.id?.toString() || '';
  const stats = getStats(startStr, endStr, userId);

  const monthLabel = format(start, 'yyyy年MM月');

  let msg = `📊 ${monthLabel} 消費統計\n\n`;
  msg += `📝 發票數量：${stats.total.count} 張\n`;
  msg += `💰 總金額：$${stats.total.total_amount.toLocaleString()}\n`;
  msg += `💵 總稅額：$${stats.total.total_tax.toLocaleString()}\n\n`;

  if (stats.company.count > 0) {
    msg += `🏢 公司進項：${stats.company.count} 張 / $${stats.company.total_amount.toLocaleString()}\n`;
    msg += `   可扣抵稅額：$${stats.company.total_tax.toLocaleString()}\n\n`;
  }

  if (stats.byCategory.length > 0) {
    msg += `📂 分類明細：\n`;
    for (const cat of stats.byCategory) {
      msg += `  ${cat.category}：${cat.count} 筆 / $${cat.total_amount.toLocaleString()}\n`;
    }
  }

  await ctx.reply(msg);
});

// /list command
bot.command('list', async (ctx) => {
  const limit = parseInt(ctx.match?.trim() || '10', 10);
  const userId = ctx.from?.id?.toString() || '';
  const invoices = getInvoices({ limit, userId });

  if (invoices.length === 0) {
    await ctx.reply('目前沒有任何發票紀錄');
    return;
  }

  let msg = `📋 最近 ${invoices.length} 筆發票：\n\n`;
  for (const inv of invoices) {
    const company = inv.is_company ? ' 🏢' : '';
    msg += `#${inv.id} | ${inv.date} | ${inv.vendor} | $${inv.amount.toLocaleString()} | ${inv.category}${company}\n`;
  }

  await ctx.reply(msg);
});

// /company command
bot.command('company', async (ctx) => {
  const now = new Date();
  const start = format(startOfMonth(now), 'yyyy-MM-dd');
  const end = format(endOfMonth(now), 'yyyy-MM-dd');

  const userId = ctx.from?.id?.toString() || '';
  const invoices = getInvoices({ startDate: start, endDate: end, isCompany: true, userId });

  if (invoices.length === 0) {
    await ctx.reply('本月沒有公司進項發票');
    return;
  }

  let msg = `🏢 本月公司進項發票：\n\n`;
  let totalAmount = 0;
  let totalTax = 0;

  for (const inv of invoices) {
    msg += `#${inv.id} | ${inv.date} | ${inv.vendor}\n`;
    msg += `  金額：$${inv.amount.toLocaleString()} / 稅額：$${inv.tax_amount.toLocaleString()}\n`;
    msg += `  發票號碼：${inv.invoice_number || '未知'}\n\n`;
    totalAmount += inv.amount;
    totalTax += inv.tax_amount;
  }

  msg += `---\n`;
  msg += `合計：${invoices.length} 張 / $${totalAmount.toLocaleString()}\n`;
  msg += `可扣抵稅額：$${totalTax.toLocaleString()}`;

  await ctx.reply(msg);
});

// /delete command
bot.command('delete', async (ctx) => {
  const id = parseInt(ctx.match?.trim() || '', 10);
  if (isNaN(id)) {
    await ctx.reply('請提供發票 ID，例如：/delete 5');
    return;
  }

  const success = deleteInvoice(id);
  if (success) {
    await ctx.reply(`✅ 已刪除發票 #${id}`);
  } else {
    await ctx.reply(`❌ 找不到 ID 為 ${id} 的發票`);
  }
});

// /all command - admin view for all users
bot.command('all', async (ctx) => {
  const arg = ctx.match?.trim();
  let start: Date;
  let end: Date;

  if (arg && /^\d{4}-\d{2}$/.test(arg)) {
    start = new Date(`${arg}-01`);
    end = endOfMonth(start);
  } else {
    start = startOfMonth(new Date());
    end = endOfMonth(new Date());
  }

  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');
  const stats = getStats(startStr, endStr);

  const monthLabel = format(start, 'yyyy年MM月');

  let msg = `👥 ${monthLabel} 全部使用者統計\n\n`;
  msg += `📝 發票數量：${stats.total.count} 張\n`;
  msg += `💰 總金額：$${stats.total.total_amount.toLocaleString()}\n`;
  msg += `💵 總稅額：$${stats.total.total_tax.toLocaleString()}\n\n`;

  if (stats.company.count > 0) {
    msg += `🏢 公司進項：${stats.company.count} 張 / $${stats.company.total_amount.toLocaleString()}\n`;
    msg += `   可扣抵稅額：$${stats.company.total_tax.toLocaleString()}\n\n`;
  }

  if (stats.byCategory.length > 0) {
    msg += `📂 分類明細：\n`;
    for (const cat of stats.byCategory) {
      msg += `  ${cat.category}：${cat.count} 筆 / $${cat.total_amount.toLocaleString()}\n`;
    }
  }

  await ctx.reply(msg);
});

// Handle photo messages - OCR processing
bot.on('message:photo', async (ctx) => {
  await ctx.reply('🔍 正在辨識發票，請稍候...');

  try {
    // Get the highest resolution photo
    const photos = ctx.message.photo;
    const photo = photos[photos.length - 1];
    const file = await ctx.api.getFile(photo.file_id);

    // Download the image
    const filePath = path.join(UPLOAD_DIR, `${Date.now()}_${photo.file_id}.jpg`);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // OCR recognition
    const ocrResult = await recognizeInvoice(filePath);

    // Save to database
    const userId = ctx.from?.id?.toString() || '';
    const userName = ((ctx.from?.first_name || '') + ' ' + (ctx.from?.last_name || '')).trim();
    const id = insertInvoice({
      image_path: filePath,
      date: ocrResult.date,
      vendor: ocrResult.vendor,
      tax_id: ocrResult.tax_id,
      amount: ocrResult.amount,
      tax_amount: ocrResult.tax_amount,
      pretax_amount: ocrResult.pretax_amount,
      category: ocrResult.category,
      items: JSON.stringify(ocrResult.items),
      invoice_number: ocrResult.invoice_number,
      is_company: !!ocrResult.tax_id,
      note: '',
      user_id: userId,
      user_name: userName,
    });

    const companyTag = ocrResult.tax_id ? `\n🏢 公司進項（統編：${ocrResult.tax_id}）` : '';
    const itemsList = ocrResult.items
      .map((i) => `  - ${i.name} x${i.quantity} $${i.price}`)
      .join('\n');

    let msg = `✅ 發票已建檔 #${id}\n\n`;
    msg += `📅 日期：${ocrResult.date}\n`;
    msg += `🏪 商家：${ocrResult.vendor}\n`;
    msg += `💰 金額：$${ocrResult.amount.toLocaleString()}\n`;
    if (ocrResult.tax_amount > 0) {
      msg += `💵 稅額：$${ocrResult.tax_amount.toLocaleString()}\n`;
    }
    msg += `📂 分類：${ocrResult.category}\n`;
    if (ocrResult.invoice_number) {
      msg += `🔢 發票號碼：${ocrResult.invoice_number}\n`;
    }
    msg += companyTag;
    if (itemsList) {
      msg += `\n\n📦 品項：\n${itemsList}`;
    }

    await ctx.reply(msg);
  } catch (error) {
    console.error('OCR error:', error);
    const errMsg = error instanceof Error ? error.message : '未知錯誤';
    await ctx.reply(`❌ 辨識失敗：${errMsg}\n請確認圖片清晰後重試`);
  }
});

// Handle document (for image files sent as documents)
bot.on('message:document', async (ctx) => {
  const doc = ctx.message.document;
  const mime = doc.mime_type || '';

  if (!mime.startsWith('image/')) {
    await ctx.reply('請傳送發票圖片（JPG / PNG）');
    return;
  }

  await ctx.reply('🔍 正在辨識發票，請稍候...');

  try {
    const file = await ctx.api.getFile(doc.file_id);
    const ext = doc.file_name?.split('.').pop() || 'jpg';
    const filePath = path.join(UPLOAD_DIR, `${Date.now()}_${doc.file_id}.${ext}`);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

    const response = await fetch(fileUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const ocrResult = await recognizeInvoice(filePath);

    const userId = ctx.from?.id?.toString() || '';
    const userName = ((ctx.from?.first_name || '') + ' ' + (ctx.from?.last_name || '')).trim();
    const id = insertInvoice({
      image_path: filePath,
      date: ocrResult.date,
      vendor: ocrResult.vendor,
      tax_id: ocrResult.tax_id,
      amount: ocrResult.amount,
      tax_amount: ocrResult.tax_amount,
      pretax_amount: ocrResult.pretax_amount,
      category: ocrResult.category,
      items: JSON.stringify(ocrResult.items),
      invoice_number: ocrResult.invoice_number,
      is_company: !!ocrResult.tax_id,
      note: '',
      user_id: userId,
      user_name: userName,
    });

    const companyTag = ocrResult.tax_id ? `\n🏢 公司進項（統編：${ocrResult.tax_id}）` : '';

    await ctx.reply(
      `✅ 發票已建檔 #${id}\n\n📅 ${ocrResult.date} | 🏪 ${ocrResult.vendor}\n💰 $${ocrResult.amount.toLocaleString()} | 📂 ${ocrResult.category}${companyTag}`
    );
  } catch (error) {
    console.error('OCR error:', error);
    const errMsg = error instanceof Error ? error.message : '未知錯誤';
    await ctx.reply(`❌ 辨識失敗：${errMsg}\n請確認圖片清晰後重試`);
  }
});

// Start bot
bot.start({
  onStart: () => {
    console.log('🤖 Invoice Bot is running!');
  },
});
