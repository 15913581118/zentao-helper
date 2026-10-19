async function allPages(client, path, key, query = {}) {
  const collected = [];
  for (let page = 1; page <= 1000; page++) {
    const data = await client.request('GET', path, { ...query, recPerPage: '1000', pageID: String(page) });
    const items = data[key] || [];
    collected.push(...items);
    const pageCount = Number(data.pager?.pageCount || data.pager?.totalPages || 1);
    if (page >= pageCount || items.length === 0) break;
  }
  return collected;
}

async function productIds(client, product) {
  if (product !== undefined && product !== null && product !== '') return [String(product)];
  const products = await allPages(client, '/products', 'products');
  return products.map(x => String(x.id));
}

export async function listPlanStories(client, { plan, product } = {}) {
  if (!plan) throw new Error('需要产品计划 ID 或名称');
  const matches = [];
  for (const productID of await productIds(client, product)) {
    const plans = await allPages(client, `/products/${encodeURIComponent(productID)}/productplans`, 'productplans', { browseType: 'all' });
    matches.push(...plans.filter(x => String(x.id) === String(plan) || String(x.title).toLowerCase().includes(String(plan).toLowerCase())).map(x => ({ ...x, product: x.product || productID })));
  }
  if (!matches.length) throw new Error(`未找到产品计划：${plan}`);
  if (matches.length > 1) throw new Error(`找到多个产品计划，请指定 ID 或产品：${matches.map(x => `${x.id} ${x.title}`).join('；')}`);
  const selected = matches[0];
  const stories = await allPages(client, `/products/${encodeURIComponent(String(selected.product))}/stories`, 'stories', { browseType: 'allstory' });
  return { plan: selected, stories: stories.filter(x => String(x.plan).split(',').map(v => v.trim()).includes(String(selected.id))) };
}

export async function assignedToMe(client, { kind = 'all', product } = {}) {
  if (!['all', 'story', 'bug'].includes(kind)) throw new Error('kind 必须为 all、story 或 bug');
  const result = { stories: [], bugs: [] };
  for (const productID of await productIds(client, product)) {
    const prefix = `/products/${encodeURIComponent(productID)}`;
    if (kind !== 'bug') result.stories.push(...await allPages(client, `${prefix}/stories`, 'stories', { browseType: 'assignedtome' }));
    if (kind !== 'story') result.bugs.push(...await allPages(client, `${prefix}/bugs`, 'bugs', { browseType: 'assignedtome' }));
  }
  return result;
}
