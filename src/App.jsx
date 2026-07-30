import { useMemo, useState } from 'react';
import rows from './data/intelligence.json';
import platformLibrary from '../config/platform-library.json';
import './styles.css';
import './table-fix.css';
import './intelligence.css';
import './platform-library.css';

const icons = ['▣', '◉', '◌'];
const PAGE_SIZE = 10;
const PHASE_OPTIONS = ['全部', '待开标', '已开标', '未披露', '中标候选人', '已中标'];

function bidCell(item) {
  let s = item.bid;
  if (item.bid === '招标公告') {
    s += item.bidOpenDate ? ` ${item.bidOpenDate}·${item.openStatus}` : ' 开标未披露';
    if (item.resultGap) s += ' ⚠';
  }
  return s;
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
  const resetPage = fn => event => { fn(event.target.value); setPageNum(1); };
  const options = key => ['全部', ...new Set(rows.map(item => item[key]))];
  const select = (value, setter, key) => <select value={value} onChange={resetPage(setter)}>{options(key).map(item => <option key={item}>{item}</option>)}</select>;
  const phaseSelect = <select value={phase} onChange={resetPage(setPhase)}>{PHASE_OPTIONS.map(item => <option key={item}>{item}</option>)}</select>;

  return <main className="shell">
    <aside><div className="brand"><div className="mark">◈</div><b>唐山像素智能</b></div><nav>{['情报台账', '来源分类', '平台清单'].map((item, index) => <button className={page === item ? 'active' : ''} onClick={() => setPage(item)} key={item}><i>{icons[index]}</i>{item}</button>)}</nav></aside>
    <section className="workspace"><header><h1>{page === '情报台账' ? '公开情报台账' : page}</h1><div><button className="export" onClick={() => window.print()}>导出 / 打印</button></div></header>
      {page === '情报台账' ? <>
        <div className="filters"><label>产品线{select(line, setLine, 'line')}</label><label>竞品{select(competitor, setCompetitor, 'competitor')}</label><label>置信度{select(confidence, setConfidence, 'confidence')}</label><label>招标状态{phaseSelect}</label></div>
        <div className="tablebox"><table><thead><tr>{['情报标题', '产品线', '竞品', '金额', '中标情况', '来源', '置信度', '发布日期'].map(item => <th key={item}>{item}</th>)}</tr></thead><tbody>{pageRows.map(item => <tr key={item.url} onClick={() => setSelected(item)}>{[item.title, item.line, item.competitor, item.amount, bidCell(item), <a href={item.url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{item.source} ↗</a>, item.confidence, item.date].map((value, index) => <td className={index === 4 ? `bid ${item.bid}` : index === 6 ? `confidence ${item.confidence}` : ''} key={index}>{value}</td>)}</tr>)}</tbody></table></div>
        <footer><span>共 {filtered.length} 条　|　第 {current}/{totalPages} 页</span><span className="pager"><button disabled={current <= 1} onClick={() => setPageNum(current - 1)}>上一页</button><button disabled={current >= totalPages} onClick={() => setPageNum(current + 1)}>下一页</button></span><span>点击任意记录查看证据摘要</span></footer>
        {selected && <Detail item={selected} onClose={() => setSelected(null)} />}
      </> : <SourcePage type={page} />}
    </section>
  </main>;
}

function Detail({ item, onClose }) { return <div className="detail"><div><button onClick={onClose}>×</button><h2>{item.title}</h2><p><b>开标日期：</b>{item.bidOpenDate ? `${item.bidOpenDate}（${item.openStatus || '未披露'}）` : '未披露'}{item.resultGap ? '　⚠ 已开标但台账未收录对应中标结果，建议反查官方原文' : ''}</p><p><b>证据摘要：</b>{item.evidence}</p><p><b>原始页面：</b><a href={item.url} target="_blank" rel="noreferrer">打开原文 ↗</a></p><p className="hint">金额、型号或中标单位未在公开原文披露的，统一标注“未披露/待核实”，不以猜测补全。</p></div></div>; }

function SourcePage({ type }) {
  const authentication = type === '平台清单';
  const entries = platformLibrary.filter(platform => authentication ? platform.access !== 'anonymous' : platform.access === 'anonymous');
  const accessLabel = access => access === 'registration_required' ? '需注册/登录' : '需登录/会员';
  return <div className="source-page"><p>{authentication ? '这里列的是两类受限来源：公告可看但完整文件或深度查询要注册的平台，以及本身需登录或会员的商业情报库。系统不会绕过鉴权；你登录后再在已授权会话中抓取。' : '仅保留可匿名浏览的公开入口。公开浏览不代表可以绕过下载、投标或付费权限；正式入账仍须保存原公告。'}</p><p className="source-count">已收录 {entries.length} 个{authentication ? '需鉴权' : '匿名公开'}平台。</p><table><thead><tr><th>平台</th>{authentication && <th>权限</th>}<th>覆盖内容</th><th>复审说明</th></tr></thead><tbody>{entries.map(platform => <tr key={platform.id}><td><a href={platform.entryUrl} target="_blank" rel="noreferrer">{platform.name} ↗</a></td>{authentication && <td><span className="access-tag">{accessLabel(platform.access)}</span></td>}<td>{platform.coverage}</td><td>{platform.auditNote}</td></tr>)}</tbody></table></div>;
}
