import { readFileSync } from 'node:fs';
import { fetchSolid } from './amount-lib.mjs';
const NUM='([\\d][\\d,，]{0,20}(?:\\.\\d+)?)';
const UNIT='(万元|万|元)';
function toYuan(s,u){const n=parseFloat(String(s).replace(/[,，]/g,''));if(!isFinite(n)||n<=0)return null;return (u==='万元'||u==='万')?n*10000:n;}
function plausible(y){return y>=10000&&y<=1e10;}
const cellText=h=>h.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\\s+/g,' ').trim();
function extractCandidates(html){const tables=html.match(/<table[\\s\\S]*?<\\/table>/gi)||[];const nameHeader=/(投标|供应|候选|中标|成交|单位|公司|供应商|成交人|中标人|厂商)\\s*名称/;const priceHeader=/(投标报价|中标价|成交价|报价|中标金额|投标总价|评标价|最终报价|合同金额|总报价)/;const out=[];for(const tb of tables){const rows=tb.match(/<tr[\\s\\S]*?<\\/tr>/gi)||[];if(rows.length<2)continue;let nameCol=-1,priceCol=-1,hr=-1,hu=null;for(let i=0;i<Math.min(rows.length,4);i++){const cells=(rows[i].match(/<t[dh][\\s\\S]*?<\\/t[dh]>/gi)||[]).map(cellText);cells.forEach((c,idx)=>{if(nameCol<0&&nameHeader.test(c)&&c.length<=16)nameCol=idx;if(priceCol<0&&priceHeader.test(c)&&c.length<=20){priceCol=idx;const m=/[（(]\\s*(万元|万|元)\\s*[)）]/.exec(c);hu=m?m[1]:null;}});if(nameCol>=0||priceCol>=0){hr=i;break;}}if(nameCol<0&&priceCol<0)continue;for(let i=hr+1;i<rows.length;i++){const cells=(rows[i].match(/<t[dh][\\s\\S]*?<\\/t[dh]>/gi)||[]).map(cellText);const nc=[];if(nameCol>=0&&nameCol<cells.length)nc.push(cells[nameCol]);if(priceCol>=0&&priceCol-1>=0&&priceCol-1<cells.length)nc.push(cells[priceCol-1]);const pc=[];if(priceCol>=0&&priceCol<cells.length)pc.push(cells[priceCol]);const company=nc.find(v=>v&&/(公司|集团|研究院|厂|中心|所|大学|学院|局)/.test(v)&&v.length>=4&&v.length<=50);let q=null;for(const p of pc){if(!p)continue;const m=new RegExp(NUM+'\\s*'+UNIT+'?').exec(p);if(!m)continue;const u=m[2]||hu||(/万/.test(p)?'万元':'元');const y=toYuan(m[1],u);if(plausible(y)){q=y;break;}}if(company&&q)out.push({rank:out.length+1,company:company.trim(),quote:Math.round(q/10000)+'万元'});}}return out;}
const d=JSON.parse(readFileSync('./src/data/intelligence.flat.json','utf8'));
for(const i of [0,6,34,49]){
  const r=d[i];
  const res=await fetchSolid(r.url,{retries:2,minBody:400});
  console.log('=== idx',i,r.title.slice(0,34));
  if(!res.ok){console.log('  FAIL',res.err);continue;}
  const c=extractCandidates(res.html,res.body);
  console.log('  候选数:',c.length);
  c.forEach(b=>console.log('   ',b.rank,b.company,b.quote));
}
