import { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import rows from './data/intelligence.json';
import crawlStamp from './data/crawl_stamp.json';
import platformLibrary from '../config/platform-library.json';
import './styles.css';
import './table-fix.css';
import './intelligence.css';
import './platform-library.css';

const icons = ['▣', '◉'];
const PAGE_SIZE = 10;
const PHASE_OPTIONS = ['全部', '待开标', '已开标', '未披露', '中标候选人', '已中标', '流标'];

// 金额列：已披露带阶段标签；未披露带出复核原因（避免表格看起来一片空白）
function amountCell(item) {
  if (item.amount && !/未披露/.test(item.amount)) {
    return <span>{item.amount}{item.amountStage ? <span className="why"> · {item.amountStage}</span> : null}</span>;
  }
  const why = item.amountNote || '原文未披露金额，已逐条复核';
  const short = why.length > 16 ? why.slice(0, 16) + '…' : why;
  return <span className="amt-undisclosed" title={why}>未披露<span className="amt-why"> · {short}</span></span>;
}

// 招标公告按开标核对派生状态；结果类按公告类型。供“招标状态”筛选。
function phaseOf(item) {
  if (item.bid === '招标公告') return item.openStatus || '未披露';
  return item.bid;
}

export default function App() {
  const [line, setLine] = useState('全部');
  const [competitor, setCompetitor] = useState('全部');
  const [confidence, setConfidence] = useState('全部');
  const [phase, setPhase] = useState('全部');
  const [page, setPage] = useState('情报台账');
  const [pageNum, setPageNum] = useState(1);
  const [selected, setSelected] = useState(null);
  const filtered = useMemo(() => rows.filter(item => (line === '全部' || item.line === line) && (competitor === '全部' || item.competitor === competitor) && (confidence === '全部' || item.confidence === confidence) && (phase === '全部' || phaseOf(item) === phase)), [line, competitor, confidence, phase]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, pageNum), totalPages);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const latestUpdate = useMemo(() => { const ds = rows.map(r => r.date).filter(Boolean).sort(); return ds.length ? ds[ds.length - 1] : '—'; }, []);
  const lastCrawl = (crawlStamp.lastCrawl || '').replace('T', ' ').slice(0, 16) || '—';
  const resetPage = fn => event => { fn(event.target.value); setPageNum(1); };
  const options = key => ['全部', ...new Set(rows.map(item => item[key]))];
  const select = (value, setter, key) => <select value={value} onChange={resetPage(setter)}>{options(key).map(item => <option key={item}>{item}</option>)}</select>;
  const phaseSelect = <select value={phase} onChange={resetPage(setPhase)}>{PHASE_OPTIONS.map(item => <option key={item}>{item}</option>)}</select>;

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><span className="mark">◈</span><b>唐山像素智能</b></div>
      <nav>{['情报台账', '数据源'].map((item, index) => <button className={page === item ? 'active' : ''} onClick={() => setPage(item)} key={item}><i>{icons[index]}</i>{item}</button>)}</nav>
    </header>
    <section className="workspace">
      {page === '情报台账' ? <>
        <div className="filters"><label>产品线{select(line, setLine, 'line')}</label><label>竞品{select(competitor, setCompetitor, 'competitor')}</label><label>招标状态{phaseSelect}</label><label>置信度{select(confidence, setConfidence, 'confidence')}</label></div>
        <div className="tablebox"><table><thead><tr>{['客户', '矿种', '产品线', '竞品', '金额', '成交方式', '发布日期', '来源', '置信度'].map(item => <th key={item}>{item}</th>)}</tr></thead><tbody>{pageRows.map(item => <tr key={item.url} onClick={() => setSelected(item)}>{[item.buyer || '未披露', item.mineral || '未披露', item.line, item.competitor, amountCell(item), dealTypeCell(item), item.date, <a href={item.url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{item.source} ↗</a>, item.confidence].map((value, index) => { const cls = index === 4 ? 'amt' : index === 5 ? 'deal' : index === 8 ? `confidence ${item.confidence}` : ''; return <td className={cls} key={index}>{value}</td>; })}</tr>)}</tbody></table></div>
        <footer><span>共 {filtered.length} 个项目（同项目招标/候选/中标公告已合并）　|　最近抓取：{lastCrawl}　|　第 {current}/{totalPages} 页</span><span className="pager"><button disabled={current <= 1} onClick={() => setPageNum(current - 1)}>上一页</button><button disabled={current >= totalPages} onClick={() => setPageNum(current + 1)}>下一页</button></span><span>点击任意记录查看证据摘要</span></footer>
        {selected && <Detail item={selected} onClose={() => setSelected(null)} />}
      </> : <SourcePage />}
    </section>
  </main>;
}

function Field({ label, span, children }) {
  return <div className={`d-field${span ? ' span2' : ''}`}><span className="d-label">{label}</span><div className="d-value">{children}</div></div>;
}

// 成交方式推导：招投标进度类 vs 非招投标成交类（直签/租赁/BOT/EPC分包等）
function dealTypeOf(item) {
  const t = item.title || '';
  const b = item.bid || '';
  if (/租赁|承租/.test(t + b)) return { label: '租赁', desc: '设备租赁模式成交（中标方提供设备并按租期结算），非买断招投标。' };
  if (/BOT|运营合作|运营服务/.test(t + b)) return { label: 'BOT / 运营合作', desc: '乙方投资设备+运营，按处理服务费结算，合作期满移交，非一次性采购。' };
  if (/EPC|总包|总承包/.test(t + b)) return { label: 'EPC 总包（含设备）', desc: '工程总承包模式，设备作为总包内容的一部分成交。' };
  if (/重大销售合同|已签约|直接签约|销售合同/.test(t + b)) return { label: '直接签约（非招投标）', desc: '商务谈判直接签订销售合同，未走公开招投标流程（多为上市公司公告披露）。' };
  if (/已交付|已投运|投运|投产|发运/.test(t + b)) return { label: '直接签约（非招投标）', desc: '以交付/投运状态呈现的成交，未体现招投标流程。' };
  return { label: '招投标', desc: '通过公开招标/竞争性谈判等采购流程成交，按公告阶段推进（招标→候选→中标）。' };
}

// 表格“成交方式”列：成交方式徽章 + 进度小字
function dealTypeCell(item) {
  const dt = dealTypeOf(item);
  const cls = dt.label.includes('招投标') ? 'dt-tender' : dt.label.includes('直接签约') ? 'dt-direct' : 'dt-other';
  const phase = item.bid;
  return <span className="deal-cell">
    <span className={`deal-badge ${cls}`}>{dt.label}</span>
    <span className="deal-phase">{phase}</span>
  </span>;
}

function Block({ title, extra, children }) {
  return <div className="d-block"><h3>{title}{extra && <span className="d-extra">{extra}</span>}</h3>{children}</div>;
}

function Detail({ item, onClose }) {
  const [showNotes, setShowNotes] = useState(false);
  const amountMissing = !item.amount || /未披露/.test(item.amount);

  // 导出当前项目为 PDF 文件：jsPDF 的 html() 用浏览器原生渲染（中文正常），直接生成 .pdf 下载，不走打印
  const exportPdf = () => {
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const row = (k, v) => v ? `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>` : '';
    const dt = dealTypeOf(item);
    const html = `<div style="font-family:'Microsoft YaHei',Arial,sans-serif;color:#111;line-height:1.7;font-size:13px;width:720px">
      <h1 style="font-size:20px;margin:0 0 14px;border-bottom:2px solid #1267c9;padding-bottom:10px">${esc(item.title)}</h1>
      <div style="display:flex;gap:24px;background:#f5f8fc;padding:12px 16px;border-radius:6px;margin-bottom:16px">
        <div style="flex:1"><div style="font-size:11px;color:#6a7887">金额</div><div style="font-size:15px;font-weight:700">${esc(item.amount || '未披露')}${item.amountStage ? ` <span style="font-size:11px;font-weight:400">（${esc(item.amountStage)}）</span>` : ''}</div></div>
        <div style="flex:1"><div style="font-size:11px;color:#6a7887">发布日期</div><div style="font-size:15px;font-weight:700">${esc(item.date || '未披露')}</div></div>
        <div style="flex:1"><div style="font-size:11px;color:#6a7887">成交方式</div><div><span style="padding:2px 12px;border-radius:999px;font-size:12px;font-weight:700;background:#e8f0fb;color:#1267c9">${esc(dt.label)}</span></div></div>
      </div>
      <h2 style="font-size:14px;margin:20px 0 8px;color:#16466f;border-left:3px solid #1267c9;padding-left:8px">项目属性</h2>
      <table style="width:100%;border-collapse:collapse;margin:8px 0">
        ${row('中标情况', item.bid)}${row('中标人', item.winner || (item.bid === '已中标' ? '中标人未在公告中明确' : ''))}
        ${row('采购人', item.buyer)}${row('矿种', item.mineral)}${row('地区', item.region)}
        ${row('竞品', item.competitor)}${row('产品线', item.line)}${row('预算/控制价', item.budget)}
        ${row('采购内容', item.procurement)}${row('来源', item.source)}${row('置信度', item.confidence)}
      </table>
      <h2 style="font-size:14px;margin:20px 0 8px;color:#16466f;border-left:3px solid #1267c9;padding-left:8px">成交方式说明</h2>
      <p style="margin:4px 0">${esc(dt.label)}：${esc(dt.desc)}</p>
      <h2 style="font-size:14px;margin:20px 0 8px;color:#16466f;border-left:3px solid #1267c9;padding-left:8px">证据摘要</h2>
      <p style="margin:4px 0">${esc(item.evidence)}</p>
      ${item.amountNote ? `<h2 style="font-size:14px;margin:20px 0 8px;color:#16466f;border-left:3px solid #1267c9;padding-left:8px">金额 / 未披露说明</h2><p style="margin:4px 0">${esc(item.amountNote)}</p>` : ''}
      <h2 style="font-size:14px;margin:20px 0 8px;color:#16466f;border-left:3px solid #1267c9;padding-left:8px">原文链接</h2>
      <p style="margin:4px 0;color:#1267c9">${esc(item.url)}</p>
      <div style="margin-top:24px;padding-top:12px;border-top:1px dashed #ccc;color:#889;font-size:11px">导出时间：${new Date().toLocaleString('zh-CN')}　|　数据来源：唐山像素智能·公开情报台账（置信度 ${esc(item.confidence)}）</div>
    </div>`;
    const el = document.createElement('div');
    el.style.position = 'absolute'; el.style.left = '-9999px'; el.style.top = '0';
    el.innerHTML = html;
    document.body.appendChild(el);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.html(el, {
      margin: 40,
      autoPaging: 'text',
      width: 720,
      windowWidth: 720,
      callback(d) {
        const fname = (item.title || '项目').replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
        d.save(`${fname}.pdf`);
        el.remove();
      },
    });
  };

  return <div className="detail"><div>
    <div className="d-head">
      <h2>{item.title}</h2>
      <div className="d-toolbar">
        <button className="d-export" onClick={exportPdf}>导出 PDF</button>
        <button className="d-close" onClick={onClose} aria-label="关闭">×</button>
      </div>
    </div>

    <div className="d-conclusion">
      <div className="d-status">
        <span className={`d-badge bid ${item.bid}`}>{item.bid}</span>
        {item.winner ? <span className="d-winner">{item.winner}</span> : item.bid === '已中标' ? <span className="d-winner muted">中标人未在公告中明确</span> : null}
        {item.statusNote ? <span className="why">（{item.statusNote}）</span> : null}
      </div>
      <div className="d-metrics">
        <div className="d-metric"><span>金额</span><b className={amountMissing ? 'undisclosed' : ''}>{item.amount || '未披露'}</b>{item.amountStage ? <i>{item.amountStage}</i> : null}</div>
        <div className="d-metric"><span>发布日期</span><b>{item.date || '未披露'}</b></div>
        <div className="d-metric"><span>开标日期</span><b>{item.bidOpenDate || '未披露'}</b>{item.openStatus ? <i>{item.openStatus}</i> : null}</div>
      </div>
    </div>

    {(amountMissing && item.amountNote) || item.scopeNote || item.resultGap ? <div className="d-notes">
      {amountMissing && item.amountNote ? <div className="d-note"><b>未披露说明：</b>{item.amountNote}</div> : null}
      {item.scopeNote ? <div className="d-warn"><b>标的说明：</b>{item.scopeNote}</div> : null}
      {item.resultGap ? <div className="d-warn">⚠ 已开标但台账未收录对应中标结果，建议反查官方原文</div> : null}
    </div> : null}

    {(() => { const dt = dealTypeOf(item); return <div className="d-dealtype"><span className="d-dealtype-label">成交方式</span><span className={`d-dealtype-badge dt-${dt.label.includes('招投标') ? 'tender' : dt.label.includes('直接签约') ? 'direct' : 'other'}`}>{dt.label}</span><span className="d-dealtype-desc">{dt.desc}</span></div>; })()}

    <Block title="项目属性">
      <div className="d-grid">
        <Field label="采购人">{item.buyer || '未披露'}</Field>
        <Field label="矿种">{item.mineral || '未披露'}</Field>
        <Field label="地区">{item.region || '未披露'}</Field>
        {item.budget ? <Field label="预算/控制价">{item.budget}</Field> : ''}
        <Field label="来源鉴权"><span className={`auth ${item.sourceAuthority === '需登录' ? 'auth-locked' : 'auth-open'}`}>{item.sourceAuthority || '未披露'}</span></Field>
        {item.procurement ? <Field label="采购内容" span>{item.procurement}</Field> : ''}
      </div>
    </Block>

    {item.timeline && item.timeline.length > 1 ? <Block title="项目时间线" extra={`${item.timeline.length} 个阶段公告 · 已合并去重`}>
      <div className="timeline"><ul>{item.timeline.map((t, i) => <li key={i}><span className={`bid ${t.bid}`}>{t.bid}</span>　{t.date}　{t.amount}　<a href={t.url} target="_blank" rel="noreferrer">原文 ↗</a><br /><span className="tl-title">{t.title}</span></li>)}</ul></div>
    </Block> : ''}

    {item.bids && item.bids.length > 0 ? <Block title="竞品候选报价" extra={`${item.bids.length} 家`}>
      <div className="bids"><table><thead><tr><th>排名</th><th>竞品公司</th><th>报价</th></tr></thead><tbody>{item.bids.map((b, i) => <tr key={i} className={b.isWinner ? 'win' : ''}><td>{b.rank || '-'}</td><td>{b.company}{b.isWinner ? '　🏆' : ''}</td><td>{b.quote}</td></tr>)}</tbody></table></div>
    </Block> : ''}

    <Block title="证据与来源">
      <div className="d-evidence">{item.evidence}</div>
      <div className="d-source"><a href={item.url} target="_blank" rel="noreferrer">打开原始页面 ↗</a><span className="d-src-name">{item.source}</span></div>
    </Block>

    <div className="d-foot"><button className="d-toggle" onClick={() => setShowNotes(!showNotes)}>{showNotes ? '▾' : '▸'} 数据口径说明</button>{showNotes ? <p className="hint">金额优先取公告表格中的首个投标/中标报价（多家竞价时取第一家）；已排除保证金、注册资本、标书费等非交易金额。凡标注“未披露”的，均已逐条复核并在括号中注明具体原因（正文为PDF、需登录、链接失效或原文确无金额），不以猜测补全。</p> : ''}</div>
  </div></div>;
}

// 竞品分析页已按需求从侧边栏移除，组件一并删除（2026-07-31）。


function SourceSection({ title, count, desc, entries, tag }) {
  return <section className="src-group">
    <h2>{title}<span className="src-count">{count} 个</span></h2>
    <p className="src-desc">{desc}</p>
    <table><thead><tr><th>平台</th>{tag && <th>权限</th>}<th>覆盖内容</th><th>复审说明</th></tr></thead><tbody>{entries.map(platform => <tr key={platform.id}><td title={platform.entryUrl}>{platform.name}</td>{tag && <td><span className="access-tag">{tag}</span></td>}<td>{platform.coverage}</td><td>{platform.auditNote}</td></tr>)}</tbody></table>
  </section>;
}

function SourcePage() {
  const open = platformLibrary.filter(p => p.access === 'anonymous');
  const free = platformLibrary.filter(p => p.access === 'login_free');
  const paid = platformLibrary.filter(p => p.access === 'login_paid');
  return <div className="source-page">
    <SourceSection title="公开数据源" count={open.length} entries={open}
      desc="公告完全公开、可匿名浏览的入口（含公告可看、仅下载/投标需注册的平台）。正式入账仍须保存原公告链接。" />
    <SourceSection title="登录后免费可看" count={free.length} entries={free} tag="登录后免费看公告"
      desc={free.length ? '需注册登录、但无需付费即可查看公告正文的平台。' : '当前实测暂无此类平台（实测已知平台要么可匿名、要么需付费会员）；后续发现「注册登录后免费可看正文」的平台将归入此类。'} />
    <SourceSection title="已排除·需付费会员" count={paid.length} entries={paid} tag="需付费会员（不收录）"
      desc="商业聚合/企业查询平台，公告正文需付费会员才能查看。按数据源口径排除：不从此类平台收录数据，仅作了解。" />
  </div>;
}
