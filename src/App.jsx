import { useMemo, useState } from 'react';
import rows from './data/intelligence.json';
import platformLibrary from '../config/platform-library.json';
import './styles.css';
import './table-fix.css';
import './intelligence.css';
import './platform-library.css';

const icons = ['▣', '◉', '◌'];

export default function App() {
  const [line, setLine] = useState('全部');
  const [competitor, setCompetitor] = useState('全部');
  const [region, setRegion] = useState('全部');
  const [confidence, setConfidence] = useState('全部');
  const [page, setPage] = useState('情报台账');
  const [selected, setSelected] = useState(null);
  const filtered = useMemo(() => rows.filter(item => (line === '全部' || item.line === line) && (competitor === '全部' || item.competitor === competitor) && (region === '全部' || item.region === region) && (confidence === '全部' || item.confidence === confidence)), [line, competitor, region, confidence]);
  const options = key => ['全部', ...new Set(rows.map(item => item[key]))];
  const select = (value, setter, key) => <select value={value} onChange={event => setter(event.target.value)}>{options(key).map(item => <option key={item}>{item}</option>)}</select>;

  return <main className="shell">
    <aside><div className="brand"><div className="mark">◈</div><b>唐山像素智能</b></div><nav>{['情报台账', '来源分类', '平台清单'].map((item, index) => <button className={page === item ? 'active' : ''} onClick={() => setPage(item)} key={item}><i>{icons[index]}</i>{item}</button>)}</nav></aside>
    <section className="workspace"><header><h1>{page === '情报台账' ? '公开情报台账' : page}</h1><div><button className="export" onClick={() => window.print()}>导出 / 打印</button></div></header>
      {page === '情报台账' ? <>
        <div className="filters"><label>产品线{select(line, setLine, 'line')}</label><label>竞品{select(competitor, setCompetitor, 'competitor')}</label><label>地区{select(region, setRegion, 'region')}</label><label>置信度{select(confidence, setConfidence, 'confidence')}</label></div>
        <div className="tablebox"><table><thead><tr>{['情报标题', '产品线', '竞品', '地区', '金额', '中标情况', '来源', '置信度', '发布日期'].map(item => <th key={item}>{item}</th>)}</tr></thead><tbody>{filtered.map(item => <tr key={item.url} onClick={() => setSelected(item)}>{[item.title, item.line, item.competitor, item.region, item.amount, item.bid, <a href={item.url} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>{item.source} ↗</a>, item.confidence, item.date].map((value, index) => <td className={index === 5 ? `bid ${item.bid}` : index === 7 ? `confidence ${item.confidence}` : ''} key={index}>{value}</td>)}</tr>)}</tbody></table></div>
        <footer><span>共 {filtered.length} 条　|　最近更新：2026-07-30</span><span>点击任意记录查看证据摘要</span></footer>
        {selected && <Detail item={selected} onClose={() => setSelected(null)} />}
      </> : <SourcePage type={page} />}
    </section>
  </main>;
}

function Detail({ item, onClose }) { return <div className="detail"><div><button onClick={onClose}>×</button><h2>{item.title}</h2><p><b>证据摘要：</b>{item.evidence}</p><p><b>原始页面：</b><a href={item.url} target="_blank" rel="noreferrer">打开原文 ↗</a></p><p className="hint">金额、型号或中标单位未在公开原文披露的，统一标注“未披露/待核实”，不以猜测补全。</p></div></div>; }

function SourcePage({ type }) {
  const authentication = type === '平台清单';
  const entries = platformLibrary.filter(platform => authentication ? platform.access === 'login_required' : platform.access === 'anonymous');
  return <div className="source-page"><p>{authentication ? '需账号、注册或付费的平台只列入口；系统不会绕过鉴权。' : '匿名公开平台库：公开浏览不代表可以绕过下载、投标或付费权限。每周会复审平台入口可达性。'}</p><p className="source-count">已收录 {entries.length} 个{authentication ? '需鉴权' : '匿名公开'}平台。</p><table><thead><tr><th>平台</th><th>覆盖内容</th><th>复审说明</th></tr></thead><tbody>{entries.map(platform => <tr key={platform.id}><td><a href={platform.entryUrl} target="_blank" rel="noreferrer">{platform.name} ↗</a></td><td>{platform.coverage}</td><td>{platform.auditNote}</td></tr>)}</tbody></table></div>;
}
