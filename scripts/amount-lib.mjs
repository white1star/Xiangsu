// 金额抽取库：表格感知 + 标签宽窗 + “第一个金额”兜底
export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function rawGet(url) {
  const r = await fetch(url, {
    headers: {
      'user-agent': UA,
      'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'zh-CN,zh;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });
  return { status: r.status, html: r.status === 200 ? await r.text() : '' };
}

// 带重试的抓取：空壳(正文过短)也算失败，重试；正文过短时自动跟进 iframe
export async function fetchSolid(url, { retries = 4, minBody = 500, baseDelay = 1500 } = {}) {
  let lastErr = null;
  for (let i = 0; i < retries; i++) {
    try {
      const { status, html } = await rawGet(url);
      if (status === 200) {
        let body = htmlText(html);
        if (body.length >= minBody) return { ok: true, html, body, status: 200 };
        // 正文过短 → 尝试 iframe 内嵌正文
        const ifr = /<iframe[^>]*src\s*=\s*["']([^"']+)["']/i.exec(html);
        if (ifr) {
          // 相对路径可能相对当前目录，也可能相对站点根，两种都试
          const cands = [];
          try { cands.push(new URL(ifr[1], url).href); } catch { /* ignore */ }
          try { cands.push(new URL('/' + ifr[1].replace(/^\/+/, ''), url).href); } catch { /* ignore */ }
          for (const sub of [...new Set(cands)]) {
            try {
              const r2 = await rawGet(sub);
              if (r2.status !== 200) continue;
              const b2 = htmlText(r2.html);
              if (b2.length >= 200) {
                // 合并：外壳(含标题) + iframe 正文
                return { ok: true, html: html + '\n' + r2.html, body: body + ' ' + b2, status: 200, viaIframe: true };
              }
            } catch { /* ignore */ }
          }
        }
        // 正文为 PDF 的占位页，直接判定，不必重试
        if (/无文本内容[，,]?\s*请查阅pdf/i.test(body)) {
          return { ok: false, html, body, err: 'pdf-only' };
        }
        lastErr = `shell(body=${body.length})`;
      } else {
        lastErr = `http ${status}`;
        if (status === 404 || status === 410) break; // 死链不重试
      }
    } catch (e) {
      lastErr = e.name === 'TimeoutError' || e.cause?.code === 'UND_ERR_CONNECT_TIMEOUT'
        ? 'timeout' : (e.cause?.code || e.message || String(e)).slice(0, 60);
    }
    await sleep(baseDelay * (i + 1) + Math.random() * 800); // 递增退避
  }
  return { ok: false, html: '', body: '', err: lastErr };
}

export function htmlText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    // 部分站点把数字拆进不同标签（如“20 26 年”“1 643 146.99 元”），粘合数字与单位
    .replace(/(\d)\s+(?=\d)/g, '$1')
    .replace(/(\d)\s+(?=万元|万|元)/g, '$1')
    .trim();
}

// 单元格纯文本
function cellText(h) {
  return h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

const NUM = '([\\d][\\d,，]{0,20}(?:\\.\\d+)?)';
const UNIT = '(万元|万|元)';

// 噪声：编号/电话/邮编/账号/时间 等前缀
const NOISE_BEFORE = /(编\s*号|标\s*段\s*号|电\s*话|传\s*真|手\s*机|邮\s*编|账\s*号|开\s*户|证\s*号|地\s*址|第|包\s*号|序\s*号)[^\u4e00-\u9fa5]{0,6}$/;
// 非交易金额：保证金/注册资本/标书费等，绝不能当成中标价或控制价
const NOT_DEAL_MONEY = /(保\s*证\s*金|注\s*册\s*资\s*本|注\s*册\s*资\s*金|标\s*书\s*费|文\s*件\s*售\s*价|文\s*件\s*工\s*本\s*费|工\s*本\s*费|服\s*务\s*费|代\s*理\s*费|手\s*续\s*费|违\s*约\s*金|罚\s*款|实\s*收\s*资\s*本|净\s*资\s*产|营\s*业\s*额|年\s*产\s*值|资\s*产\s*总\s*额)/;

function toYuan(numStr, unit) {
  const n = parseFloat(String(numStr).replace(/[,，]/g, ''));
  if (!isFinite(n) || n <= 0) return null;
  if (unit === '万元' || unit === '万') return n * 10000;
  return n;
}

export function fmtAmount(yuan) {
  if (!yuan || !isFinite(yuan)) return null;
  if (yuan >= 10000) {
    const wan = yuan / 10000;
    const s = wan >= 100 ? wan.toFixed(2) : wan.toFixed(4);
    return `${s.replace(/\.?0+$/, '')}万元`;
  }
  return `${yuan.toFixed(2).replace(/\.?0+$/, '')}元`;
}

// 合理金额区间：1万 ~ 100亿，排除年份/数量等
function plausible(yuan, unit, rawDigits) {
  if (yuan == null) return false;
  if (yuan < 10000) return false;              // 小于1万，多为标书费/数量
  if (yuan > 1e10) return false;               // 大于100亿，异常
  if (unit === '元' && rawDigits.replace(/[,，.]/g, '').length < 5) return false;
  return true;
}

/**
 * 从 HTML 表格中按表头列名定位金额（候选人公示表最常见）
 * 返回按表格出现顺序的金额数组
 */
export function extractFromTables(html) {
  const out = [];
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const priceHeader = /(投\s*标\s*报\s*价|中\s*标\s*价|成\s*交\s*价|报\s*价|中\s*标\s*金\s*额|投\s*标\s*总\s*价|评\s*标\s*价|最\s*终\s*报\s*价|合\s*同\s*金\s*额)/;
  for (const tb of tables) {
    const rows = tb.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    if (rows.length < 2) continue;
    // 找表头行 & 价格列索引（全表扫描，表头常在标题/项目信息行之后）
    let priceCol = -1, headerRow = -1, headerUnit = null;
    for (let i = 0; i < rows.length; i++) {
      const cells = (rows[i].match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(cellText);
      const idx = cells.findIndex(c => priceHeader.test(c) && c.length <= 24);
      if (idx >= 0) {
        priceCol = idx; headerRow = i;
        // 单位常写在表头括号里：投标报价（元）/ 中标价（万元）
        const hu = /[（(]\s*(万元|万|元)\s*[)）]/.exec(cells[idx]);
        headerUnit = hu ? hu[1] : null;
        break;
      }
    }
    if (priceCol < 0) continue;
    // 读该列后续数据行
    for (let i = headerRow + 1; i < rows.length; i++) {
      const cells = (rows[i].match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(cellText);
      // rowspan 会使后续行少一格，列索引左移；两个位置都试
      const cands = [];
      if (priceCol < cells.length) cands.push(cells[priceCol]);
      if (priceCol - 1 >= 0 && priceCol - 1 < cells.length) cands.push(cells[priceCol - 1]);
      for (const txt of cands) {
        if (!txt) continue;
        const m = new RegExp(NUM + '\\s*' + UNIT + '?').exec(txt);
        if (!m) continue;
        // 该格必须以数字为主（避免抓到名称/证号里的数字）
        const digits = (txt.match(/\d/g) || []).length;
        if (digits / Math.max(txt.length, 1) < 0.5) continue;
        const unit = m[2] || headerUnit || (/万/.test(txt) ? '万元' : '元');
        const y = toYuan(m[1], unit);
        if (plausible(y, unit, m[1])) { out.push({ yuan: y, src: 'table' }); break; }
      }
    }
    // 纵向表：左列是标签、右列是值
    if (!out.length) {
      for (const row of rows) {
        const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(cellText);
        for (let c = 0; c < cells.length - 1; c++) {
          if (priceHeader.test(cells[c]) && cells[c].length <= 20) {
            const m = new RegExp(NUM + '\\s*' + UNIT + '?').exec(cells[c + 1]);
            if (m) {
              const unit = m[2] || (/万/.test(cells[c + 1]) ? '万元' : '元');
              const y = toYuan(m[1], unit);
              if (plausible(y, unit, m[1])) out.push({ yuan: y, src: 'table-v' });
            }
          }
        }
      }
    }
  }
  return out;
}

/** 标签 + 宽窗（标签后 120 字符内第一个金额） */
export function extractLabeled(body) {
  const labels = [
    { kind: 'bid', re: /中\s*标\s*(?:价\s*格|金\s*额|价)/g },
    { kind: 'bid', re: /成\s*交\s*(?:价\s*格|金\s*额|价)/g },
    { kind: 'bid', re: /投\s*标\s*报\s*价/g },
    { kind: 'bid', re: /合\s*同\s*(?:价\s*款|金\s*额)/g },
    { kind: 'bid', re: /报\s*价/g },
    { kind: 'ctrl', re: /招\s*标\s*控\s*制\s*价/g },
    { kind: 'ctrl', re: /最\s*高\s*(?:投\s*标\s*)?限\s*价/g },
    { kind: 'ctrl', re: /控\s*制\s*价/g },
    { kind: 'ctrl', re: /预\s*算\s*(?:金\s*额|价)?/g },
    { kind: 'ctrl', re: /采\s*购\s*预\s*算/g },
  ];
  const found = { bid: [], ctrl: [] };
  for (const { kind, re } of labels) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(body)) !== null) {
      const after = m.index + m[0].length;
      const win = body.slice(after, after + 120);
      const mm = new RegExp(NUM + '\\s*' + UNIT).exec(win);
      if (mm) {
        const y = toYuan(mm[1], mm[2]);
        if (plausible(y, mm[2], mm[1])) { found[kind].push(y); continue; }
      }
      // 单位写在标签括号里：投标报价（元） 16431464.99
      const hu = /^\s*[（(]\s*(万元|万|元)\s*[)）]/.exec(win);
      if (hu) {
        const bare = new RegExp(NUM).exec(win.slice(hu[0].length, hu[0].length + 120));
        if (bare) {
          const y = toYuan(bare[1], hu[1]);
          if (plausible(y, hu[1], bare[1])) found[kind].push(y);
        }
      }
    }
  }
  return found;
}

/** 兜底：正文中第一个“像钱”的数字（带单位） */
export function extractFirstAmount(body) {
  const re = new RegExp(NUM + '\\s*' + UNIT, 'g');
  let m;
  while ((m = re.exec(body)) !== null) {
    const before = body.slice(Math.max(0, m.index - 12), m.index);
    if (NOISE_BEFORE.test(before)) continue;
    // 保证金/注册资本/标书费等非交易金额：看前 30 字符是否命中
    if (NOT_DEAL_MONEY.test(body.slice(Math.max(0, m.index - 30), m.index))) continue;
    // 排除日期上下文：2026年 / 2026-06
    if (/^\d{4}$/.test(m[1].replace(/[,，]/g, '')) && /[年\-\/]/.test(body.slice(m.index + m[0].length, m.index + m[0].length + 2))) continue;
    const y = toYuan(m[1], m[2]);
    if (plausible(y, m[2], m[1])) return y;
  }
  return null;
}

/**
 * 综合抽取：返回 { amount, budget, source }
 * bidStatus: 中标候选人 / 已中标 → 优先成交类；招标公告 → 优先控制价/预算
 */
export function extractAmount(html, body, bidStatus) {
  const isAward = /中标|成交|候选/.test(bidStatus || '');
  const tables = extractFromTables(html);
  const labeled = extractLabeled(body);

  let amountYuan = null, budgetYuan = null, source = '';

  if (isAward) {
    // 中标/候选：表格里第一个报价 → 标签成交价 → 兜底第一个金额
    if (tables.length) { amountYuan = tables[0].yuan; source = 'table'; }
    if (!amountYuan && labeled.bid.length) { amountYuan = labeled.bid[0]; source = 'label'; }
    if (!amountYuan) { const f = extractFirstAmount(body); if (f) { amountYuan = f; source = 'first'; } }
    if (labeled.ctrl.length) budgetYuan = labeled.ctrl[0];
  } else {
    // 招标公告：控制价/预算 → 表格 → 兜底
    if (labeled.ctrl.length) { amountYuan = labeled.ctrl[0]; source = 'label-ctrl'; }
    if (!amountYuan && tables.length) { amountYuan = tables[0].yuan; source = 'table'; }
    if (!amountYuan && labeled.bid.length) { amountYuan = labeled.bid[0]; source = 'label-bid'; }
    if (!amountYuan) { const f = extractFirstAmount(body); if (f) { amountYuan = f; source = 'first'; } }
    if (labeled.ctrl.length) budgetYuan = labeled.ctrl[0];
  }

  return {
    amount: fmtAmount(amountYuan),
    budget: fmtAmount(budgetYuan),
    source,
    tableCount: tables.length,
  };
}

/** 中标人/候选人 */
export function extractWinnerName(html, body) {
  // 表格：第一候选人/中标人 列
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const nameHeader = /(投\s*标\s*人|供\s*应\s*商|候\s*选\s*人|中\s*标\s*人|单\s*位\s*名\s*称|公\s*司\s*名\s*称|成\s*交\s*人)/;
  for (const tb of tables) {
    const rows = tb.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    let col = -1, hr = -1;
    for (let i = 0; i < Math.min(rows.length, 4); i++) {
      const cells = (rows[i].match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(cellText);
      const idx = cells.findIndex(c => nameHeader.test(c) && c.length <= 20);
      if (idx >= 0) { col = idx; hr = i; break; }
    }
    if (col < 0) continue;
    for (let i = hr + 1; i < rows.length; i++) {
      const cells = (rows[i].match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(cellText);
      if (col < cells.length) {
        const v = cells[col];
        if (/(公司|集团|研究院|厂|中心|所|大学|学院)/.test(v) && v.length >= 4 && v.length <= 40) return v;
      }
    }
  }
  // 文本标签
  const m = /(?:中\s*标\s*(?:人|单\s*位|供\s*应\s*商)|成\s*交\s*(?:人|供\s*应\s*商)|第\s*一\s*(?:名|中\s*标\s*)?候\s*选\s*人)\s*(?:名\s*称)?\s*[:：]?\s*(?:为|是)?\s*([\u4e00-\u9fa5A-Za-z0-9()（）]{4,60})/.exec(body);
  return m ? pickOrgName(m[1]) : null;
}

/** 从一段中文里取出最合理的机构全称（优先“公司/集团”，避免被“矿”提前截断） */
function pickOrgName(chunk) {
  if (!chunk) return null;
  const strong = /^([\u4e00-\u9fa5A-Za-z0-9()（）]{4,40}?(?:有限责任公司|股份有限公司|有限公司|集团公司|分公司|公司|集团))/.exec(chunk);
  if (strong) return strong[1];
  const weak = /^([\u4e00-\u9fa5A-Za-z0-9()（）]{4,40}?(?:研究院|矿业|煤矿|电厂|工厂|矿|厂|局|中心|处|院))/.exec(chunk);
  return weak ? weak[1] : null;
}

/** 采购人/招标人 */
export function extractBuyerName(body) {
  const m = /(?:采\s*购\s*人|招\s*标\s*人|建\s*设\s*单\s*位|采\s*购\s*单\s*位|招\s*标\s*单\s*位)\s*(?:名\s*称)?\s*[:：]?\s*(?:为|是)?\s*([\u4e00-\u9fa5A-Za-z0-9()（）]{4,60})/.exec(body);
  return m ? pickOrgName(m[1]) : null;
}
