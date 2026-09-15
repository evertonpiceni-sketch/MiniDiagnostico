import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const enhancer = fs.readFileSync(new URL('../src/result-enhancer.ts', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/result-final.css', import.meta.url), 'utf8');

test('approved result renders the canonical PDF artwork as one piece', () => {
  for (const pdf of ['medo.pdf', 'inseguranca.pdf', 'procrastinacao.pdf']) {
    assert.ok(enhancer.includes(`/result-pdf/${pdf}`));
  }
  assert.ok(enhancer.includes('approved-artwork-result'));
  assert.ok(enhancer.includes('class="approved-artwork"'));
  for (const forbidden of ['result-brand-header', 'result-hero-image', 'result-heading', 'result-sections']) {
    assert.ok(!enhancer.includes(forbidden));
  }
});

test('PDF download keeps using the server download endpoint', () => {
  assert.ok(enhancer.includes('/api/download-result-pdf?pattern='));
  assert.ok(enhancer.includes('artwork-pdf'));
});

test('approved artwork keeps the 2:3 poster ratio and A4 print lock', () => {
  assert.ok(css.includes('aspect-ratio:2/3'));
  assert.ok(css.includes('size:A4 portrait'));
  assert.ok(css.includes('width:210mm'));
  assert.ok(css.includes('height:297mm'));
});
