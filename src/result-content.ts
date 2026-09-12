export type ResultPattern = 'MEDO' | 'INSEGURANÇA' | 'PROCRASTINAÇÃO';

export type ResultContent = {
  intro: string;
  interpretation: string[];
  signs: string[];
  effects: string[];
  question: string;
  questionNote: string;
  path: string[];
  practices: string[];
  quote: string;
  cycle?: string;
};

export const RESULT_CONTENT: Record<ResultPattern, ResultContent> = {
  MEDO: {
    intro: 'O medo é uma forma de proteção. A diferença está em não deixar que ele defina todos os seus caminhos.',
    interpretation: [
      'O medo nem sempre aparece como uma sensação evidente de estar com medo. Muitas vezes, ele se manifesta como excesso de análise, necessidade de prever o que pode dar errado, dificuldade para tomar decisões, busca por garantias ou tendência a permanecer no conhecido.',
      'Seu sistema pode ter aprendido que avançar significa se expor ao risco. Por isso, antes de agir, você tenta encontrar segurança, controle ou certeza. O problema é que algumas decisões não oferecem essa garantia — e tentar eliminar todo risco pode acabar mantendo você parada.',
    ],
    signs: ['Imaginar primeiro o que pode dar errado', 'Recuar diante de mudanças ou exposição', 'Buscar garantias antes de agir', 'Permanecer no conhecido por parecer mais seguro', 'Deixar oportunidades passarem por receio das consequências'],
    effects: ['Excesso de preocupação', 'Dificuldade para tomar decisões', 'Perda de oportunidades', 'Sensação de estagnação', 'Frustração por saber que deseja avançar, mas continuar recuando'],
    question: '',
    questionNote: '',
    path: ['Escolha uma situação que você vem evitando e pergunte:', 'Qual é o menor passo que posso dar agora sem precisar ter certeza de tudo?', 'Não tente resolver a situação inteira. Escolha uma ação pequena, concreta e possível nas próximas 24 horas.'],
    practices: ['Observe quando sua mente começa a antecipar o pior', 'Identifique o que você está tentando controlar ou garantir', 'Diferencie risco real de antecipação mental', 'Escolha uma pequena ação mesmo sem certeza absoluta', 'Registre cada vez que avançar apesar do medo'],
    quote: 'Coragem não é a ausência do medo, mas a decisão de seguir em frente, mesmo sentindo.',
  },
  INSEGURANÇA: {
    intro: 'A insegurança pode fazer você duvidar do seu valor, mas não define quem você é. Reconhecer suas conquistas é o primeiro passo para se fortalecer.',
    interpretation: [
      'A insegurança nem sempre aparece como falta de confiança evidente. Muitas vezes, ela se manifesta na necessidade de confirmação, na comparação com outras pessoas, no excesso de preparação ou na sensação de que ainda falta alguma coisa para você estar realmente pronta.',
      'Você pode até saber o que quer fazer, mas antes de agir surge a dúvida: “Será que eu consigo? Será que estou preparada?” Em algum nível, você pode ter aprendido a confiar mais nas referências externas do que na própria percepção.',
    ],
    signs: ['Questionar a própria capacidade', 'Comparar-se frequentemente', 'Sentir que ainda precisa se preparar mais', 'Buscar confirmação externa', 'Pensar tanto sobre uma decisão que fica difícil escolher'],
    effects: ['Baixa autoestima', 'Decisões adiadas', 'Perda de oportunidades', 'Dependência da aprovação alheia', 'Diminuição das próprias conquistas', 'Frustração por não confiar no que já sabe ou é capaz de fazer'],
    question: '',
    questionNote: '',
    path: ['Escolha uma pequena decisão que você vem adiando por insegurança.', 'Em vez de perguntar “Tenho certeza de que consigo?”, experimente perguntar:', 'O que eu faria agora se confiasse um pouco mais na minha própria capacidade?', 'Então escolha uma ação pequena e concreta para realizar nas próximas 24 horas.', 'Você não precisa eliminar toda a insegurança para começar. Pode começar enquanto aprende a confiar em si.'],
    practices: ['Reconheça evidências concretas da sua capacidade', 'Observe quando estiver buscando confirmação externa', 'Questione a voz que diz que você ainda não está pronta', 'Tome uma pequena decisão sem pedir validação', 'Registre pequenas ações feitas apesar da dúvida'],
    quote: 'Você não precisa ser perfeito, precisa ser verdadeiro.',
  },
  PROCRASTINAÇÃO: {
    intro: 'Não é preguiça. É um sinal de que algo precisa ser compreendido. Você pode avançar, no seu tempo, do seu jeito, com mais leveza.',
    interpretation: [
      'A procrastinação nem sempre significa preguiça, falta de disciplina ou desorganização. Muitas vezes, você sabe exatamente o que precisa fazer, mas existe uma distância entre saber e começar.',
      'Em muitos casos, a procrastinação funciona como uma forma de evitar algum desconforto associado à ação. Enquanto você não começa, também não precisa enfrentar esse desconforto.',
      'Esse adiamento pode trazer um alívio momentâneo. Depois surgem cobrança, culpa e mais dificuldade para começar, reforçando o próprio ciclo da procrastinação.',
    ],
    cycle: 'adiamento → alívio momentâneo → cobrança → culpa → mais dificuldade para começar',
    signs: ['Adiar tarefas importantes', 'Esperar o “momento certo”', 'Começar e ter dificuldade para concluir', 'Fazer tarefas menores enquanto evita a prioridade', 'Precisar da urgência para finalmente agir'],
    effects: ['Acúmulo de responsabilidades', 'Ansiedade e estresse', 'Frustração consigo mesma', 'Perda de oportunidades', 'Sensação constante de estar atrasada'],
    question: 'O que eu evito sentir, enfrentar ou descobrir quando adio essa ação?',
    questionNote: 'Não procure uma resposta perfeita. Observe o que aparece primeiro.',
    path: ['Escolha uma única coisa que você vem adiando e reduza essa tarefa até encontrar uma ação que possa ser feita em 10 minutos ou menos.', 'Não é terminar tudo. É apenas romper a inércia.', 'Qual é a menor ação concreta que posso fazer agora para sair da intenção e entrar em movimento?'],
    practices: ['Divida tarefas grandes em passos pequenos', 'Use a regra dos 10 minutos para começar', 'Elimine distrações durante esse pequeno período', 'Observe o desconforto que aparece antes de agir', 'Celebre o movimento, não apenas a conclusão'],
    quote: 'Você não precisa sentir vontade para começar. Muitas vezes, é o movimento que produz a disposição.',
  },
};
