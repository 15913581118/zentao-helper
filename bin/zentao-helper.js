#!/usr/bin/env node
import { input, password } from '@inquirer/prompts';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { configPath, loadConfig, saveConfig } from '../src/config.js';
import { ZenTaoClient } from '../src/client.js';
import { createMcpServer } from '../src/server.js';

const command = process.argv[2] || 'serve';

async function setup() {
  if (!process.stdin.isTTY) throw new Error('初始化需要交互式终端。请在终端运行 npx zentao-helper setup，或设置 ZENTAO_URL、ZENTAO_ACCOUNT、ZENTAO_PASSWORD 环境变量。');
  const url = await input({ message: '禅道地址（站点地址或 API v2 地址）' });
  const account = await input({ message: '禅道账号' });
  const secret = await password({ message: '禅道密码', mask: '*' });
  const file = await saveConfig({ url, account, password: secret });
  const client = new ZenTaoClient(await loadConfig(file));
  try { await client.login(); process.stderr.write(`配置已保存到 ${file}；登录验证成功。\n`); }
  catch (error) { process.stderr.write(`配置已保存到 ${file}；登录验证失败：${error.message}\n`); process.exitCode = 1; }
}

async function doctor() {
  const client = new ZenTaoClient(await loadConfig());
  await client.login();
  const result = await client.request('GET', '/products', { recPerPage: '1' });
  process.stderr.write(`连接正常，认证方式 ${client.config.token ? 'Token' : `账号 ${client.config.account}`}，产品列表可读取（${result.products?.length || 0} 条样本）。\n`);
}

try {
  if (command === 'setup') await setup();
  else if (command === 'doctor') await doctor();
  else if (command === 'serve') {
    const config = await loadConfig();
    const client = new ZenTaoClient(config);
    serveStdio(() => createMcpServer(client));
  } else if (command === '--help' || command === 'help') {
    process.stdout.write('zentao-helper\n\n  npx zentao-helper setup   首次配置地址、账号、密码\n  npx zentao-helper doctor  验证连接\n  npx zentao-helper         启动 MCP stdio 服务\n');
  } else throw new Error(`未知命令：${command}`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
