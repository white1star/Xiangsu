import { useMemo, useState } from 'react';
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

function bidCell(item) {
  let s = item.bid;
  if (item.bid === '流标') return `流标 · 未授标${item.stages > 1 ? `（${item.stages}阶段）` : ''}`;
  if (item.bid === '已中标' && item.winner) s = `已中标`;
  if (item.bid === '招标公告') {
    s += item.bidOpenDate ? ` ${item.bidOpenDate}·${item.openStatus}` : ' 开标未披露';
    if (item.resultGap) s += ' ⚠';
  }
  if (item.stages > 1) s += `（${item.stages}阶段）`;
  return s;
}

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
      <div className="topbar-actions"><button className="export" onClick={() => window.print()}>导出</button></div>
    </header>
    <section className="workspace">
      {page === '情报台账' ? <>
        <div className="filters"><label>产品线{select(line, setLine, 'line')}</label><label>竞品{select(competitor, setCompetitor, 'competitor')}</label><label>招标状态{phaseSelect}</label><label>置信度{select(confidence, setConfidence, 'confidence')}</label></div>
        <div className="tablebox"><table><thead><tr>{['客户', '矿种', '产品线', '竞品', '金额', '中标情况', '发布日期', '来源', '置信度'].map(item => <th key={item}>{item}</th>)}</tr></thead><tbody>{pageRows.map(item => <tr key={item.url} onClick={() => setSelected(item)}>{[item.buyer || '未披露', item.mineral || '未披露', item.line, item.competitor, amountCell(item), bidCell(item), item.date, <a href={item.url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{item.source} ↗</a>, item.confidence].map((value, index) => { const cls = index === 4 ? 'amt' : index === 5 ? `bid ${item.bid}` : index === 8 ? `confidence ${item.confidence}` : ''; return <td className={cls} key={index}>{value}</td>; })}</tr>)}</tbody></table></div>
        <footer><span>共 {filtered.length} 个项目（同项目招标/候选/中标公告已合并）　|　最近抓取：{lastCrawl}　|　第 {current}/{totalPages} 页</span><span className="pager"><button disabled={current <= 1} onClick={() => setPageNum(current - 1)}>上一页</button><button disabled={current >= totalPages} onClick={() => setPageNum(current + 1)}>下一页</button></span><span>点击任意记录查看证据摘要</span></footer>
        {selected && <Detail item={selected} onClose={() => setSelected(null)} />}
      </> : <SourcePage />}
    </section>
  </main>;
}

function Field({ label, span, children }) {
  return <div className={`d-field${span ? ' span2' : ''}`}><span className="d-label">{label}</span><div className="d-value">{children}</div></div>;
}

function Block({ title, extra, children }) {
  return <div className="d-block"><h3>{title}{extra && <span className="d-extra">{extra}</span>}</h3>{children}</div>;
}

function Detail({ item, onClose }) {
  const [showNotes, setShowNotes] = useState(false);
  const amountMissing = !item.amount || /未披露/.test(item.amount);
  return <div className="detail"><div>
    <button onClick={onClose}>×</button>
    <h2>{item.title}</h2>

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


function SourceSection({ title, count, desc, entries, tag, showConfidence }) {
  return <section className="src-group">
    <h2>{title}<span className="src-count">{count} 个</span></h2>
    <p className="src-desc">{desc}</p>
    <table><thead><tr><th>平台</th>{tag && <th>权限</th>}<th>覆盖内容</th><th>复审说明</th>{showConfidence && <th className="src-conf-col">可信度</th>}</tr></thead><tbody>{entries.map(platform => <tr key={platform.id}><td title={platform.entryUrl}>{platform.name}</td>{tag && <td><span className="access-tag">{tag}</span></td>}<td>{platform.coverage}</td><td>{platform.auditNote}</td>{showConfidence && <td className="src-conf-cell"><span className={`src-conf conf-${platform.confidence}`}>{platform.confidence}</span></td>}</tr>)}</tbody></table>
  </section>;
}

function SourcePage() {
  const open = platformLibrary.filter(p => p.access === 'anonymous');
  const free = platformLibrary.filter(p => p.access === 'login_free');
  const paid = platformLibrary.filter(p => p.access === 'login_paid');
  return <div className="source-page">
    <div className="src-intro">
      <h3>数据来源可信度说明</h3>
      <p>本台账数据按来源可信度分三档，与前端「置信度」筛选项一一对应：</p>
      <ul>
        <li><span className="src-conf conf-高">高</span>　<strong>官方招标/披露平台</strong>：公共资源交易网、企业自有采购平台、上市公司公告（巨潮/港交所）等官方公示，金额与中标人均以公告原文为准。</li>
        <li><span className="src-conf conf-中">中</span>　<strong>竞品官网/权威媒体自宣</strong>：14 家在册竞品官网新闻、自媒频道，属企业自宣，交易信号会尽量回官方平台独立核验。</li>
        <li><span className="src-conf conf-低">低</span>　<strong>公众号标题线索</strong>：搜狗微信搜索命中标题即收录（未经官方核验），正文可能不可抓取，需点原文链接自行查看确认。</li>
      </ul>
    </div>
    <SourceSection title="公开数据源" count={open.length} entries={open} showConfidence
      desc="公告完全公开、可匿名浏览的入口（含公告可看、仅下载/投标需注册的平台）。正式入账仍须保存原公告链接。" />
    <SourceSection title="登录后免费可看" count={free.length} entries={free} tag="登录后免费看公告"
      desc={free.length ? '需注册登录、但无需付费即可查看公告正文的平台。' : '当前实测暂无此类平台（实测已知平台要么可匿名、要么需付费会员）；后续发现「注册登录后免费可看正文」的平台将归入此类。'} />
    <SourceSection title="已排除·需付费会员" count={paid.length} entries={paid} tag="需付费会员（不收录）"
      desc="商业聚合/企业查询平台，公告正文需付费会员才能查看。按数据源口径排除：不从此类平台收录数据，仅作了解。" />
  </div>;
}
