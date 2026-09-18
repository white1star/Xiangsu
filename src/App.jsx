import { useEffect, useMemo, useRef, useState } from 'react';
import rows from './data/intelligence.json';
import wechatLeads from './data/wechat-leads.json';
import crawlStamp from './data/crawl_stamp.json';
import platformLibrary from '../config/platform-library.json';
import './styles.css';
import './table-fix.css';
import './intelligence.css';
import './platform-library.css';
import './wechat.css';

const icons = ['▣', '◉', '◍'];
const PAGE_SIZE = 10;
const PHASE_OPTIONS = ['全部', '待开标', '已开标', '未披露', '中标候选人', '已中标', '流标'];
const LEDGER_COLUMNS = ['客户', '矿种', '产品线', '竞品', '金额', '成交方式', '发布日期', '来源', '置信度'];
const WECHAT_COLUMNS = ['发布日期', '公众号', '标题（点击看原文）', '产品线', '信号', '检索路径'];

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

// 反馈按钮：与矿业资讯站样式/行为一致（web3forms 提交）
function Feedback() {
  const dialogRef = useRef(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);

  const open = () => { setStatus(null); dialogRef.current?.showModal(); };
  const close = () => dialogRef.current?.close();

  const submit = async event => {
    event.preventDefault();
    setSending(true);
    setStatus(null);
    const data = new FormData();
    data.append('access_key', '1a0e2eb4-7458-4ab9-aea0-3ffdbdf05ae3');
    data.append('subject', '竞品情报分析反馈');
    data.append('from_name', '竞品情报分析');
    data.append('page_url', location.href);
    if (name.trim()) data.append('name', name.trim());
    data.append('message', message);
    try {
      const response = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      const payload = await response.json();
      if (!payload || !payload.success) throw new Error('fail');
      setStatus({ ok: true, text: '已收到，谢谢！' });
      setTimeout(() => { dialogRef.current?.close(); setName(''); setMessage(''); setStatus(null); }, 1500);
    } catch {
      setStatus({ ok: false, text: '提交失败，请稍后再试' });
    } finally {
      setSending(false);
    }
  };

  return <>
    <button className="feedback-fab" type="button" aria-haspopup="dialog" onClick={open}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      <span>反馈</span>
    </button>
    <dialog className="fb-dialog" ref={dialogRef}>
      <form onSubmit={submit}>
        <h3>意见反馈</h3>
        <label>怎么称呼你（可选）<input value={name} maxLength={30} autoComplete="off" onChange={event => setName(event.target.value)} /></label>
        <label>说点什么……<textarea value={message} required maxLength={500} onChange={event => setMessage(event.target.value)} /></label>
        <div className="fb-row">
          <span className="fb-count">{message.length}/500</span>
          <button type="button" className="fb-cancel" onClick={close}>取消</button>
          <button type="submit" className="fb-submit" disabled={sending}>提交</button>
        </div>
        {status ? <p className={`fb-msg${status.ok ? '' : ' err'}`}>{status.text}</p> : null}
      </form>
    </dialog>
  </>;
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
  const select = (value, setter, key) => <Dropdown value={value} options={filterOptions(key)} onChange={next => { setter(next); setPageNum(1); }} />;
  const phaseSelect = <Dropdown value={phase} options={PHASE_OPTIONS} onChange={next => { setPhase(next); setPageNum(1); }} />;

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><span className="mark">◈</span><b>唐山像素智能</b></div>
      <div className="head-right">
        <nav>{['情报台账', '公众号线索', '数据源'].map((item, index) => <button className={page === item ? 'active' : ''} onClick={() => setPage(item)} key={item}><i>{icons[index]}</i>{item}</button>)}</nav>
        <a className="nav-center" href="https://white1star.github.io/">← 信息中心</a>
      </div>
    </header>
    <section className="workspace">
      {page === '情报台账' ? <>
        <div className="filters">
          <div className="f-item"><span>产品线</span>{select(line, setLine, 'line')}</div>
          <div className="f-item"><span>竞品</span>{select(competitor, setCompetitor, 'competitor')}</div>
          <div className="f-item"><span>招标状态</span>{phaseSelect}</div>
          <div className="f-item"><span>置信度</span>{select(confidence, setConfidence, 'confidence')}</div>
        </div>
        <div className="tablebox"><table><thead><tr>{LEDGER_COLUMNS.map(item => <th key={item}>{item}</th>)}</tr></thead><tbody>{pageRows.map(item => <tr key={item.url} onClick={() => setSelected(item)}>{[item.buyer || '未披露', item.mineral || '未披露', item.line, item.competitor, amountCell(item), dealTypeCell(item), item.date, <a href={item.url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{item.source} ↗</a>, item.confidence].map((value, index) => { const cls = index === 4 ? 'amt' : index === 5 ? 'deal' : index === 8 ? `confidence ${item.confidence}` : ''; return <td className={cls} key={index} data-label={LEDGER_COLUMNS[index]}>{value}</td>; })}</tr>)}</tbody></table></div>
        <footer><span>共 {filtered.length} 个项目（同项目招标/候选/中标公告已合并）　|　最近抓取：{lastCrawl}　|　第 {current}/{totalPages} 页</span><span className="pager"><button disabled={current <= 1} onClick={() => setPageNum(current - 1)}>上一页</button><button disabled={current >= totalPages} onClick={() => setPageNum(current + 1)}>下一页</button></span><span>点击任意记录查看证据摘要</span></footer>
        {selected && <Detail item={selected} onClose={() => setSelected(null)} />}
      </> : page === '公众号线索' ? <WechatPage /> : <SourcePage />}
    </section>
    <Feedback />
  </main>;
}

function Field({ label, span, children }) {
  return <div className={`d-field${span ? ' span2' : ''}`}><span className="d-label">{label}</span><div className="d-value">{children}</div></div>;
}

// 自定义下拉：面板展开/收起带过渡，选项有序；替代原生 select（原生弹层无法做动效且样式杂乱）
function Dropdown({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = event => { if (boxRef.current && !boxRef.current.contains(event.target)) setOpen(false); };
    const closeOnEscape = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOnOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, [open]);
  return <div className={`dd${open ? ' open' : ''}`} ref={boxRef}>
    <button type="button" className="dd-btn" aria-expanded={open} onClick={() => setOpen(next => !next)}>
      <span className="dd-value">{value}</span>
      <span className="dd-caret" aria-hidden="true">▾</span>
    </button>
    <div className="dd-panel" role="listbox">
      {options.map(option => <button type="button" role="option" aria-selected={option === value} className={`dd-opt${option === value ? ' active' : ''}`} key={option} onClick={() => { onChange(option); setOpen(false); }}>{option}</button>)}
    </div>
  </div>;
}

// 筛选选项排序：产品线按固定语义序；竞品按项目数降序、占位值（未披露/未定标）排最后；置信度按 高→中→低
const ALL_OPTION = '全部';
const PLACEHOLDER_VALUES = new Set(['未披露', '未定标', '待核实']);
const LINE_ORDER = { '煤炭智能干选设备': 0, '矿石XRT光电分选设备': 1 };
const CONFIDENCE_ORDER = { 高: 0, 中: 1, 低: 2 };
function filterOptions(key) {
  const values = [...new Set(rows.map(item => item[key]).filter(Boolean))].filter(value => value !== ALL_OPTION);
  if (key === 'competitor') {
    const counts = new Map();
    for (const item of rows) counts.set(item[key], (counts.get(item[key]) || 0) + 1);
    values.sort((a, b) => (Number(PLACEHOLDER_VALUES.has(a)) - Number(PLACEHOLDER_VALUES.has(b))) || (counts.get(b) - counts.get(a)) || a.localeCompare(b, 'zh'));
  } else if (key === 'line') {
    values.sort((a, b) => (LINE_ORDER[a] ?? 9) - (LINE_ORDER[b] ?? 9));
  } else if (key === 'confidence') {
    values.sort((a, b) => (CONFIDENCE_ORDER[a] ?? 9) - (CONFIDENCE_ORDER[b] ?? 9));
  }
  return [ALL_OPTION, ...values];
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

  return <div className="detail"><div>
    <div className="d-head">
      <h2>{item.title}</h2>
      <div className="d-toolbar">
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

// 公众号线索页（置信度=低）：微信公众号不开放接口，只给标题+摘要+日期+公众号名+链接，正文须点开自看，不作为交易凭证。
// 双路检索合并去重：① 竞品短名走「公众号直搜」② 设备词走「搜狗收录（第三方数据源）」。
function WechatPage() {
  const [line, setLine] = useState('全部');
  const [via, setVia] = useState('全部');
  const sorted = useMemo(() => [...wechatLeads].sort((a, b) => String(b.publishDate || '').localeCompare(String(a.publishDate || ''))), []);
  const filtered = sorted.filter(item => (line === '全部' || item.line === line) && (via === '全部' || item.via === via));
  const options = key => ['全部', ...new Set(sorted.map(item => item[key]).filter(Boolean))];
  const select = (value, setter, key) => <Dropdown value={value} options={options(key)} onChange={setter} />;
  const viaTag = value => value === '公众号直搜' ? 'wx-via-account' : value === '搜狗收录' ? 'wx-via-sogou' : 'wx-via-account';
  return <div className="wechat-page">
    <div className="wx-banner">
      <b>公众号线索雷达（置信度：低）</b>
      <span>只采标题 / 摘要 / 日期 / 公众号名 / 链接——微信公众号不开放接口（官方不提供文章检索与正文获取），搜索引擎也只能收录标题与摘要，请点击标题跳转原文自行查看。本区仅作线索雷达，<b>不作为交易凭证</b>，正式入账须回官方公告核验。</span>
      <span className="wx-legend">
        <i className="wx-dot wx-via-account"></i>公众号直搜（竞品名）
        <i className="wx-dot wx-via-sogou"></i>搜狗收录（第三方数据源）
      </span>
    </div>
    <div className="filters">
      <div className="f-item"><span>产品线</span>{select(line, setLine, 'line')}</div>
      <div className="f-item"><span>检索路径</span>{select(via, setVia, 'via')}</div>
      <span className="wx-total">共 {filtered.length} 条线索</span>
    </div>
    <div className="tablebox wx-tablebox"><table><thead><tr>{WECHAT_COLUMNS.map(item => <th key={item}>{item}</th>)}</tr></thead>
      <tbody>{filtered.map(item => <tr key={item.url}>
        <td data-label="发布日期">{item.publishDate}</td>
        <td data-label="公众号">{item.account || '未披露'}</td>
        <td className="wx-title" data-label="标题">{<a href={item.url} target="_blank" rel="noreferrer">{item.title} ↗</a>}{item.summary ? <span className="wx-summary">{item.summary}</span> : null}</td>
        <td data-label="产品线">{item.line}</td>
        <td data-label="信号"><span className="wx-signal">{item.bidStatus}</span></td>
        <td data-label="检索路径"><span className={`wx-via ${viaTag(item.via)}`}>{item.via}</span></td>
      </tr>)}</tbody></table></div>
    <footer><span>公众号线索共 {filtered.length} 条　|　微信公众号不开放接口，点标题跳转原文查看</span></footer>
  </div>;
}
