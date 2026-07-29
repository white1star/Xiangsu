import { useMemo, useState } from 'react';
import rows from './data/intelligence.json';
import './styles.css';
import './table-fix.css';
import './intelligence.css';

const legacyRows = [
  { title:'神东保德选煤厂智能干选改造 EPC 智能干选机采购（二次）中标', line:'煤炭智能干选设备', competitor:'霍里思特科技（浙江）有限公司', region:'山西保德', amount:'754.00万元', bid:'已中标', source:'中国煤科电子采购平台', date:'2026-03-09', confidence:'高', url:'https://cg.ccteg.cn/cms/channel/ywgg4hw/72286.htm', evidence:'官方中标公告：中标人为霍里思特科技（浙江）有限公司，中标价格7,540,000元。' },
  { title:'宁夏煤业汝箕沟无烟煤分公司智能干选机设备采购中标候选人公示', line:'煤炭智能干选设备', competitor:'威海市海王科技有限公司（第一候选人）', region:'宁夏石嘴山', amount:'305.00万元', bid:'中标候选人', source:'国能e招', date:'2026-05-20', confidence:'高', url:'https://www.chnenergybidding.com.cn/bidweb/001/001005/001005001/20260520/02f5392b-b995-4bf7-800b-547deaf52c08.html', evidence:'公开候选人公示：第一候选人威海市海王科技有限公司报价305万元；第二候选人唐山神州机械集团报价307.58万元。' },
  { title:'新集二矿智能干选机等设备采购中标公告', line:'煤炭智能干选设备', competitor:'待核实（原公告待打开）', region:'安徽淮南', amount:'未披露', bid:'已中标', source:'中煤招标与采购网', date:'2025-01-13', confidence:'高', url:'https://www.zmzb.com/cms/channel/ywgg5hw/47688.htm', evidence:'中国中煤招标与采购网公开中标公告，项目名称明确包含新集二矿智能干选机设备采购。' },
  { title:'郭家台二号煤矿选煤厂 TDS 智能干选机设备采购', line:'煤炭智能干选设备', competitor:'待核实（结果页需提取）', region:'甘肃白银', amount:'未披露', bid:'已中标', source:'环保招标网（公开聚合）', date:'2026-05-18', confidence:'中', url:'https://www.huanbaozhaobiao.com/news-330493080e6092b29b8b93b66e5d82f3/', evidence:'公开项目进度显示已发布中标结果；采购内容为1台 TDS 智能干选机及配套布料、除尘、电控等。待以原始交易平台公告补足供应商和金额。' },
  { title:'窑街煤电金河煤矿智能干选系统采购项目中标结果公告', line:'煤炭智能干选设备', competitor:'待核实（需打开原公告核验）', region:'甘肃兰州', amount:'未披露', bid:'已中标', source:'甘肃经济信息网', date:'2026-02-02', confidence:'高', url:'https://www.gsei.com.cn/html/1337/2026-02-02/content-651015.html', evidence:'公开中标结果公告；原公告可用于补录中标单位、金额和型号。' },
  { title:'淮北矿业涡北选煤厂干选机及配件公开招标（第2次）', line:'煤炭智能干选设备', competitor:'待开标', region:'安徽淮北', amount:'未披露', bid:'招标中', source:'中国煤炭招标网', date:'2026-05-27', confidence:'中', url:'https://www.mtzbw.cn/bids/meitan_500201796.html', evidence:'公开招标信息，要求投标人具备干选机销售业绩；正式文件需在淮北矿业电子招标采购平台获取。' },
  { title:'大南湖一矿原煤干选系统建设项目中标', line:'煤炭智能干选设备', competitor:'中煤建设集团新疆分公司（待核实）', region:'新疆哈密', amount:'未披露', bid:'已中标', source:'中国中煤官网', date:'2025-11-06', confidence:'高', url:'https://zmjaxj.chinacoal.com/xwzx/jcdt/art/2025/art_fc0cd36c53ac407f8c7368db59723397.html', evidence:'中国中煤所属单位新闻明确披露成功中标国源电力哈密煤电公司大南湖一矿原煤干选系统建设项目。' },
];

const anonymousSources = [
  ['中国中煤官网','匿名可访问','项目投运、技术应用、中标新闻'],['中国煤科电子采购平台','匿名可访问','招标、中标与采购公告'],['国家能源招标网（国能e招）','匿名可访问','招标、中标候选人、行业标准线索'],['华特/霍里思特/HOT官网','匿名可访问','产品、案例、展会与技术动态'],['巨潮资讯/交易所公告','匿名可访问','上市公司定期报告与公告']
];
const authenticatedSources = [
  ['企查查、天眼查','需登录/付费','工商变更、融资、司法与关系图谱'],['淮北矿业等采购平台','需注册后获取','招标文件、附件、报价与投标明细'],['付费招标数据库','需登录/付费','聚合招标线索与历史项目']
];

export default function App() {
  const [line, setLine] = useState('全部'); const [competitor, setCompetitor] = useState('全部'); const [region, setRegion] = useState('全部'); const [confidence, setConfidence] = useState('全部'); const [page, setPage] = useState('情报台账'); const [selected, setSelected] = useState(null);
  const filtered = useMemo(() => rows.filter(r => (line==='全部'||r.line===line) && (competitor==='全部'||r.competitor===competitor) && (region==='全部'||r.region===region) && (confidence==='全部'||r.confidence===confidence)), [line,competitor,region,confidence]);
  const options = key => ['全部', ...new Set(rows.map(r=>r[key]))];
  const select = (value, setValue, key) => <select value={value} onChange={e=>setValue(e.target.value)}>{options(key).map(x=><option key={x}>{x}</option>)}</select>;
  return <main className="shell"><aside><div className="brand"><div className="mark">◈</div><b>唐山像素智能</b></div><nav>{['情报台账','来源分类','平台清单'].map((x,i)=><button className={page===x?'active':''} onClick={()=>setPage(x)} key={x}><i>{['▣','◉','◌'][i]}</i>{x}</button>)}</nav></aside><section className="workspace"><header><h1>{page==='情报台账'?'公开情报台账':page}</h1><div><button className="export" onClick={()=>window.print()}>导出 / 打印</button></div></header>{page==='情报台账'?<><div className="filters"><label>产品线{select(line,setLine,'line')}</label><label>竞品{select(competitor,setCompetitor,'competitor')}</label><label>地区{select(region,setRegion,'region')}</label><label>置信度{select(confidence,setConfidence,'confidence')}</label></div><div className="tablebox"><table><thead><tr>{['情报标题','产品线','竞品','地区','金额','中标情况','来源','置信度','发布日期'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{filtered.map((r,i)=><tr key={i} onClick={()=>setSelected(r)}>{[r.title,r.line,r.competitor,r.region,r.amount,r.bid,<a href={r.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}>{r.source} ↗</a>,r.confidence,r.date].map((x,j)=><td className={j===5?`bid ${r.bid}`:j===7?`confidence ${r.confidence}`:''} key={j}>{x}</td>)}</tr>)}</tbody></table></div><footer><span>共 {filtered.length} 条　|　最近更新：2026-07-29</span><span>点击任意记录查看证据摘要</span></footer>{selected&&<div className="detail"><div><button onClick={()=>setSelected(null)}>×</button><h2>{selected.title}</h2><p><b>证据摘要：</b>{selected.evidence}</p><p><b>原始页面：</b><a href={selected.url} target="_blank" rel="noreferrer">打开原文 ↗</a></p><p className="hint">金额、型号或中标单位未在公开原文披露的，统一标注“未披露/待核实”，不以猜测补全。</p></div></div>}</>:<SourcePage rows={page==='来源分类'?anonymousSources:authenticatedSources} type={page}/>}</section></main>;
}

function SourcePage({rows,type}) { const auth = type==='平台清单'; return <div className="source-page"><p>{auth?'需要账号、注册或付费的平台只列出入口，不自动绕过鉴权。':'以下为已纳入每周一自动抓取范围的匿名公开平台。'}</p><table><thead><tr><th>平台</th><th>访问方式</th><th>抓取内容</th></tr></thead><tbody>{rows.map(r=><tr key={r[0]}>{r.map(x=><td key={x}>{x}</td>)}</tr>)}</tbody></table></div> }
