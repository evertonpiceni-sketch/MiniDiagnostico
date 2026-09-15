import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const enhancer = fs.readFileSync(new URL('../src/result-enhancer.ts', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/result-final.css', import.meta.url), 'utf8');

test('approved result renders the canonical PDF artwork as one piece', () => {
  for (const pdf of ['medo.pdf', 'inseguranca.pdf', 'procrastinacao.pdf']) {
    assert.match(enhancer, new RegExp(`/result-pdf/${pdf.replace('.', '\\.')}`));
  }
  assert.match(enhancer, /approved-artwork-result/);
  assert.match(enhancer, /class=\"approved-artwork\"/);
  assert.doesNotMatch(enhancer, /result-brand-header|result-hero-image|result-heading|result-sections/);
});

test('PDF download keeps using the server download endpoint', () => {
  assert.match(enhancer, /\/api\/download-result-pdf\?pattern=/);
  assert.match(enhancer, /artwork-pdf/);
});

test('approved artwork keeps the 2:3 poster ratio and A4 print lock', () => {
  assert.match(css, /aspect-ratio:2\/3/);
  assert.match(css, /size:A4 portrait/);
  assert.match(css, /width:210mm/);
  assert.match(css, /height:297mm/);
});
