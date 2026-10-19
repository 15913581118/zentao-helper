import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export function configPath() {
  const base = process.env.XDG_CONFIG_HOME || (process.platform === 'win32' ? process.env.APPDATA : join(homedir(), '.config'));
  return join(base, 'zentao-helper', 'config.json');
}

export function normalizeUrl(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('禅道地址必须是没有账号、查询参数或片段的 HTTP(S) URL');
  const path = url.pathname.replace(/\/+$/, '');
  if (path.endsWith('/api.php/v2')) url.pathname = path;
  else if (path.endsWith('/api.php')) url.pathname = `${path}/v2`;
  else url.pathname = `${path}/api.php/v2`;
  return url.toString().replace(/\/$/, '');
}

export function validateConfig(config) {
  const url = normalizeUrl(config.url);
  if (config.token) return { url, token: config.token };
  if (!config.account?.trim() || !config.password) throw new Error('需要禅道账号和密码');
  return { url, account: config.account.trim(), password: config.password };
}

export async function saveConfig(config, file = configPath()) {
  const value = validateConfig(config);
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'w' });
  await chmod(file, 0o600);
  return file;
}

export async function loadConfig(file = configPath()) {
  if (process.env.ZENTAO_URL && process.env.ZENTAO_TOKEN) return validateConfig({ url: process.env.ZENTAO_URL, token: process.env.ZENTAO_TOKEN });
  const fromEnv = process.env.ZENTAO_URL && process.env.ZENTAO_ACCOUNT && process.env.ZENTAO_PASSWORD;
  if (fromEnv) return validateConfig({ url: process.env.ZENTAO_URL, account: process.env.ZENTAO_ACCOUNT, password: process.env.ZENTAO_PASSWORD });
  return validateConfig(JSON.parse(await readFile(file, 'utf8')));
}
