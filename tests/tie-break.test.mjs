import assert from 'node:assert/strict';
import test from 'node:test';

const { calculateScores } = await import('../api/quiz.ts');

const answers = (medo, inseguranca, procrastinacao) => Object.fromEntries([
  ...Array.from({ length: 4 }, (_, i) => [String(i + 1), medo[i]]),
  ...Array.from({ length: 4 }, (_, i) => [String(i + 5), inseguranca[i]]),
  ...Array.from({ length: 4 }, (_, i) => [String(i + 9), procrastinacao[i]]),
]);

test('resultado único não exige desempate', () => {
  assert.equal(calculateScores(answers([3,3,3,3], [1,1,1,1], [0,0,0,0])).resultado_dominante, 'MEDO');
});

for (const scenario of [
  { name: 'medo x insegurança', values: [[3,3,0,0], [3,3,0,0], [1,1,0,0]], choices: ['MEDO', 'INSEGURANÇA'] },
  { name: 'insegurança x procrastinação', values: [[1,1,0,0], [3,3,0,0], [3,3,0,0]], choices: ['INSEGURANÇA', 'PROCRASTINAÇÃO'] },
  { name: 'medo x procrastinação', values: [[3,3,0,0], [1,1,0,0], [3,3,0,0]], choices: ['MEDO', 'PROCRASTINAÇÃO'] },
  { name: 'empate triplo', values: [[3,3,0,0], [3,3,0,0], [3,3,0,0]], choices: ['MEDO', 'INSEGURANÇA', 'PROCRASTINAÇÃO'] },
]) {
  test(`${scenario.name} exige escolha e aceita apenas categoria empatada`, () => {
    const input = answers(...scenario.values);
    assert.throws(() => calculateScores(input), /pergunta complementar/);
    for (const choice of scenario.choices) assert.equal(calculateScores(input, choice).resultado_dominante, choice);
    const invalid = ['MEDO', 'INSEGURANÇA', 'PROCRASTINAÇÃO'].find(value => !scenario.choices.includes(value));
    if (invalid) assert.throws(() => calculateScores(input, invalid), /pergunta complementar/);
  });
}
