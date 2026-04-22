import fs from 'fs';
import type { OcrResult } from '../types/index.js';

const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY || '';
const VISION_URL = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_API_KEY}`;

async function extractText(imagePath: string): Promise<string> {
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString('base64');

  const body = {
    requests: [
      {
        image: { content: base64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      },
    ],
  };

  const res = await fetch(VISION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Vision API error: ${err}`);
  }

  const data = await res.json();
  const text = data.responses?.[0]?.fullTextAnnotation?.text || '';

  if (!text) {
    throw new Error('圖片中未偵測到文字，請確認圖片清晰');
  }

  return text;
}

function parseInvoiceText(text: string): OcrResult {
  const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);

  // Invoice number: XX-12345678 pattern
  const invoiceNumMatch = text.match(/([A-Z]{2})-?(\d{8})/);
  const invoice_number = invoiceNumMatch ? `${invoiceNumMatch[1]}-${invoiceNumMatch[2]}` : '';

  // Date: various formats
  const datePatterns = [
    /(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/,           // 2024/01/15 or 2024-01-15
    /(\d{3})[/\-.](\d{1,2})[/\-.](\d{1,2})/,            // 113/01/15 (ROC year)
    /(\d{3})年(\d{1,2})月(\d{1,2})日/,                    // 113年01月15日
    /中華民國\s*(\d{3})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})/, // 中華民國 113 年 01 月 15 日
  ];

  let date = new Date().toISOString().slice(0, 10);
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      let year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);
      // ROC year conversion
      if (year < 200) year += 1911;
      // Validate year is reasonable (2020-2030)
      if (year < 2020 || year > 2030) year = new Date().getFullYear();
      if (month < 1 || month > 12) continue;
      if (day < 1 || day > 31) continue;
      date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      break;
    }
  }

  // Tax ID (買方統一編號): 8-digit number
  // Must distinguish buyer (買方/買受人) from seller (賣方/營業人)
  const buyerTaxIdPatterns = [
    /買受人[統一]*編號[：:\s]*(\d{8})/,
    /買方[統一]*編號[：:\s]*(\d{8})/,
    /買受人.*?統編[：:\s]*(\d{8})/,
    /買\s*方[：:\s]*(\d{8})/,
    /B[．.]?U[．.]?Y[．.]?E[．.]?R.*?(\d{8})/i,
  ];
  let tax_id: string | null = null;
  for (const pattern of buyerTaxIdPatterns) {
    const match = text.match(pattern);
    if (match) {
      tax_id = match[1];
      break;
    }
  }

  // Amounts
  const amountPatterns = [
    /總[計額金][：:\s]*\$?\s*([\d,]+)/,
    /合\s*計[：:\s]*\$?\s*([\d,]+)/,
    /TOTAL[：:\s]*\$?\s*([\d,]+)/i,
    /金\s*額[：:\s]*\$?\s*([\d,]+)/,
  ];
  let amount = 0;
  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match) {
      amount = parseInt(match[1].replace(/,/g, ''), 10);
      break;
    }
  }

  // If no total found, try to find the largest number as amount
  if (amount === 0) {
    const allNumbers = text.match(/\$?\s*(\d{1,3}(?:,\d{3})*|\d+)/g) || [];
    const nums = allNumbers
      .map((n: string) => parseInt(n.replace(/[$,\s]/g, ''), 10))
      .filter((n: number) => n > 0 && n < 10000000);
    if (nums.length > 0) {
      amount = Math.max(...nums);
    }
  }

  // Tax amount
  const taxPatterns = [
    /稅\s*額[：:\s]*\$?\s*([\d,]+)/,
    /營業稅[：:\s]*\$?\s*([\d,]+)/,
    /TAX[：:\s]*\$?\s*([\d,]+)/i,
  ];
  let tax_amount = 0;
  for (const pattern of taxPatterns) {
    const match = text.match(pattern);
    if (match) {
      tax_amount = parseInt(match[1].replace(/,/g, ''), 10);
      break;
    }
  }

  // Pre-tax amount
  const pretaxPatterns = [
    /未稅[：:\s]*\$?\s*([\d,]+)/,
    /銷售額[：:\s]*\$?\s*([\d,]+)/,
    /小\s*計[：:\s]*\$?\s*([\d,]+)/,
  ];
  let pretax_amount = 0;
  for (const pattern of pretaxPatterns) {
    const match = text.match(pattern);
    if (match) {
      pretax_amount = parseInt(match[1].replace(/,/g, ''), 10);
      break;
    }
  }

  if (pretax_amount === 0 && tax_amount > 0) {
    pretax_amount = amount - tax_amount;
  } else if (pretax_amount === 0) {
    pretax_amount = amount;
  }

  if (tax_amount === 0 && amount > 0) {
    // Estimate 5% tax for Taiwan invoices
    tax_amount = Math.round(amount / 1.05 * 0.05);
    pretax_amount = amount - tax_amount;
  }

  // Vendor: usually first few lines or after specific keywords
  let vendor = '未知商家';
  const vendorPatterns = [
    /賣方[：:\s]*(.+)/,
    /商店[：:\s]*(.+)/,
    /店名[：:\s]*(.+)/,
    /營業人[名稱]*[：:\s]*(.+)/,
  ];
  for (const pattern of vendorPatterns) {
    const match = text.match(pattern);
    if (match) {
      const v = match[1].trim().slice(0, 30);
      // Skip if it's just a number (tax ID)
      if (!/^\d+$/.test(v)) {
        vendor = v;
        break;
      }
    }
  }
  // Fallback: look for company name patterns (XX有限公司, XX股份有限公司, XX企業社, etc.)
  if (vendor === '未知商家') {
    const companyMatch = text.match(/([^\n\s]{2,15}(?:有限公司|股份有限公司|企業社|商行|工作室|行銷))/);
    if (companyMatch) {
      vendor = companyMatch[1];
    }
  }
  // Fallback: use first non-date, non-number, non-short meaningful line
  if (vendor === '未知商家' && lines.length > 0) {
    for (const line of lines.slice(0, 5)) {
      if (line.length >= 2 && line.length <= 30 && !/^\d+$/.test(line) && !/\d{4}[/\-]/.test(line) && !/^\d{8}$/.test(line)) {
        vendor = line;
        break;
      }
    }
  }

  // Category guessing based on keywords
  const categoryKeywords: Record<string, string[]> = {
    '餐飲': ['餐', '飲', '食', '咖啡', '茶', '便當', '麵', '飯', '早餐', '午餐', '晚餐', '小吃', '火鍋', '壽司', '麥當勞', '星巴克', '7-11', '全家'],
    '交通': ['停車', '加油', '油資', '高鐵', '台鐵', '捷運', '計程車', 'Uber', '交通', 'PARKING', '中油', '車費', '車資', '過路費', 'ETC', '瑞芳'],
    '辦公用品': ['文具', '紙', '墨水', '辦公', '影印', '列印', '碳粉'],
    '水電費': ['水費', '電費', '台電', '台水', '瓦斯', '天然氣'],
    '電信費': ['電信', '中華電', '遠傳', '台灣大', '月租', '網路費'],
    '日用品': ['超市', '量販', '家樂福', '全聯', '好市多', '大潤發', '日用', '衛生紙', '洗衣'],
    '娛樂': ['電影', '遊戲', 'KTV', '旅遊', '門票', '遊樂'],
    '醫療': ['醫', '藥', '診所', '醫院', '牙', '眼科', '健保'],
  };

  let category = '其他';
  const textLower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => textLower.includes(kw.toLowerCase()))) {
      category = cat;
      break;
    }
  }

  // Items: try to parse line items (basic)
  const items: { name: string; quantity: number; price: number }[] = [];
  const itemPattern = /(.+?)\s+(\d+)\s*[xX×]\s*\$?([\d,]+)/g;
  let itemMatch;
  while ((itemMatch = itemPattern.exec(text)) !== null) {
    items.push({
      name: itemMatch[1].trim(),
      quantity: parseInt(itemMatch[2], 10),
      price: parseInt(itemMatch[3].replace(/,/g, ''), 10),
    });
  }

  return {
    date,
    vendor,
    tax_id,
    amount,
    tax_amount,
    pretax_amount,
    category,
    items,
    invoice_number,
  };
}

export async function recognizeInvoice(imagePath: string): Promise<OcrResult> {
  if (!GOOGLE_API_KEY) {
    throw new Error('請設定 GOOGLE_CLOUD_API_KEY 環境變數');
  }

  const text = await extractText(imagePath);
  console.log('OCR text:', text.slice(0, 200));

  return parseInvoiceText(text);
}
