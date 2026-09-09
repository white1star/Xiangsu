#!/usr/bin/env node
/**
 * gzh_fetch.mjs — 公众号线索雷达（竞品情报流程 步骤 2.6）
 *
 * 链路：搜狗微信搜索（wechat-article-search 技能脚本）→ 解析真实 mp.weixin.qq.com 直链
 *       → HTTP 直接抓取正文全文 → 结构化输出（标题/公众号/日期/摘要/正文全文）。
 * 2026-09-09 实测打通：技能脚本 cookie 预热可绕过搜狗验证码；-r 解析直链成功；
 * mp 直链（src=11&timestamp&signature）带普通 PC UA 直接 GET 即返回含 js_content 的完整正文。
 *
 * 用法：
 *   node scripts/gzh_fetch.mjs "泰禾卓海" [-n 6] [-kw "中标|签约|喜报|成交|验收"] [-after 2026-01-01] [-o out.json]
 *   -n, --num         搜索结果数（默认 8，搜狗频控风险：单次≤8、全天别超 ~20 次调用）
 *   -kw, --keywords    本地按标题正则过滤（默认不过滤）
 *   -after, --after    只保留 datetime >= 该日期（YYYY-MM-DD，默认不过滤）
 *   -o, --output       输出 JSON 文件路径（可选，默认打印 stdout）
 *
 * 注意：
 *   - mp 直链为搜狗签发的临时授权链接（signature 有时效），解析后须立即抓正文；
 *   - 搜狗索引滞后：竞品公众号近期推文可能延迟数周才被收录，本工具用于"补漏雷达"，
 *     命中疑似交易信号（中标/签约等）后须回官方招标平台/权威媒体转载核验再落库；
 *   - 公众号内容为企业自宣，收录口径 confidence=中。
 */
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const SKILL_SCRIPT = 'C:/Users/Lenovo/.workbuddy/skills/wechat-article-search/scripts/search_wechat.js';
const { searchWechatArticles } = require(SKILL_SCRIPT);

const PC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

function parseArgs(argv) {
  const out = { query: '', num: 8, kw: '', after: '', output: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-n' || a === '--num') out.num = parseInt(argv[++i]) || 8;
    else if (a === '-kw' || a === '--keywords') out.kw = argv[++i] || '';
    else if (a === '-after' || a === '--after') out.after = argv[++i] || '';
    else if (a === '-o' || a === '--output') out.output = argv[++i] || '';
    else if (!a.startsWith('-')) out.query = a;
  }
  return out;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFromArticleHtml(html) {
  const title =
    html.match(/<h1[^>]*class="rich_media_title"[^>]*>([\s\S]*?)<\/h1>/)?.[1]
    || html.match(/<h1[^>]*id="activity-name"[^>]*>([\s\S]*?)<\/h1>/)?.[1]
    || html.match(/var msg_title = ['"]([^'"]+)['"]/)?.[1]
    || html.match(/<meta property="og:title" content="([^"]+)"/)?.[1]
    || '';
  const account =
    html.match(/var nickname = ['"]([^'"]+)['"]/)?.[1]
    || html.match(/<a[^>]*id="js_name"[^>]*>([\s\S]*?)<\/a>/)?.[1]
    || html.match(/<span[^>]*id="js_name"[^>]*>([\s\S]*?)<\/span>/)?.[1]
    || '';
  // 正文容器（取最长的匹配，避免截断到第一个 </div>）
  let body = '';
  const contentMatch = html.match(/<div[^>]*id="js_content"[^>]*>([\s\S]*?)(?:<\/div>\s*<script|<div[^>]*class="rich_media_tool)/);
  if (contentMatch) body = contentMatch[1];
  else {
    const parts = html.split(/id="js_content"/);
    if (parts.length > 1) {
      const rest = parts[1];
      body = rest.slice(0, rest.indexOf('</div>') >= 0 ? rest.indexOf('</div>') : rest.length);
    }
  }
  // 环境/校验/已删除标记
  const flags = [];
  if (/环境异常|环境验证|去验证/.test(html)) flags.push('环境验证页');
  if (/该内容已被发布者删除/.test(html)) flags.push('已删除');
  if (/此内容因违规无法查看|涉嫌违规/.test(html)) flags.push('违规不可看');
  if (!contentMatch && body.length < 50 && !/js_content/.test(html)) flags.push('疑似无正文(非文章页)');
  return {
    title: stripHtml(title),
    account: stripHtml(account),
    text: stripHtml(body),
    flags
  };
}

async function fetchArticle(url) {
  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': PC_UA, 'Accept-Language': 'zh-CN,zh;q=0.9', 'Accept': 'text/html,*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000)
    });
    const html = await resp.text();
    const { title, account, text, flags } = extractFromArticleHtml(html);
    return {
      httpStatus: resp.status,
      fetchedAt: new Date().toISOString(),
      title: title || '(标题未提取)',
      account: account || '(公众号未提取)',
      textLength: text.length,
      text: text.slice(0, 3000), // 只保留前 3000 字防撑爆，够判断交易信号
      flags
    };
  } catch (e) {
    return { httpStatus: 0, error: e.message, fetchedAt: new Date().toISOString() };
  }
}

async function main() {
  const { query, num, kw, after, output } = parseArgs(process.argv.slice(2));
  if (!query) {
    console.log('用法: node scripts/gzh_fetch.mjs "<竞品名/关键词>" [-n 8] [-kw "中标|签约|喜报"] [-after 2026-01-01] [-o out.json]');
    process.exit(0);
  }

  console.error(`[1/2] 搜狗微信搜索: "${query}" (最多 ${num} 条) ...`);
  const articles = await searchWechatArticles(query, num, true); // resolveRealUrl=true
  if (articles.length === 0) {
    console.error('⚠ 搜索返回 0 条：可能是搜狗对当前出口 IP 限流/验证码（短时间连续调用易触发），请间隔 1-2 分钟重试或更换关键词。');
    process.exit(2);
  }
  console.error(`搜索返回 ${articles.length} 条，开始解析直链并抓正文 ...`);

  const afterTs = after ? new Date(after + 'T00:00:00+08:00').getTime() : 0;
  const kwRe = kw ? new RegExp(kw) : null;

  const results = [];
  let skipped = { after: 0, kw: 0 };
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const dts = a.datetime || '';
    const ts = dts ? new Date(dts.replace(' ', 'T') + '+08:00').getTime() : 0;
    if (afterTs && (!ts || ts < afterTs)) { skipped.after++; continue; }
    if (kwRe && !kwRe.test(a.title)) { skipped.kw++; continue; }
    const realUrl = a.url_resolved && a.url.includes('mp.weixin.qq.com') ? a.url : a.url;
    const body = realUrl.includes('mp.weixin.qq.com')
      ? await fetchArticle(realUrl)
      : { note: '未解析出 mp 直链，保留搜狗跳转链', text: '', textLength: 0 };
    results.push({
      title: a.title,
      summary: a.summary,
      datetime: a.datetime,
      date_text: a.date_text,
      account: a.source,
      sogouUrl: a.url_resolved ? undefined : a.url,
      mpUrl: a.url_resolved ? a.url : undefined,
      url_resolved: !!a.url_resolved,
      article: body
    });
    console.error(`  [${i + 1}/${articles.length}] ${a.title.slice(0, 36)} → ${a.url_resolved ? 'mp直链+' + (body.textLength || 0) + '字' : '无直链'}`);
    if (i < articles.length - 1) await new Promise(r => setTimeout(r, 800)); // 防频控
  }

  const report = { query, searchedAt: new Date().toISOString(), total: results.length, skipped, results };
  const json = JSON.stringify(report, null, 2);
  if (output) {
    await writeFile(path.resolve(output), json + '\n', 'utf8');
    console.error(`结果已保存: ${output}`);
  } else {
    console.log(json);
  }
  console.error(`完成：命中 ${results.length} 条公众号文章（含正文提取 ${results.filter(r => r.article && r.article.textLength > 0).length} 条）`);
}

main().catch(e => { console.error('执行失败:', e.message); process.exit(1); });
