import { useMemo, useState } from 'react';
import rows from './data/intelligence.json';
import platformLibrary from '../config/platform-library.json';
import './styles.css';
import './table-fix.css';
import './intelligence.css';
import './platform-library.css';

const icons = ['▣', '◉', '◌'];
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
  const resetPage = fn => event => { fn(event.target.value); setPageNum(1); };
  const options = key => ['全部', ...new Set(rows.map(item => item[key]))];
  const select = (value, setter, key) => <select value={value} onChange={resetPage(setter)}>{options(key).map(item => <option key={item}>{item}</option>)}</select>;
  const phaseSelect = <select value={phase} onChange={resetPage(setPhase)}>{PHASE_OPTIONS.map(item => <option key={item}>{item}</option>)}</select>;

  return <main className="shell">
    <aside><div className="brand"><div className="mark">◈</div><b>唐山像素智能</b></div><nav>{['情报台账', '来源分类', '平台清单'].map((item, index) => <button className={page === item ? 'active' : ''} onClick={() => setPage(item)} key={item}><i>{icons[index]}</i>{item}</button>)}</nav></aside>
    <section className="workspace"><header><h1>{page === '情报台账' ? '公开情报台账' : page}</h1><div><button className="export" onClick={() => window.print()}>导出 / 打印</button></div></header>
      {page === '情报台账' ? <>
        <div className="filters"><label>产品线{select(line, setLine, 'line')}</label><label>竞品{select(competitor, setCompetitor, 'competitor')}</label><label>置信度{select(confidence, setConfidence, 'confidence')}</label><label>招标状态{phaseSelect}</label></div>
        <div className="tablebox"><table><thead><tr>{['情报标题', '产品线', '竞品', '金额', '中标情况', '来源', '置信度', '发布日期'].map(item => <th key={item}>{item}</th>)}</tr></thead><tbody>{pageRows.map(item => <tr key={item.url} onClick={() => setSelected(item)}>{[item.title, item.line, item.competitor, amountCell(item), bidCell(item), <a href={item.url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{item.source} ↗</a>, item.confidence, item.date].map((value, index) => <td className={index === 3 ? 'amt' : index === 4 ? `bid ${item.bid}` : index === 6 ? `confidence ${item.confidence}` : ''} key={index}>{value}</td>)}</tr>)}</tbody></table></div>
        <footer><span>共 {filtered.length} 个项目（同项目招标/候选/中标公告已合并）　|　最近更新：{latestUpdate}　|　第 {current}/{totalPages} 页</span><span className="pager"><button disabled={current <= 1} onClick={() => setPageNum(current - 1)}>上一页</button><button disabled={current >= totalPages} onClick={() => setPageNum(current + 1)}>下一页</button></span><span>点击任意记录查看证据摘要</span></footer>
        {selected && <Detail item={selected} onClose={() => setSelected(null)} />}
      </> : <SourcePage type={page} />}
    </section>
  </main>;
}

function Detail({ item, onClose }) { return <div className="detail"><div><button onClick={onClose}>×</button><h2>{item.title}</h2><p><b>中标情况：</b><span className={`bid ${item.bid}`}>{item.bid}</span>{item.winner ? `　中标人：${item.winner}` : item.bid === '已中标' ? '　（中标人未在公告中明确）' : ''}{item.statusNote ? <span className="why">（{item.statusNote}）</span> : ''}</p>{item.scopeNote && <p className="scope-note"><b>⚠ 标的说明：</b>{item.scopeNote}</p>}<p><b>开标日期：</b>{item.bidOpenDate ? `${item.bidOpenDate}（${item.openStatus || '未披露'}）` : '未披露'}{item.resultGap ? '　⚠ 已开标但台账未收录对应中标结果，建议反查官方原文' : ''}</p><p><b>金额：</b>{item.amount || '未披露'}{item.amountStage ? <span className="why">（{item.amountStage}）</span> : ''}{item.amountNote ? <span className="why">（{item.amountNote}）</span> : ''}</p>{item.timeline && item.timeline.length > 1 && <div className="timeline"><b>项目时间线（{item.timeline.length} 个阶段公告，已合并去重）：</b><ul>{item.timeline.map((t, i) => <li key={i}><span className={`bid ${t.bid}`}>{t.bid}</span>　{t.date}　{t.amount}　<a href={t.url} target="_blank" rel="noreferrer">原文 ↗</a><br /><span className="tl-title">{t.title}</span></li>)}</ul></div>}<p><b>采购人：</b>{item.buyer || '未披露'}</p>{item.budget && <p><b>预算/控制价：</b>{item.budget}</p>}{item.procurement && <p><b>采购内容：</b>{item.procurement}</p>}{item.bids && item.bids.length > 0 && <div className="bids"><b>竞品候选报价（{item.bids.length} 家）：</b><table><thead><tr><th>排名</th><th>竞品公司</th><th>报价</th></tr></thead><tbody>{item.bids.map((b, i) => <tr key={i} className={b.isWinner ? 'win' : ''}><td>{b.rank || '-'}</td><td>{b.company}{b.isWinner ? '　🏆' : ''}</td><td>{b.quote}</td></tr>)}</tbody></table></div>}<p><b>证据摘要：</b>{item.evidence}</p><p><b>来源鉴权：</b><span className={`auth ${item.sourceAuthority === '需登录' ? 'auth-locked' : 'auth-open'}`}>{item.sourceAuthority || '未披露'}</span>　<b>地区：</b>{item.region || '未披露'}</p><p><b>原始页面：</b><a href={item.url} target="_blank" rel="noreferrer">打开原文 ↗</a></p><p className="hint">金额优先取公告表格中的首个投标/中标报价（多家竞价时取第一家）；已排除保证金、注册资本、标书费等非交易金额。凡标注“未披露”的，均已逐条复核并在括号中注明具体原因（正文为PDF、需登录、链接失效或原文确无金额），不以猜测补全。</p></div></div>; }

// 竞品分析页已按需求从侧边栏移除，组件一并删除（2026-07-31）。


function SourcePage({ type }) {
  const authentication = type === '平台清单';
  const entries = platformLibrary.filter(platform => authentication ? platform.access !== 'anonymous' : platform.access === 'anonymous');
  const accessLabel = access => '需登录才能看公告';
  return <div className="source-page"><p>{authentication ? (entries.length === 0 ? '经逐站实测，当前收录的所有平台公告均可匿名查看，无需登录——这与“只看公开公告”的采集原则完全一致。' : '以下平台经实测审查，公告内容本身需登录才能查看（或 SPA 动态加载 / WAF 反爬导致匿名无法稳定浏览）。系统不会绕过鉴权；你登录后在已授权会话中再抓取。') : '仅保留公告完全公开可匿名浏览的入口（含公告可看、仅下载/投标需注册的平台）。公开浏览不代表可以绕过下载、投标或付费权限；正式入账仍须保存原公告。'}</p><p className="source-count">已收录 {entries.length} 个{authentication ? '需登录才能看公告' : '公告可匿名浏览'}平台。</p><table><thead><tr><th>平台</th>{authentication && <th>权限</th>}<th>覆盖内容</th><th>复审说明</th></tr></thead><tbody>{entries.map(platform => <tr key={platform.id}><td><a href={platform.entryUrl} target="_blank" rel="noreferrer">{platform.name} ↗</a></td>{authentication && <td><span className="access-tag">{accessLabel(platform.access)}</span></td>}<td>{platform.coverage}</td><td>{platform.auditNote}</td></tr>)}</tbody></table></div>;
}
