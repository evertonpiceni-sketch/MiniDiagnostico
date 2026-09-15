import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const enhancer = fs.readFileSync(new URL('../src/result-enhancer.ts', import.meta.url), 'utf8');
const content = fs.readFileSync(new URL('../src/result-content.ts', import.meta.url), 'utf8');

test('result source is canonical and uses approved clean assets', () => {
  assert.ok(enhancer.includes('RESULT_CONTENT'));
  assert.ok(enhancer.includes('/result-assets/medo-hero-clean.jpg'));
  assert.ok(enhancer.includes('/ja-logo-approved.webp'));
  assert.ok(!enhancer.includes('src="/ja-logo.webp'));
  assert.ok(content.includes('O medo nem sempre impede você de querer avançar. Muitas vezes, ele faz você buscar segurança antes de se permitir tentar.'));
});
