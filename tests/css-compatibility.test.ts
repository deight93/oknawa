import assert from 'node:assert/strict';
import { test } from 'node:test';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import config from '../postcss.config';

test('production CSS preserves Safari prefixes for panel blur, selection and decoration', async () => {
  const result = await postcss([
    autoprefixer(config.plugins.autoprefixer),
  ]).process(
    '.panel { backdrop-filter: blur(12px); user-select: none; text-decoration: underline dotted; }',
    { from: undefined },
  );
  const declarations = new Map<string, string>();
  result.root.walkDecls(declaration => {
    declarations.set(declaration.prop, declaration.value);
  });

  for (const [property, value] of [
    ['backdrop-filter', 'blur(12px)'],
    ['user-select', 'none'],
    ['text-decoration', 'underline dotted'],
  ]) {
    assert.equal(declarations.get(property), value);
    assert.equal(declarations.get(`-webkit-${property}`), value);
  }
});
