export type QuizState = {
    nome: string;
    whatsapp: string;
    respostas: Record<number, number>;
};

export type QuizResult = 'MEDO' | 'INSEGURANÇA' | 'PROCRASTINAÇÃO';

export const PERGUNTAS = [
    { id: 1, categoria: 'MEDO', texto: 'Quando penso em dar um passo importante, costumo imaginar primeiro tudo o que pode dar errado.' },
    { id: 2, categoria: 'MEDO', texto: 'Já deixei de aproveitar oportunidades por receio de fracassar, ser julgada ou me arrepender.' },
    { id: 3, categoria: 'MEDO', texto: 'Quando preciso me expor, mudar alguma coisa ou sair do conhecido, sinto vontade de recuar.' },
    { id: 4, categoria: 'MEDO', texto: 'Às vezes permaneço em situações que já não quero porque mudar parece arriscado demais.' },
    { id: 5, categoria: 'INSEGURANÇA', texto: 'Antes de tomar uma decisão importante, questiono se realmente sou capaz de lidar com as consequências dela.' },
    { id: 6, categoria: 'INSEGURANÇA', texto: 'Muitas vezes sinto que ainda preciso aprender, melhorar ou me preparar mais antes de começar.' },
    { id: 7, categoria: 'INSEGURANÇA', texto: 'Mesmo quando outras pessoas reconhecem minha capacidade, ainda tenho dificuldade de confiar plenamente em mim.' },
    { id: 8, categoria: 'INSEGURANÇA', texto: 'Costumo pensar muito sobre uma decisão e, quanto mais penso, mais difícil fica escolher.' },
    { id: 9, categoria: 'PROCRASTINAÇÃO', texto: 'Mesmo sabendo o que preciso fazer, acabo adiando e dizendo a mim mesma que farei depois.' },
    { id: 10, categoria: 'PROCRASTINAÇÃO', texto: 'Tenho projetos ou decisões importantes que comecei com entusiasmo, mas fui deixando pelo caminho.' },
    { id: 11, categoria: 'PROCRASTINAÇÃO', texto: 'Percebo que faço tarefas menos importantes enquanto continuo evitando justamente aquilo que sei que deveria priorizar.' },
    { id: 12, categoria: 'PROCRASTINAÇÃO', texto: 'Frequentemente só consigo fazer determinadas coisas quando o prazo, a necessidade ou a urgência já ficaram grandes.' },
];

export const OPCOES_RESPOSTA = [
    { label: 'Nunca', valor: 0 },
    { label: 'Às vezes', valor: 1 },
    { label: 'Quase sempre', valor: 2 },
    { label: 'Sempre', valor: 3 },
];

export type TieBreakQuestion = { texto: string; opcoes: { label: string; resultado: QuizResult }[] };

export const getTiedResults = (respostas: Record<number, number>): QuizResult[] => {
    const scores: Record<QuizResult, number> = { MEDO: 0, INSEGURANÇA: 0, PROCRASTINAÇÃO: 0 };
    for (const pergunta of PERGUNTAS) scores[pergunta.categoria as QuizResult] += respostas[pergunta.id] || 0;
    const max = Math.max(...Object.values(scores));
    return (Object.keys(scores) as QuizResult[]).filter(categoria => scores[categoria] === max);
};

export const getTieBreakQuestion = (tied: QuizResult[]): TieBreakQuestion | null => {
    const key = [...tied].sort().join('|');
    if (tied.length === 3) return { texto: 'Quando você percebe que não está avançando como gostaria, o que costuma acontecer primeiro?', opcoes: [
        { label: 'Penso no que pode dar errado e sinto vontade de recuar.', resultado: 'MEDO' },
        { label: 'Começo a duvidar se sou capaz ou se estou preparada.', resultado: 'INSEGURANÇA' },
        { label: 'Sei o que preciso fazer, mas acabo deixando para depois.', resultado: 'PROCRASTINAÇÃO' },
    ] };
    if (key === 'INSEGURANÇA|MEDO') return { texto: 'Quando você percebe que está diante de algo importante, o que costuma pesar mais?', opcoes: [
        { label: 'O receio do que pode acontecer se eu avançar.', resultado: 'MEDO' },
        { label: 'A dúvida se sou capaz de lidar com aquilo.', resultado: 'INSEGURANÇA' },
    ] };
    if (key === 'INSEGURANÇA|PROCRASTINAÇÃO') return { texto: 'O que costuma acontecer primeiro quando você precisa agir?', opcoes: [
        { label: 'Começo a duvidar se estou preparada ou se vou conseguir.', resultado: 'INSEGURANÇA' },
        { label: 'Sei que preciso fazer, mas vou deixando para depois.', resultado: 'PROCRASTINAÇÃO' },
    ] };
    if (key === 'MEDO|PROCRASTINAÇÃO') return { texto: 'Quando você não avança, o que mais se aproxima do que acontece com você?', opcoes: [
        { label: 'Penso nos riscos ou no que pode dar errado e recuo.', resultado: 'MEDO' },
        { label: 'Sei o que preciso fazer, mas continuo adiando.', resultado: 'PROCRASTINAÇÃO' },
    ] };
    return null;
};
