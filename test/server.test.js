import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createMcpServer } from '../src/server.js';

test('MCP server registers every REST operation and task-focused tools', () => {
  const calls = [];
  const server = createMcpServer({ request: async (...args) => { calls.push(args); return { status: 'success' }; } });
  assert.equal(Object.keys(server._registeredTools).length, 122);
  const story = server._registeredTools.get_stories_storyID;
  assert.ok(story);
  assert.ok(server._registeredTools.zentao_list_plan_stories);
  assert.ok(server._registeredTools.zentao_assigned_to_me);
  assert.ok(server._registeredTools.zentao_get_story);
});

test('stdio MCP initializes and advertises 122 usable tool schemas', async t => {
  const child = spawn(process.execPath, ['bin/zentao-helper.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, ZENTAO_URL: 'http://127.0.0.1:12345', ZENTAO_ACCOUNT: 'test', ZENTAO_PASSWORD: 'test' },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  t.after(() => child.kill());
  const lines = createInterface({ input: child.stdout });
  const replies = new Map();
  let wake;
  lines.on('line', line => { const message = JSON.parse(line); replies.set(message.id, message); wake?.(); });
  const wait = async id => {
    const deadline = Date.now() + 5000;
    while (!replies.has(id) && Date.now() < deadline) await new Promise((resolve, reject) => { wake = resolve; setTimeout(() => reject(new Error('MCP response timed out')), 5000).unref(); });
    return replies.get(id);
  };
  const send = message => child.stdin.write(`${JSON.stringify(message)}\n`);
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
  const init = await wait(1);
  assert.equal(init.result.serverInfo.name, 'zentao-helper');
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const listed = await wait(2);
  assert.equal(listed.result.tools.length, 122);
  const story = listed.result.tools.find(x => x.name === 'get_stories_storyID');
  assert.deepEqual(story.inputSchema.required, ['storyID']);
});
