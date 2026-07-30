import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platforms = JSON.parse(await readFile(path.join(root, 'config', 'platform-library.json'), 'utf8'));

async function inspect(platform) {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(platform.entryUrl, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Pixel-Intelligence-Monitor/1.0' } });
    return { id: platform.id, name: platform.name, access: platform.access, entryUrl: platform.entryUrl, status: response.status, reachable: response.status >= 200 && response.status < 400, checkedAt };
  } catch (error) { return { id: platform.id, name: platform.name, access: platform.access, entryUrl: platform.entryUrl, reachable: false, error: error.message, checkedAt }; }
}

const results = [];
for (const platform of platforms) results.push(await inspect(platform));
const summary = { checkedAt: new Date().toISOString(), total: results.length, reachable: results.filter(item => item.reachable).length, unavailable: results.filter(item => !item.reachable).map(item => item.name), results };
const output = path.join(root, 'public', 'data', 'platform-audit.json');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary));
