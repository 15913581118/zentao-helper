import { normalizeUrl, validateConfig } from './config.js';

export class ZenTaoClient {
  constructor(config, fetcher = fetch) {
    this.config = validateConfig(config);
    this.base = normalizeUrl(config.url);
    this.fetcher = fetcher;
    this.token = this.config.token || null;
  }

  async login() {
    if (this.config.token) return this.config.token;
    const response = await this.fetcher(`${this.base}/users/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account: this.config.account, password: this.config.password }),
      redirect: 'manual'
    });
    const data = await response.json();
    if (!response.ok || data.status !== 'success' || !data.token) throw new Error(`禅道登录失败：HTTP ${response.status} ${data.message || data.error || ''}`.trim());
    this.token = data.token;
    return data.token;
  }

  async request(method, path, query = {}, body, retry = true) {
    if (!/^\/[A-Za-z0-9_./%:-]*$/.test(path) || path.includes('..')) throw new Error('无效的 API 路径');
    if (!this.token && path !== '/users/login') await this.login();
    const url = new URL(`${this.base}${path}`);
    for (const [key, value] of Object.entries(query || {})) if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    const headers = { accept: 'application/json' };
    if (this.token) headers.token = this.token;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await this.fetcher(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    if (response.status === 401 && retry && path !== '/users/login' && !this.config.token) { this.token = null; await this.login(); return this.request(method, path, query, body, false); }
    const raw = await response.text();
    let data;
    try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`禅道返回非 JSON 响应：HTTP ${response.status}`); }
    if (!response.ok || data.status === 'fail') throw new Error(`禅道请求失败：HTTP ${response.status} ${data.message || data.error || JSON.stringify(data)}`);
    return data;
  }
}
