import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeUrl, saveConfig, loadConfig } from '../src/config.js';
import { ZenTaoClient } from '../src/client.js';
import { operations, toolSchema, renderPath } from '../src/openapi.js';
import { listPlanStories, assignedToMe } from '../src/workflows.js';

test('configuration normalizes and protects stored credentials', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'zentao-helper-'));
  const file = join(dir, 'config.json');
  assert.equal(normalizeUrl('https://example.test/'), 'https://example.test/api.php/v2');
  assert.equal(normalizeUrl('https://example.test/api.php/v2/'), 'https://example.test/api.php/v2');
  await saveConfig({ url: 'https://example.test', account: 'alice', password: 'secret' }, file);
  assert.deepEqual(await loadConfig(file), { url: 'https://example.test/api.php/v2', account: 'alice', password: 'secret' });
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).password, 'secret');
});

test('all 119 operations include path parameters and render safely', () => {
  assert.equal(operations.length, 119);
  const story = operations.find(x => x.name === 'get_stories_storyID');
  assert.ok(story);
  assert.ok(toolSchema(story).required.includes('storyID'));
  assert.equal(renderPath(story.path, { storyID: 'a/b' }), '/stories/a%2Fb');
  assert.throws(() => renderPath(story.path, {}));
});

test('client logs in, sends token and retries expired token', async t => {
  let logins = 0; const headers = [];
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api.php/v2/users/login') { logins++; res.end(JSON.stringify({ status: 'success', token: `t${logins}` })); return; }
    headers.push(req.headers.token);
    if (req.headers.token === 't1') { res.statusCode = 401; res.end('{}'); return; }
    res.end(JSON.stringify({ status: 'success', body: JSON.parse(Buffer.concat(chunks).toString() || '{}') }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const client = new ZenTaoClient({ url: `http://127.0.0.1:${server.address().port}/api.php/v2`, account: 'alice', password: 'pw' });
  const result = await client.request('PUT', '/tasks/12/finish', {}, { currentConsumed: 1 });
  assert.deepEqual(result.body, { currentConsumed: 1 });
  assert.deepEqual(headers, ['t1', 't2']);
  assert.equal(logins, 2);
});

test('existing API token may be supplied through environment without password', async t => {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push({ url: req.url, token: req.headers.token });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'success', products: [] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const client = new ZenTaoClient({ url: `http://127.0.0.1:${server.address().port}`, token: 'local-token' });
  await client.request('GET', '/products');
  assert.deepEqual(seen, [{ url: '/api.php/v2/products', token: 'local-token' }]);
});

test('workflows resolve a plan and list assigned stories and bugs', async () => {
  const calls = [];
  const client = { request: async (method, path, query) => {
    calls.push({ method, path, query });
    if (path === '/products') return { products: [{ id: '9' }] };
    if (path.endsWith('/productplans')) return { productplans: [{ id: '155', title: 'V1.1', product: '9' }] };
    if (path.endsWith('/stories')) return { stories: [{ id: '1', plan: '155' }, { id: '2', plan: '200' }], pager: { pageCount: 1 } };
    if (path.endsWith('/bugs')) return { bugs: [{ id: '3' }], pager: { pageCount: 1 } };
    throw new Error(path);
  }};
  const plan = await listPlanStories(client, { plan: 'V1.1' });
  assert.deepEqual(plan.stories.map(x => x.id), ['1']);
  const mine = await assignedToMe(client, { kind: 'all' });
  assert.deepEqual(mine.stories.map(x => x.id), ['1', '2']);
  assert.deepEqual(mine.bugs.map(x => x.id), ['3']);
  assert.ok(calls.some(x => x.query?.browseType === 'allstory'));
  assert.ok(calls.some(x => x.query?.browseType === 'assignedtome'));
});
