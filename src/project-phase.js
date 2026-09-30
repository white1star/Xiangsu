// 项目阶段：把一个项目映射到六档之一。
// 数据依据 intelligence.json 的实际字段：bid（最新阶段）、timeline/stages（多阶段）、bidOpenDate/openStatus。
// 判定顺序：终止 > 完成 > 中标 > 待定标 > 招标中。
export const PROJECT_PHASES = ['已终止', '已完成', '已中标', '待定标', '招标中'];

const TERMINAL = /流标|废标|终止公告|终止/;
const DONE = /已签约|已交付|已投运|已验收/;
const WON = /已中标|中标候选人|中标结果/;

// 阶段推进顺序：数字越大越靠后
const RANK = {
  招标计划: 1, 招标公告: 2, 询比价: 2, 询价: 2,
  中标候选人: 3, 中标结果公示: 4, 已中标: 4, 中标结果: 4,
  直接签约: 4, 已签约: 4, 已交付: 5, 已投运: 5,
  流标: 6, 废标: 6,
};
// "重大销售合同公告（非招投标）" 这类带括号的长键单独处理
const RANK_CONTRACT = /重大销售合同公告/;

export function rankPhase(phase) {
  if (RANK_CONTRACT.test(String(phase))) return 4;
  return RANK[phase] || 0;
}

function phaseFromText(text) {
  if (TERMINAL.test(text)) return '已终止';
  if (DONE.test(text)) return '已完成';
  if (WON.test(text)) return '已中标';
  return null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// 单条公告记录 → 阶段
export function phaseOfRecord(record) {
  const text = `${record.bid || ''} ${record.bidStatus || ''}`;
  const hit = phaseFromText(text);
  if (hit) return hit;
  const openDate = record.bidOpenDate || record.openDate || '';
  if (openDate && openDate < today()) return '待定标';
  return '招标中';
}

// 一个项目（含 timeline 多阶段）→ 阶段：取所有阶段里最靠后的那个
export function projectPhase(project) {
  const stages = [];
  if (Array.isArray(project.stages)) stages.push(...project.stages);
  if (Array.isArray(project.timeline)) stages.push(...project.timeline.map(t => t.bid || t.stage));
  if (project.bid) stages.push(project.bid);

  let best = '招标中';
  let bestRank = 0;
  for (const raw of stages) {
    const stage = String(raw || '');
    if (!stage) continue;
    // 先看是不是终止类（终止优先级最高）
    if (TERMINAL.test(stage)) return '已终止';
    const phase = phaseFromText(stage);
    const rank = RANK[stage] || (phase ? rankPhase(phase) : 0);
    if (rank > bestRank) { bestRank = rank; best = phase || best; }
  }
  // 没有任何结果阶段，但开标日已过 → 待定标
  if (bestRank < 3) {
    const openDate = project.bidOpenDate || project.openDate || '';
    if (openDate && openDate < today()) return '待定标';
  }
  return best;
}
