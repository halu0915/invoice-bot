import { Bot, InputFile, InlineKeyboard } from 'grammy';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { recognizeInvoice } from '../ocr/index.js';
import { insertInvoice, getInvoices, getStats, deleteInvoice, getInvoiceById, findByInvoiceNumber, searchInvoices, updateInvoiceCategory } from '../db/index.js';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = process.env.DB_DIR ? path.join(process.env.DB_DIR, 'uploads') : path.join(__dirname, '../../data/uploads');

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
📋 /list → 最近 10 筆發票（自己的）
🔍 /search [關鍵字] → 搜尋發票
📅 /range [起日] [迄日] → 日期區間查詢
🏢 /company → 公司進項發票
🗑️ /delete [ID] → 刪除指定發票
👥 /all → 全部使用者統計
📋 /listall → 全部使用者發票明細
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
   /search 全聯 - 搜尋商家或發票號碼
   /range 2026-01-01 2026-03-31 - 日期區間查詢
   /company - 公司進項發票
   /delete 5 - 刪除 ID 為 5 的發票
   /all - 全部使用者統計
   /all 2026-03 - 指定月份全部統計
   /listall - 全部使用者發票明細`
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

  const invoice = getInvoiceById(id);
  if (!invoice) {
    await ctx.reply(`❌ 找不到 ID 為 ${id} 的發票`);
    return;
  }

  const currentUserId = ctx.from?.id?.toString() || '';
  if (invoice.user_id !== currentUserId) {
    await ctx.reply('❌ 你只能刪除自己上傳的發票');
    return;
  }

  const success = deleteInvoice(id);
  if (success) {
    await ctx.reply(`✅ 已刪除發票 #${id}`);
  } else {
    await ctx.reply(`❌ 刪除發票 #${id} 時發生錯誤`);
  }
});

// /listall command - view all users' invoices
bot.command('listall', async (ctx) => {
  const limit = parseInt(ctx.match?.trim() || '20', 10);
  const invoices = getInvoices({ limit });

  if (invoices.length === 0) {
    await ctx.reply('目前沒有任何發票紀錄');
    return;
  }

  let msg = `📋 全部使用者最近 ${invoices.length} 筆發票：\n\n`;
  for (const inv of invoices) {
    const company = inv.is_company ? ' 🏢' : '';
    const user = inv.user_name || '未知';
    msg += `#${inv.id} | ${inv.date} | ${inv.vendor} | $${inv.amount.toLocaleString()} | ${inv.category}${company} | 👤${user}\n`;
  }

  await ctx.reply(msg);
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

// /search command
bot.command('search', async (ctx) => {
  const keyword = ctx.match?.trim();
  if (!keyword) {
    await ctx.reply('請提供搜尋關鍵字，例如：/search 全聯');
    return;
  }

  const userId = ctx.from?.id?.toString() || '';
  const invoices = searchInvoices(keyword, userId);

  if (invoices.length === 0) {
    await ctx.reply(`🔍 找不到包含「${keyword}」的發票`);
    return;
  }

  let msg = `🔍 搜尋「${keyword}」結果（${invoices.length} 筆）：\n\n`;
  for (const inv of invoices) {
    const company = inv.is_company ? ' 🏢' : '';
    msg += `#${inv.id} | ${inv.date} | ${inv.vendor} | $${inv.amount.toLocaleString()} | ${inv.category}${company}\n`;
    if (inv.invoice_number) {
      msg += `  發票號碼：${inv.invoice_number}\n`;
    }
  }

  await ctx.reply(msg);
});

// /range command
bot.command('range', async (ctx) => {
  const args = ctx.match?.trim().split(/\s+/);
  if (!args || args.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(args[0]) || !/^\d{4}-\d{2}-\d{2}$/.test(args[1])) {
    await ctx.reply('請提供日期區間，例如：/range 2026-01-01 2026-03-31');
    return;
  }

  const startDate = args[0];
  const endDate = args[1];
  const userId = ctx.from?.id?.toString() || '';
  const invoices = getInvoices({ startDate, endDate, userId, limit: 100 });

  if (invoices.length === 0) {
    await ctx.reply(`📅 ${startDate} ~ ${endDate} 期間沒有發票紀錄`);
    return;
  }

  let totalAmount = 0;
  let msg = `📅 ${startDate} ~ ${endDate} 發票清單：\n\n`;
  for (const inv of invoices) {
    const company = inv.is_company ? ' 🏢' : '';
    msg += `#${inv.id} | ${inv.date} | ${inv.vendor} | $${inv.amount.toLocaleString()} | ${inv.category}${company}\n`;
    totalAmount += inv.amount;
  }

  msg += `\n---\n`;
  msg += `📊 合計：${invoices.length} 筆 / $${totalAmount.toLocaleString()}`;

  await ctx.reply(msg);
});

// Callback query handler for category changes
bot.callbackQuery(/^cat_(\d+)_(.+)$/, async (ctx) => {
  const match = ctx.match!;
  const invoiceId = parseInt(match[1], 10);
  const category = match[2];

  const success = updateInvoiceCategory(invoiceId, category);
  if (success) {
    await ctx.editMessageText(`分類已更新為: ${category}`);
  }
  await ctx.answerCallbackQuery();
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

    // Duplicate invoice number detection
    if (ocrResult.invoice_number) {
      const existing = findByInvoiceNumber(ocrResult.invoice_number);
      if (existing) {
        await ctx.reply(`⚠️ 重複發票！發票號碼 ${ocrResult.invoice_number} 已存在（#${existing.id}，由 ${existing.user_name} 於 ${existing.date} 上傳）。本次不上傳。`);
        return;
      }
    }

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

    const keyboard = new InlineKeyboard()
      .text('餐飲', `cat_${id}_餐飲`)
      .text('交通', `cat_${id}_交通`)
      .text('辦公用品', `cat_${id}_辦公用品`)
      .text('日用品', `cat_${id}_日用品`)
      .text('其他', `cat_${id}_其他`);

    await ctx.reply(msg, { reply_markup: keyboard });
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

    // Duplicate invoice number detection
    if (ocrResult.invoice_number) {
      const existing = findByInvoiceNumber(ocrResult.invoice_number);
      if (existing) {
        await ctx.reply(`⚠️ 重複發票！發票號碼 ${ocrResult.invoice_number} 已存在（#${existing.id}，由 ${existing.user_name} 於 ${existing.date} 上傳）。本次不上傳。`);
        return;
      }
    }

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

    const keyboard = new InlineKeyboard()
      .text('餐飲', `cat_${id}_餐飲`)
      .text('交通', `cat_${id}_交通`)
      .text('辦公用品', `cat_${id}_辦公用品`)
      .text('日用品', `cat_${id}_日用品`)
      .text('其他', `cat_${id}_其他`);

    await ctx.reply(
      `✅ 發票已建檔 #${id}\n\n📅 ${ocrResult.date} | 🏪 ${ocrResult.vendor}\n💰 $${ocrResult.amount.toLocaleString()} | 📂 ${ocrResult.category}${companyTag}`,
      { reply_markup: keyboard }
    );
  } catch (error) {
    console.error('OCR error:', error);
    const errMsg = error instanceof Error ? error.message : '未知錯誤';
    await ctx.reply(`❌ 辨識失敗：${errMsg}\n請確認圖片清晰後重試`);
  }
});

// /panel command - group quick action panel
bot.command('panel', async (ctx) => {
  const keyboard = new InlineKeyboard()
    .text('📊 本月統計', 'panel_stats')
    .text('📋 最近發票', 'panel_list')
    .text('🏢 公司進項', 'panel_company')
    .row()
    .text('🔍 搜尋發票', 'panel_search')
    .text('📅 全年統計', 'panel_yearly')
    .text('👥 全部發票', 'panel_listall')
    .row()
    .text('🤖 CEO 總管', 'panel_ceo')
    .text('🔍 情報中心', 'panel_intel')
    .text('💰 財務分析', 'panel_fin');

  await ctx.reply(
    `🧾 恩加斯達快捷面板\n\n點擊按鈕快速操作：`,
    { reply_markup: keyboard }
  );
});

// Panel button handlers
bot.callbackQuery('panel_stats', async (ctx) => {
  await ctx.answerCallbackQuery();
  const now = new Date();
  const start = format(startOfMonth(now), 'yyyy-MM-dd');
  const end = format(endOfMonth(now), 'yyyy-MM-dd');
  const stats = getStats(start, end);
  const monthLabel = format(now, 'yyyy年MM月');
  let msg = `📊 ${monthLabel} 全部消費統計\n\n`;
  msg += `📝 發票數量：${stats.total.count} 張\n`;
  msg += `💰 總金額：$${stats.total.total_amount.toLocaleString()}\n`;
  msg += `💵 總稅額：$${stats.total.total_tax.toLocaleString()}\n`;
  if (stats.company.count > 0) {
    msg += `\n🏢 公司進項：${stats.company.count} 張 / $${stats.company.total_amount.toLocaleString()}\n`;
    msg += `   可扣抵稅額：$${stats.company.total_tax.toLocaleString()}`;
  }
  if (stats.byCategory.length > 0) {
    msg += `\n\n📂 分類明細：\n`;
    for (const cat of stats.byCategory) {
      msg += `  ${cat.category}：${cat.count} 筆 / $${cat.total_amount.toLocaleString()}\n`;
    }
  }
  await ctx.reply(msg);
});

bot.callbackQuery('panel_list', async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id?.toString() || '';
  const invoices = getInvoices({ limit: 10, userId });
  if (invoices.length === 0) { await ctx.reply('目前沒有任何發票紀錄'); return; }
  let msg = `📋 最近 ${invoices.length} 筆發票：\n\n`;
  for (const inv of invoices) {
    const company = inv.is_company ? ' 🏢' : '';
    msg += `#${inv.id} | ${inv.date} | ${inv.vendor} | $${inv.amount.toLocaleString()} | ${inv.category}${company}\n`;
  }
  await ctx.reply(msg);
});

bot.callbackQuery('panel_company', async (ctx) => {
  await ctx.answerCallbackQuery();
  const now = new Date();
  const start = format(startOfMonth(now), 'yyyy-MM-dd');
  const end = format(endOfMonth(now), 'yyyy-MM-dd');
  const invoices = getInvoices({ startDate: start, endDate: end, isCompany: true });
  if (invoices.length === 0) { await ctx.reply('本月沒有公司進項發票'); return; }
  let msg = `🏢 本月公司進項發票：\n\n`;
  let total = 0, totalTax = 0;
  for (const inv of invoices) {
    msg += `#${inv.id} | ${inv.date} | ${inv.vendor} | $${inv.amount.toLocaleString()} | 稅 $${inv.tax_amount.toLocaleString()}\n`;
    total += inv.amount; totalTax += inv.tax_amount;
  }
  msg += `\n合計：${invoices.length} 張 / $${total.toLocaleString()}\n可扣抵稅額：$${totalTax.toLocaleString()}`;
  await ctx.reply(msg);
});

bot.callbackQuery('panel_search', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply('請輸入搜尋指令：\n/search 關鍵字\n\n例如：/search 交通');
});

bot.callbackQuery('panel_yearly', async (ctx) => {
  await ctx.answerCallbackQuery();
  const year = new Date().getFullYear();
  const stats = getStats(`${year}-01-01`, `${year}-12-31`);
  let msg = `📅 ${year} 年度統計\n\n`;
  msg += `📝 發票數量：${stats.total.count} 張\n`;
  msg += `💰 總金額：$${stats.total.total_amount.toLocaleString()}\n`;
  msg += `💵 總稅額：$${stats.total.total_tax.toLocaleString()}\n`;
  if (stats.company.count > 0) {
    msg += `\n🏢 公司進項：${stats.company.count} 張 / $${stats.company.total_amount.toLocaleString()}\n`;
    msg += `   可扣抵稅額：$${stats.company.total_tax.toLocaleString()}`;
  }
  if (stats.byCategory.length > 0) {
    msg += `\n\n📂 分類明細：\n`;
    for (const cat of stats.byCategory) {
      msg += `  ${cat.category}：${cat.count} 筆 / $${cat.total_amount.toLocaleString()}\n`;
    }
  }
  await ctx.reply(msg);
});

bot.callbackQuery('panel_listall', async (ctx) => {
  await ctx.answerCallbackQuery();
  const invoices = getInvoices({ limit: 20 });
  if (invoices.length === 0) { await ctx.reply('目前沒有任何發票紀錄'); return; }
  let msg = `👥 全部使用者最近 ${invoices.length} 筆發票：\n\n`;
  for (const inv of invoices) {
    const company = inv.is_company ? ' 🏢' : '';
    const user = inv.user_name || '未知';
    msg += `#${inv.id} | ${inv.date} | ${inv.vendor} | $${inv.amount.toLocaleString()} | ${inv.category}${company} | 👤${user}\n`;
  }
  await ctx.reply(msg);
});

// === CEO Sub-menu ===
bot.callbackQuery('panel_ceo', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
`🤖 CEO 總管 @NPlusStarBot

直接複製發送以下指令：

📋 每日匯報
@NPlusStarBot 請做今日工作匯報，彙整各部門進度和待辦事項

📊 營運分析
@NPlusStarBot 請分析公司目前營運狀況，包括專案進度、財務健康、潛在風險

💼 投標評估
@NPlusStarBot 請評估是否值得投標，從技術、財務、競爭三個角度分析

⚡ 緊急事項
@NPlusStarBot 列出目前需要緊急處理的前3件事和建議行動

🎯 策略建議
@NPlusStarBot 根據目前市場和公司資源，給出下個月策略方向

📋 週計畫
@NPlusStarBot 請幫我規劃本週工作重點，給出優先級排序`
  );
});

// === Intelligence Sub-menu ===
bot.callbackQuery('panel_intel', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
`🔍 情報中心 @NPSinteligence_bot

直接複製發送以下指令：

📢 今日標案
@NPSinteligence_bot 搜尋今天最新的消防、機電、水電公共工程標案

🏗️ 消防標案
@NPSinteligence_bot 搜尋近期消防工程標案，預算300萬以上，北部優先

📈 市場趨勢
@NPSinteligence_bot 分析目前MEP工程市場趨勢，價格走勢和需求變化

🔎 競爭動態
@NPSinteligence_bot 分析主要競爭對手的近期動態和策略

🗞️ 產業新聞
@NPSinteligence_bot 整理本週消防工程、建築法規、公共工程相關重要新聞

💡 商機分析
@NPSinteligence_bot 分析目前有哪些潛在商機值得公司關注和跟進`
  );
});

// === Finance Sub-menu ===
bot.callbackQuery('panel_fin', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(
`💰 財務分析 @NPSfiance_bot

直接複製發送以下指令：

📊 月度財報
@NPSfiance_bot 產出上個月完整財務報告，含分類統計、公司進項、預算對比

💵 現金流預測
@NPSfiance_bot 預測未來3個月現金流狀況，標記資金風險

📈 KPI 儀表板
@NPSfiance_bot 產出本月財務健康KPI，含毛利率、淨利率、應收帳款週轉率

🧾 稅務摘要
@NPSfiance_bot 整理本期稅務摘要，統計進項發票可扣抵稅額

⚠️ 費用異常
@NPSfiance_bot 檢查近期有無異常費用，對比歷史平均找出偏差

💼 專案財務
@NPSfiance_bot 分析進行中專案的財務狀況，含成本結構和利潤率`
  );
});

// === Back to main panel ===
bot.callbackQuery('panel_back', async (ctx) => {
  await ctx.answerCallbackQuery();
  const keyboard = new InlineKeyboard()
    .text('📊 本月統計', 'panel_stats')
    .text('📋 最近發票', 'panel_list')
    .text('🏢 公司進項', 'panel_company')
    .row()
    .text('🔍 搜尋發票', 'panel_search')
    .text('📅 全年統計', 'panel_yearly')
    .text('👥 全部發票', 'panel_listall')
    .row()
    .text('🤖 CEO 總管', 'panel_ceo')
    .text('🔍 情報中心', 'panel_intel')
    .text('💰 財務分析', 'panel_fin');
  await ctx.editMessageText('🧾 恩加斯達快捷面板\n\n點擊按鈕快速操作：', { reply_markup: keyboard });
});

// Set bot command menu
bot.api.setMyCommands([
  { command: 'start', description: '開始使用' },
  { command: 'help', description: '使用說明' },
  { command: 'stats', description: '本月消費統計' },
  { command: 'list', description: '最近發票（自己的）' },
  { command: 'company', description: '公司進項發票' },
  { command: 'search', description: '搜尋發票（商家/號碼）' },
  { command: 'range', description: '日期範圍查詢' },
  { command: 'all', description: '全部使用者統計' },
  { command: 'listall', description: '全部使用者發票' },
  { command: 'delete', description: '刪除發票' },
  { command: 'panel', description: '快捷面板' },
]).catch(console.error);

// Start bot
bot.start({
  onStart: () => {
    console.log('🤖 Invoice Bot is running!');
  },
});
