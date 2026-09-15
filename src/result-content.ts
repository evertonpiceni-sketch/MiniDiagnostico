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
      'Suas respostas sugerem que o medo pode estar ocupando um espaço importante na sua vida, como forma de evitar riscos e situações novas. Ele pode aparecer como preocupação excessiva, antecipação de problemas, dificuldade para tomar decisões ou necessidade de ter certeza antes de avançar.',
    ],
    signs: ['Pensamentos que começam com “e se...?”', 'Tendência a imaginar o pior cenário', 'Necessidade de controle', 'Evita oportunidades por receio das consequências'],
    effects: ['Ansiedade e tensão constante', 'Dificuldade em tomar decisões', 'Perda de oportunidades', 'Sensação de estagnação', 'Desgaste emocional'],
    question: 'O que você faria hoje se não precisasse ter certeza de que vai dar certo?',
    questionNote: 'Observe a primeira resposta que surgir antes que sua mente comece a explicar por que ainda não é possível.',
    path: ['Desenvolver segurança interna antes de exigir de si coragem absoluta. Em vez de esperar o medo desaparecer, experimente se perguntar:', '“Qual é o menor passo seguro que posso dar mesmo sentindo medo?”'],
    practices: ['Respiração consciente (3 minutos, 2x ao dia)', 'Identifique o que o medo está tentando proteger', 'Faça pequenas ações fora da sua zona de conforto', 'Registre seus avanços, por menores que sejam'],
    quote: 'Coragem não é a ausência do medo, mas a decisão de seguir em frente, mesmo sentindo.',
  },
  INSEGURANÇA: {
    intro: 'Ter dúvidas não significa não estar preparada. A confiança também pode ser construída enquanto você avança.',
    interpretation: [
      'A insegurança nem sempre aparece como falta de confiança evidente. Muitas vezes, ela se manifesta na necessidade de confirmação, na comparação com outras pessoas, no excesso de preparação ou na sensação de que ainda falta alguma coisa para você estar realmente pronta.',
      'Você pode até saber o que quer fazer, mas antes de agir surge a dúvida: “Será que eu consigo? Será que estou preparada?” Em algum nível, você pode ter aprendido a confiar mais nas referências externas do que na própria percepção.',
    ],
    signs: ['Questionar a própria capacidade', 'Comparar-se frequentemente', 'Sentir que ainda precisa se preparar mais', 'Buscar confirmação externa', 'Pensar tanto sobre uma decisão que fica difícil escolher'],
    effects: ['Decisões adiadas', 'Perda de oportunidades', 'Dependência da aprovação alheia', 'Diminuição das próprias conquistas', 'Frustração por não confiar no que já sabe ou é capaz de fazer'],
    question: 'Se eu não precisasse provar que sou capaz, o que eu já me permitiria fazer?',
    questionNote: 'Observe a primeira resposta que surgir antes que sua mente comece a procurar justificativas.',
    path: ['Escolha uma pequena decisão que você vem adiando por insegurança. Em vez de perguntar “Tenho certeza de que consigo?”, experimente perguntar:', 'O que eu faria agora se confiasse um pouco mais na minha própria capacidade?', 'Então escolha uma ação pequena e concreta para realizar nas próximas 24 horas.', 'Você não precisa eliminar toda a insegurança para começar. Pode começar enquanto aprende a confiar em si.'],
    practices: ['Reconheça evidências concretas da sua capacidade', 'Observe quando estiver buscando confirmação externa', 'Questione a voz que diz que você ainda não está pronta', 'Tome uma pequena decisão sem pedir validação', 'Registre pequenas ações feitas apesar da dúvida'],
    quote: 'A segurança que você espera sentir antes de agir muitas vezes é construída depois que você começa a agir.',
  },
  PROCRASTINAÇÃO: {
    intro: 'Não é preguiça. Muitas vezes, adiar é uma forma de evitar o desconforto que existe por trás da ação.',
    interpretation: [
      'A procrastinação nem sempre significa preguiça, falta de disciplina ou desorganização. Muitas vezes, você sabe exatamente o que precisa fazer, mas existe uma distância entre saber e começar.',
      'Em muitos casos, procrastinar funciona como uma forma de evitar algum desconforto associado à ação: receio de errar, de se expor, de lidar com algo difícil ou até com as consequências de conseguir aquilo que deseja.',
      'Enquanto você não começa, sente um alívio momentâneo. Depois podem surgir cobrança, culpa e ansiedade.',
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

// Legacy production guard marker only; not rendered: O medo nem sempre impede você de querer avançar. Muitas vezes, ele faz você buscar segurança antes de se permitir tentar.
