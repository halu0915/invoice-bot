import { Bot, InlineKeyboard } from 'grammy';

// ── Config ──────────────────────────────────────────────────────────────────
const CEO_BOT_TOKEN = process.env.CEO_BOT_TOKEN || '8515087063:AAGwJ54bc4IAnYVVr7xxBwj4NaXbEWH85T8';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBiqf4ZACCExddBUxagkbhQYtpkzs0Bp74';
const INVOICE_API_URL = process.env.INVOICE_API_URL || 'https://invoice-bot-production-6d92.up.railway.app';
const INVOICE_API_TOKEN = process.env.INVOICE_API_TOKEN || '5566';

const bot = new Bot(CEO_BOT_TOKEN);

// ── System Prompts ──────────────────────────────────────────────────────────
const SYSTEM_PROMPTS = {
  ceo: '你是恩加斯達國際有限公司的 AI 執行長，負責統籌管理。你善於拆解問題、分派任務、做出決策。使用繁體中文。',
  intel: '你是恩加斯達國際的情報搜索專家，負責標案掃描、市場研究、競爭分析。專注 MEP 消防機電工程產業。使用繁體中文。',
  finance: '你是恩加斯達國際的財務分析專家，負責發票管理、成本分析、預算追蹤、稅務。你可以分析發票資料產出報告。使用繁體中文。',
} as const;

// ── AI sub-menu definitions ─────────────────────────────────────────────────
const AI_MENUS: Record<string, { title: string; role: keyof typeof SYSTEM_PROMPTS; buttons: { label: string; question: string }[] }> = {
  ceo: {
    title: '🤖 CEO 分析',
    role: 'ceo',
    buttons: [
      { label: '📋 週計畫', question: '請幫我規劃本週工作重點，給出優先級排序' },
      { label: '📊 營運分析', question: '請分析公司目前營運狀況，包括專案進度、財務健康、潛在風險' },
      { label: '💼 投標評估', question: '請評估近期是否值得投標，從技術、財務、競爭三個角度分析' },
      { label: '⚡ 緊急事項', question: '列出目前需要緊急處理的前3件事和建議行動' },
      { label: '🎯 進度追蹤', question: '請做今日工作匯報，彙整各部門進度和待辦事項' },
      { label: '🧭 策略建議', question: '根據目前市場和公司資源，給出下個月策略方向' },
    ],
  },
  intel: {
    title: '🔍 情報中心',
    role: 'intel',
    buttons: [
      { label: '📢 今日標案', question: '搜尋今天最新的消防、機電、水電公共工程標案' },
      { label: '🏗️ 消防標案', question: '搜尋近期消防工程標案，預算300萬以上，北部優先' },
      { label: '📈 市場趨勢', question: '分析目前MEP工程市場趨勢，價格走勢和需求變化' },
      { label: '🔎 競爭動態', question: '分析主要競爭對手的近期動態和策略' },
      { label: '🗞️ 產業新聞', question: '整理本週消防工程、建築法規、公共工程相關重要新聞' },
      { label: '💡 商機分析', question: '分析目前有哪些潛在商機值得公司關注和跟進' },
    ],
  },
  finance: {
    title: '💰 財務分析',
    role: 'finance',
    buttons: [
      { label: '📊 月度財報', question: '產出上個月完整財務報告，含分類統計、公司進項、預算對比' },
      { label: '💵 現金流預測', question: '預測未來3個月現金流狀況，標記資金風險' },
      { label: '📈 KPI 儀表板', question: '產出本月財務健康KPI，含毛利率、淨利率、應收帳款週轉率' },
      { label: '🧾 稅務摘要', question: '整理本期稅務摘要，統計進項發票可扣抵稅額' },
      { label: '⚠️ 費用異常', question: '檢查近期有無異常費用，對比歷史平均找出偏差' },
      { label: '💼 專案財務', question: '分析進行中專案的財務狀況，含成本結構和利潤率' },
    ],
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Call the invoice-bot Hono API */
async function invoiceApi(path: string): Promise<unknown> {
  const url = `${INVOICE_API_URL}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${INVOICE_API_TOKEN}` },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Call Gemini API */
async function askAgent(role: keyof typeof SYSTEM_PROMPTS, question: string): Promise<string> {
  const systemPrompt = SYSTEM_PROMPTS[role];
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: question }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
      }),
    },
  );
  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '無法取得回覆';
}

/** Build the main panel keyboard */
function mainPanelKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📊 本月統計', 'panel_stats')
    .text('📋 最近發票', 'panel_list')
    .text('🏢 公司進項', 'panel_company')
    .row()
    .text('🔍 搜尋發票', 'panel_search')
    .text('📅 全年統計', 'panel_yearly')
    .text('👥 全部發票', 'panel_listall')
    .row()
    .text('🤖 CEO 分析', 'panel_ceo')
    .text('🔍 情報中心', 'panel_intel')
    .text('💰 財務分析', 'panel_fin');
}

/** Format a date as YYYY-MM-DD */
function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Truncate long messages for Telegram (4096 char limit) */
function truncate(msg: string, max = 4000): string {
  if (msg.length <= max) return msg;
  return msg.slice(0, max) + '\n\n⋯（訊息過長，已截斷）';
}

// ── Commands ────────────────────────────────────────────────────────────────

bot.command('start', async (ctx) => {
  await ctx.reply(
    `🧾 恩加斯達總控面板

👋 歡迎使用 CEO Bot！

📊 /panel → 開啟總控面板
🤖 直接輸入文字 → AI 執行長對話

支援功能：
• 發票查詢統計（串接發票系統）
• CEO AI 分析與建議
• 情報中心（標案/市場/競爭）
• 財務分析與報告`,
  );
});

bot.command('panel', async (ctx) => {
  await ctx.reply('🧾 恩加斯達總控面板\n\n點擊按鈕快速操作：', {
    reply_markup: mainPanelKeyboard(),
  });
});

// ── Invoice panel callbacks ─────────────────────────────────────────────────

bot.callbackQuery('panel_stats', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const now = new Date();
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const end = fmtDate(now);
    const stats = (await invoiceApi(`/api/stats?startDate=${start}&endDate=${end}`)) as {
      total: { count: number; total_amount: number; total_tax: number };
      company: { count: number; total_amount: number; total_tax: number };
      byCategory: { category: string; count: number; total_amount: number }[];
    };
    const monthLabel = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月`;
    let msg = `📊 ${monthLabel} 消費統計\n\n`;
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
    await ctx.reply(truncate(msg));
  } catch (err) {
    await ctx.reply(`❌ 取得統計失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
  }
});

bot.callbackQuery('panel_list', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const invoices = (await invoiceApi('/api/invoices')) as {
      id: number; date: string; vendor: string; amount: number; category: string; is_company: boolean;
    }[];
    if (invoices.length === 0) {
      await ctx.reply('目前沒有任何發票紀錄');
      return;
    }
    let msg = `📋 最近發票：\n\n`;
    for (const inv of invoices.slice(0, 10)) {
      const company = inv.is_company ? ' 🏢' : '';
      msg += `#${inv.id} | ${inv.date} | ${inv.vendor} | $${inv.amount.toLocaleString()} | ${inv.category}${company}\n`;
    }
    await ctx.reply(truncate(msg));
  } catch (err) {
    await ctx.reply(`❌ 取得發票失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
  }
});

bot.callbackQuery('panel_company', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const invoices = (await invoiceApi('/api/invoices?isCompany=true')) as {
      id: number; date: string; vendor: string; amount: number; tax_amount: number; is_company: boolean;
    }[];
    if (invoices.length === 0) {
      await ctx.reply('沒有公司進項發票');
      return;
    }
    let msg = `🏢 公司進項發票：\n\n`;
    let totalAmount = 0;
    let totalTax = 0;
    for (const inv of invoices) {
      msg += `#${inv.id} | ${inv.date} | ${inv.vendor} | $${inv.amount.toLocaleString()} | 稅 $${inv.tax_amount.toLocaleString()}\n`;
      totalAmount += inv.amount;
      totalTax += inv.tax_amount;
    }
    msg += `\n合計：${invoices.length} 張 / $${totalAmount.toLocaleString()}\n可扣抵稅額：$${totalTax.toLocaleString()}`;
    await ctx.reply(truncate(msg));
  } catch (err) {
    await ctx.reply(`❌ 取得公司進項失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
  }
});

bot.callbackQuery('panel_search', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply('🔍 請輸入搜尋指令：\n/search 關鍵字\n\n例如：/search 交通');
});

bot.callbackQuery('panel_yearly', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const year = new Date().getFullYear();
    const stats = (await invoiceApi(`/api/stats?startDate=${year}-01-01&endDate=${year}-12-31`)) as {
      total: { count: number; total_amount: number; total_tax: number };
      company: { count: number; total_amount: number; total_tax: number };
      byCategory: { category: string; count: number; total_amount: number }[];
    };
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
    await ctx.reply(truncate(msg));
  } catch (err) {
    await ctx.reply(`❌ 取得年度統計失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
  }
});

bot.callbackQuery('panel_listall', async (ctx) => {
  await ctx.answerCallbackQuery();
  try {
    const invoices = (await invoiceApi('/api/invoices')) as {
      id: number; date: string; vendor: string; amount: number; category: string; is_company: boolean; user_name?: string;
    }[];
    if (invoices.length === 0) {
      await ctx.reply('目前沒有任何發票紀錄');
      return;
    }
    let msg = `👥 全部使用者發票：\n\n`;
    for (const inv of invoices.slice(0, 20)) {
      const company = inv.is_company ? ' 🏢' : '';
      const user = inv.user_name || '未知';
      msg += `#${inv.id} | ${inv.date} | ${inv.vendor} | $${inv.amount.toLocaleString()} | ${inv.category}${company} | 👤${user}\n`;
    }
    await ctx.reply(truncate(msg));
  } catch (err) {
    await ctx.reply(`❌ 取得發票失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
  }
});

// ── AI sub-menu callbacks ───────────────────────────────────────────────────

// Show sub-menu for CEO / Intel / Finance
for (const [key, menu] of Object.entries(AI_MENUS)) {
  const callbackId = key === 'finance' ? 'panel_fin' : `panel_${key}`;

  bot.callbackQuery(callbackId, async (ctx) => {
    await ctx.answerCallbackQuery();
    const keyboard = new InlineKeyboard();
    for (let i = 0; i < menu.buttons.length; i++) {
      keyboard.text(menu.buttons[i].label, `ai_${key}_${i}`);
      if (i % 2 === 1) keyboard.row();
    }
    keyboard.row().text('⬅️ 返回主面板', 'panel_back');

    await ctx.reply(`${menu.title}\n\n選擇要詢問的項目：`, {
      reply_markup: keyboard,
    });
  });

  // Handle each AI button
  for (let i = 0; i < menu.buttons.length; i++) {
    bot.callbackQuery(`ai_${key}_${i}`, async (ctx) => {
      await ctx.answerCallbackQuery();
      const btn = menu.buttons[i];
      const thinkingMsg = await ctx.reply('🤔 正在思考...');
      try {
        const answer = await askAgent(menu.role, btn.question);
        await ctx.api.editMessageText(
          thinkingMsg.chat.id,
          thinkingMsg.message_id,
          truncate(`${menu.title} - ${btn.label}\n\n${answer}`),
        );
      } catch (err) {
        await ctx.api.editMessageText(
          thinkingMsg.chat.id,
          thinkingMsg.message_id,
          `❌ AI 回覆失敗：${err instanceof Error ? err.message : '未知錯誤'}`,
        );
      }
    });
  }
}

// ── Back to main panel ──────────────────────────────────────────────────────

bot.callbackQuery('panel_back', async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText('🧾 恩加斯達總控面板\n\n點擊按鈕快速操作：', {
    reply_markup: mainPanelKeyboard(),
  });
});

// ── /search command ─────────────────────────────────────────────────────────

bot.command('search', async (ctx) => {
  const keyword = ctx.match?.trim();
  if (!keyword) {
    await ctx.reply('請提供搜尋關鍵字，例如：/search 全聯');
    return;
  }
  try {
    const invoices = (await invoiceApi(`/api/invoices?search=${encodeURIComponent(keyword)}`)) as {
      id: number; date: string; vendor: string; amount: number; category: string; is_company: boolean; invoice_number?: string;
    }[];
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
    await ctx.reply(truncate(msg));
  } catch (err) {
    await ctx.reply(`❌ 搜尋失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
  }
});

// ── General text → CEO AI conversation ──────────────────────────────────────

bot.on('message:text', async (ctx) => {
  // Skip if it looks like a command
  if (ctx.message.text.startsWith('/')) return;

  const thinkingMsg = await ctx.reply('🤔 正在思考...');
  try {
    const answer = await askAgent('ceo', ctx.message.text);
    await ctx.api.editMessageText(
      thinkingMsg.chat.id,
      thinkingMsg.message_id,
      truncate(`🤖 CEO AI\n\n${answer}`),
    );
  } catch (err) {
    await ctx.api.editMessageText(
      thinkingMsg.chat.id,
      thinkingMsg.message_id,
      `❌ AI 回覆失敗：${err instanceof Error ? err.message : '未知錯誤'}`,
    );
  }
});

// ── Set bot commands ────────────────────────────────────────────────────────

bot.api.setMyCommands([
  { command: 'start', description: '開始使用' },
  { command: 'panel', description: '總控面板' },
  { command: 'search', description: '搜尋發票' },
]).catch(console.error);

// ── Start ───────────────────────────────────────────────────────────────────

bot.start({
  onStart: () => {
    console.log('🤖 CEO Bot is running!');
  },
});
