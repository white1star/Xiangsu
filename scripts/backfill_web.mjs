// 回填 Web 交叉搜索确认的金额 + 清除误匹配记录
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FLAT = path.join(__dirname, '../src/data/intelligence.flat.json');
const data = JSON.parse(fs.readFileSync(FLAT, 'utf8'));
console.log('回填前条数:', data.length);

// 1) 删除误匹配：钟山区汪家寨镇煤矸石填沟造地（土地整治工程，非智能干选）
const before = data.length;
const cleaned = data.filter(r => !(r.title || '').includes('煤矸石填沟造地'));
console.log('删除误匹配（汪家寨填沟造地）:', before - cleaned.length, '条');

let patched = 0;
const patch = (match, fields, label) => {
  const r = cleaned.find(match);
  if (!r) { console.log('!! 未找到:', label); return; }
  Object.assign(r, fields);
  patched++;
  console.log('已回填:', label, '->', fields.amount || '(仅备注)');
};

// 2) 中富候选人公示：90万系噪声，修正为第一候选人报价
patch(
  r => (r.title || '').includes('中富矿业') && (r.title || '').includes('中标候选人'),
  {
    amount: '279.13万元',
    competitor: '天津美腾科技股份有限公司（第一候选人）',
    amountNote: '第一中标候选人天津美腾报价279.13万元（第二候选人唐山神州269万元）；原抽取值90万元为保证金噪声，已修正。金额与中标结果公告2791300元一致。',
  },
  '中富候选人公示'
);

// 3) 大南湖一矿候选人公示：回填中煤建安报价
patch(
  r => (r.title || '').includes('大南湖一矿') && (r.title || '').includes('中标候选人'),
  {
    amount: '6878.6万元',
    amountNote: '第2次中标候选人公示：第一候选人中煤建筑安装工程集团报价6878.6万元（第二候选人大地工程开发集团6988.12万元）。系原煤干选系统建设整体EPC价，含土建安装，非单纯设备价。金额经Web交叉检索确认。',
  },
  '大南湖候选人公示'
);

// 4) 漳村煤矿维保三次招标：回填前次成交参考价
patch(
  r => (r.title || '').includes('漳村煤矿') && (r.title || '').includes('维保'),
  {
    amount: '50.5万元',
    competitor: '北京霍里思特科技有限公司（前次成交）',
    amountNote: '本条为三次招标公告，正文金额需登录查看；回填同项目前次（二次询比）成交价50.5万元，成交方霍里思特（设备型号TT104-20-X）。经Web交叉检索确认。',
  },
  '漳村维保三次招标'
);

// 5) 补充无法获得金额的原因备注（如实标注，不留空白理由）
patch(
  r => (r.title || '').includes('红四煤矿') && (r.title || '').includes('招标公告'),
  {
    amountNote: '乙方宝付费墙遮蔽全文；Web交叉检索仅见红四煤矿项目核准总投资33.74亿元（2019年），智能干选机设备预算未在任何公开渠道披露。',
  },
  '宝丰红四备注'
);
patch(
  r => (r.title || '').includes('玲珑') && (r.title || '').includes('分选机'),
  {
    amountNote: '招标公告未设预算；2026-07-28已开标，截至抓取日中标结果尚未公示，待跟踪。',
    resultGap: true,
  },
  '玲珑备注'
);
patch(
  r => (r.title || '').includes('胜利能源') && (r.title || '').includes('干选'),
  {
    amountNote: '中标结果公告中"中标人/中标金额"栏填写为"无"（疑似流标或废标），公开渠道无成交金额。',
  },
  '胜利能源备注'
);
patch(
  r => (r.title || '').includes('铁煤') && (r.title || '').includes('招标公告') && !(r.title || '').includes('候选人'),
  {
    amountNote: '招标公告未含预算；同批次中标候选人公示已披露338万元（丹东东方测控），见项目时间线。',
  },
  '铁煤98批招标公告备注'
);

console.log('回填/备注条数:', patched);
console.log('回填后条数:', cleaned.length);
fs.writeFileSync(FLAT, JSON.stringify(cleaned, null, 2), 'utf8');
console.log('已写入', FLAT);
