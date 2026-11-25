import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createApp } from './app';
import contract from '../openapi.snapshot.json' with { type: 'json' };

const { app, openapi } = await createApp();
try {
  assert.deepEqual(Object.keys(openapi.paths).sort(), Object.keys(contract.paths).sort());
  for (const [path, operations] of Object.entries(contract.paths)) {
    const actual = openapi.paths[path];
    assert.deepEqual(Object.keys(actual), Object.keys(operations));
    for (const [method, expected] of Object.entries(operations)) {
      const route = actual[method as 'get' | 'put' | 'post'];
      assert(route);
      assert.equal(route.operationId, expected.operationId);
      assert.deepEqual(Object.keys(route.responses).sort(), Object.keys(expected.responses).sort());
      if ('requestBody' in expected) {
        assert.deepEqual(route.requestBody, {
          content: {
            'application/json': { schema: expected.requestBody.content['application/json'].schema },
          },
          required: true,
        });
      }
    }
  }
  const output = process.argv[2];
  if (output) await writeFile(output, JSON.stringify(openapi, null, 2) + '\n');
  console.log('NestJS routes match the OpenAPI snapshot');
} finally {
  await app.close();
}
