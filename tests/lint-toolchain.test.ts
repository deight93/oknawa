import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('eslint-config-next'));
const { Linter } = require('eslint');

test('legacy React plugin glob options still enforce forbidden props', () => {
  const linter = new Linter();
  const messages = linter.verify(
    'const card = <Card data-private="secret" />;',
    [
      {
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { react: nextRequire('eslint-plugin-react') },
        rules: {
          'react/forbid-component-props': [
            'error',
            { forbid: [{ propNamePattern: 'data-*' }] },
          ],
        },
      },
    ],
  );
  assert.equal(messages.length, 1);
  assert.equal(messages[0].ruleId, 'react/forbid-component-props');
});

test('legacy import plugin path groups still detect wrong import order', () => {
  const linter = new Linter();
  const messages = linter.verify(
    'import local from "./local";\nimport ui from "@ui/button";',
    [
      {
        plugins: { import: nextRequire('eslint-plugin-import') },
        rules: {
          'import/order': [
            'error',
            {
              groups: ['external', 'internal', 'sibling'],
              pathGroups: [{ pattern: '@ui/**', group: 'external' }],
              pathGroupsExcludedImportTypes: [],
            },
          ],
        },
      },
    ],
  );
  assert.ok(
    messages.some(
      (message: { ruleId: string }) => message.ruleId === 'import/order',
    ),
  );
});

test('legacy accessibility plugin component globs still recognize labels', () => {
  const linter = new Linter();
  const messages = linter.verify(
    'const field = <label>Name<MyInput /></label>;',
    [
      {
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { 'jsx-a11y': nextRequire('eslint-plugin-jsx-a11y') },
        rules: {
          'jsx-a11y/label-has-associated-control': [
            'error',
            { controlComponents: ['My*'] },
          ],
        },
      },
    ],
  );
  assert.equal(messages.length, 0);
});
