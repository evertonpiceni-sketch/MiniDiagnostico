import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const enhancer = fs.readFileSync(new URL('../src/result-enhancer.ts', import.meta.url), 'utf8');
const content = fs.readFileSync(new URL('../src/result-content.ts', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/result-clean-final.css', import.meta.url), 'utf8');

test('final result uses clean approved assets and canonical content', () => {
  assert.match(enhancer, /RESULT_CONTENT/);
  assert.match(enhancer, /medo-hero-clean\.jpg/);
  assert.match(enhancer, /ja-logo-approved\.webp/g);
  assert.doesNotMatch(enhancer, /src=\\?"\/ja-logo\.webp/);
  assert.match(css, /data-pattern=\\?"MEDO\\?"/);
  assert.match(content, /O medo nem sempre impede você de querer avançar/);
});
