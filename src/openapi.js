import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const spec = JSON.parse(readFileSync(fileURLToPath(new URL('../spec/zentao-openapi.json', import.meta.url)), 'utf8'));
export const operations = Object.entries(spec.paths).flatMap(([path, verbs]) => Object.entries(verbs)
  .filter(([verb]) => ['get', 'post', 'put', 'delete'].includes(verb))
  .map(([verb, definition]) => ({ name: `${verb}_${path.replace(/^\//, '').replaceAll('/', '_').replaceAll(':', '')}`, method: verb.toUpperCase(), path, definition })));

export function renderPath(path, args) {
  return path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_, key) => {
    if (args[key] === undefined || args[key] === null || args[key] === '') throw new Error(`缺少路径参数 ${key}`);
    return encodeURIComponent(String(args[key]));
  });
}

function dereference(schema) {
  if (!schema) return {};
  if (schema.$ref) return dereference(schema.$ref.split('/').slice(1).reduce((node, part) => node[part], spec));
  const result = { ...schema };
  delete result.example;
  delete result.examples;
  delete result.format;
  if (result.properties) result.properties = Object.fromEntries(Object.entries(result.properties).map(([k, v]) => [k, dereference(v)]));
  if (result.items) result.items = dereference(result.items);
  if (result.allOf) result.allOf = result.allOf.map(dereference);
  if (result.oneOf) result.oneOf = result.oneOf.map(dereference);
  return result;
}

export function toolSchema(operation) {
  const properties = {};
  const required = [];
  for (const match of operation.path.matchAll(/:([A-Za-z][A-Za-z0-9]*)/g)) {
    properties[match[1]] = { type: 'string', description: '路径参数' }; required.push(match[1]);
  }
  for (const param of operation.definition.parameters || []) {
    if (param.in !== 'query') continue;
    properties[param.name] = { ...dereference(param.schema), description: param.description || param.name };
    if (param.required) required.push(param.name);
  }
  const body = operation.definition.requestBody?.content?.['application/json']?.schema;
  if (body) {
    properties.body = dereference(body);
    if (operation.definition.requestBody.required) required.push('body');
  }
  return { type: 'object', properties, required, additionalProperties: false };
}

export function queryFor(operation, args) {
  return Object.fromEntries((operation.definition.parameters || []).filter(p => p.in === 'query' && args[p.name] !== undefined).map(p => [p.name, args[p.name]]));
}
