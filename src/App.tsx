import React, { useState, useEffect } from 'react';
import { OPCOES_RESPOSTA, PERGUNTAS } from './data';
import { Loader2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const StripeBuyButton = 'stripe-buy-button' as any;

export default function App() {
  const [currentStep, setCurrentStep] = useState<'inicio' | 'quiz' | 'paywall' | 'resultado' | 'loading'>('inicio');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [resultado, setResultado] = useState<any>(null);

  const [showPix, setShowPix] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const handleCheckout = async () => {
    if (!quizSessionId) {
       toast.error("Sessão inválida. Tente novamente.");
       return;
    }
    setIsCheckoutLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_session_id: quizSessionId })
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Erro ao iniciar o pagamento.');
      }
    } catch (e) {
      toast.error('Erro de conexão ao iniciar o pagamento.');
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const fetchResult = async (sessionId: string | null) => {
    try {
      await new Promise(r => setTimeout(r, 2000));
      let backendPaid = false;
      if (sessionId) {
        const res = await fetch(`/api/quiz/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.payment_status === 'paid') {
            setResultado(data);
            setCurrentStep('resultado');
            backendPaid = true;
            return;
          }
        }
      }
      if (!backendPaid && window.location.pathname.includes('/resultado')) {
         const localRes = localStorage.getItem('janaina_resultado');
         if (localRes) {
           setResultado(JSON.parse(localRes));
           setCurrentStep('resultado');
           return;
         }
      }
      setCurrentStep('paywall');
    } catch (e) {
      if (window.location.pathname.includes('/resultado')) {
         const localRes = localStorage.getItem('janaina_resultado');
         if (localRes) {
           setResultado(JSON.parse(localRes));
           setCurrentStep('resultado');
           return;
         }
      }
      toast.error('Não foi possível carregar seu resultado no momento.');
      setCurrentStep('paywall');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const isCanceled = params.get('canceled');
    if (window.location.pathname.includes('/resultado') || sessionId) {
      setCurrentStep('loading');
      fetchResult(sessionId);
    } else if (isCanceled) {
      setCurrentStep('paywall');
    }
  }, []);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (nome && email) {
      setCurrentStep('quiz');
    }
  };

  const handleAnswer = async (valor: number) => {
    const newRespostas = { ...respostas, [PERGUNTAS[currentQuestionIndex].id]: valor };
    setRespostas(newRespostas);
    
    if (currentQuestionIndex < PERGUNTAS.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setCurrentStep('loading');
      await finishQuiz(newRespostas);
    }
  };

  const finishQuiz = async (finalRespostas: Record<number, number>) => {
    let medo = 0;
    let inseguranca = 0;
    let procrastinacao = 0;

    for (let i = 1; i <= 4; i++) medo += finalRespostas[i] || 0;
    for (let i = 5; i <= 8; i++) inseguranca += finalRespostas[i] || 0;
    for (let i = 9; i <= 12; i++) procrastinacao += finalRespostas[i] || 0;

    let dominante = 'MEDO';
    let max = medo;
    if (inseguranca > max) { dominante = 'INSEGURANÇA'; max = inseguranca; }
    if (procrastinacao > max) { dominante = 'PROCRASTINAÇÃO'; max = procrastinacao; }

    const resultadoCalculado = {
      nome, 
      resultado_dominante: dominante,
      score_medo: medo,
      score_inseguranca: inseguranca,
      score_procrastinacao: procrastinacao
    };
    
    localStorage.setItem('janaina_resultado', JSON.stringify(resultadoCalculado));

    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome, email, respostas: finalRespostas,
          score_medo: medo, score_inseguranca: inseguranca, score_procrastinacao: procrastinacao,
          resultado_dominante: dominante
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setQuizSessionId(data.quiz_session_id);
      }
    } catch (e) {
      console.error(e);
      toast.error('Modo offline: O banco de dados não está conectado. Prosseguindo...');
    } finally {
      setCurrentStep('paywall');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-sky-50 to-emerald-50 flex flex-col items-center justify-center p-4 text-stone-800 font-sans">
      <Toaster position="top-center" />
      
      {currentStep === 'inicio' && (
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-stone-200 fade-in">
          <h1 className="text-2xl font-bold mb-2 text-center text-emerald-800">Mini Diagnóstico</h1>
          <p className="text-stone-500 mb-8 text-center">Descubra o que te trava</p>
          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-stone-700">Nome</label>
              <input required type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full border border-stone-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-700" placeholder="Seu nome" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-stone-700">E-mail</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-stone-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-700" placeholder="seu@email.com" />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-medium py-3 rounded-lg transition-colors mt-4 shadow-md shadow-emerald-900/10 active:scale-[0.98]">
              COMEÇAR
            </button>
          </form>
        </div>
      )}

      {currentStep === 'quiz' && (
        <div className="w-full max-w-xl bg-white p-8 rounded-2xl shadow-sm border border-stone-200 fade-in">
          <div className="mb-8">
            <span className="text-sm font-medium text-stone-400">Pergunta {currentQuestionIndex + 1} de {PERGUNTAS.length}</span>
            <div className="w-full bg-stone-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full transition-all duration-300" style={{ width: `${((currentQuestionIndex) / PERGUNTAS.length) * 100}%` }} />
            </div>
          </div>
          <h2 className="text-xl font-medium mb-8 leading-relaxed text-stone-800">
            {PERGUNTAS[currentQuestionIndex]?.texto}
          </h2>
          <div className="space-y-3">
            {OPCOES_RESPOSTA.map((opcao) => (
              <button
                key={opcao.label}
                onClick={() => handleAnswer(opcao.valor)}
                className="w-full text-left px-6 py-4 rounded-xl border border-stone-200 hover:border-emerald-500 hover:bg-emerald-50/50 hover:shadow-sm transition-all text-stone-700 font-medium"
              >
                {opcao.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {currentStep === 'loading' && (
        <div className="flex flex-col items-center fade-in">
          <Loader2 className="w-8 h-8 animate-spin text-stone-400 mb-4" />
          <p className="text-stone-500 font-medium">Processando...</p>
        </div>
      )}

      {currentStep === 'paywall' && (
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-stone-200 text-center fade-in">
          <h2 className="text-2xl font-bold mb-4 text-emerald-800">Seu resultado está pronto!</h2>
          <p className="text-stone-600 mb-8 leading-relaxed">
            Identificamos qual dos três padrões aparece com mais força nas suas respostas.
            <br /><br />
            Desbloqueie seu diagnóstico completo para descobrir o que pode estar por trás desse padrão, como ele aparece na sua vida e qual pode ser seu primeiro movimento.
          </p>
          
          <div className="bg-white p-6 rounded-xl border border-emerald-100 shadow-sm mb-6 text-left shadow-sm">
            <p className="font-bold text-lg text-stone-800 mb-2">Diagnóstico Completo — R$ 9,90</p>
            <p className="text-sm text-stone-500 mb-4">Pague via Cartão de Crédito ou Apple/Google Pay (Até parcelado)</p>
            
            <button 
              onClick={handleCheckout} 
              disabled={isCheckoutLoading}
              className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-medium py-3 rounded-lg transition-colors mt-4 flex justify-center items-center shadow-md shadow-emerald-900/10 active:scale-[0.98]"
            >
              {isCheckoutLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'PAGAR COM CARTÃO OU PIX (STRIPE)'}
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-stone-100">
            <button 
              onClick={() => setShowPix(!showPix)}
              className="text-teal-700 font-medium text-sm hover:underline"
            >
              Prefere pagar via PIX direto? Clique aqui.
            </button>
            
            {showPix && (
              <div className="mt-4 p-4 bg-teal-50 border border-teal-100 rounded-lg text-left text-sm text-stone-700 fade-in">
                <p className="font-bold mb-2 text-teal-900">Como pagar via PIX Manual:</p>
                <ol className="list-decimal pl-4 space-y-2 mb-4">
                  <li>Faça um PIX de <strong>R$ 9,90</strong> para a chave E-mail: <strong>contato.janainaaraujo@gmail.com</strong></li>
                  <li>Clique no botão abaixo para enviar o comprovante no WhatsApp</li>
                  <li>Nós liberaremos seu acesso ao resultado imediatamente!</li>
                </ol>
                <a 
                  href="https://wa.me/5521983928113?text=Ol%C3%A1!%20Fiz%20o%20pagamento%20do%20Mini%20Diagn%C3%B3stico%20via%20PIX.%20Segue%20o%20comprovante:" 
                  target="_blank" 
                  rel="noreferrer"
                  className="block w-full text-center bg-[#25D366] text-white font-medium py-3 rounded-lg hover:bg-[#20bd5a] transition-colors"
                >
                  ENVIAR COMPROVANTE
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {currentStep === 'resultado' && resultado && (
        <div className="w-full max-w-2xl bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-stone-200 fade-in">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 text-emerald-800 text-center border-b border-stone-100 pb-6">
            Seu Padrão Dominante: {resultado.resultado_dominante}
          </h2>
          
          <div className="prose prose-stone max-w-none space-y-4 text-stone-700 leading-relaxed text-lg">
            {resultado.resultado_dominante === 'MEDO' && (
              <>
                <p>Olá, {resultado.nome || 'JANAINA BRANDAO ARAUJO'}.</p>
                <p>Seu padrão predominante está relacionado ao MEDO.</p>
                <p>O medo não é uma fraqueza. Na verdade, ele é um dos sistemas de proteção mais eficientes que você tem.</p>
                <p>Ele aparece para tentar evitar que você se machuque, se decepcione ou reviva situações difíceis. Mas, muitas vezes, para tentar garantir sua segurança, ele acaba limitando o seu movimento.</p>
                <p>A voz do medo costuma se disfarçar de "prudência" ou "cautela". Ela se manifesta no perfeccionismo, na dificuldade de dizer não, na comparação com outras pessoas, no excesso de preparação ou naquela sensação de que ainda falta alguma coisa para você estar realmente pronta.</p>
                <p>Você pode até saber o que quer fazer — mas, antes de agir, surge a dúvida: "Será que eu consigo?" "Será que estou preparada?" "E se eu fizer errado?"</p>
                <h3 className="text-xl font-bold mt-8 mb-4 text-emerald-800">O QUE PODE ESTAR ACONTECENDO POR TRÁS DISSO</h3>
                <p>Em algum nível, você pode ter aprendido a confiar mais nas referências externas do que na própria percepção.</p>
                <p>Por isso, mesmo quando já possui conhecimento, experiência ou capacidade suficiente para dar um passo, ainda procura sinais de que está fazendo a escolha certa.</p>
                <p>O problema é que essa confirmação nem sempre chega. Quando você condiciona sua ação à sensação de estar completamente preparada, pode acabar adiando experiências que seriam justamente as responsáveis por construir a confiança que está buscando.</p>
                <p>A segurança que você espera sentir antes de agir muitas vezes é construída depois que você começa a agir.</p>
              </>
            )}
            
            {resultado.resultado_dominante === 'INSEGURANÇA' && (
              <>
                <p>Olá, {resultado.nome || 'JANAINA BRANDAO ARAUJO'}.</p>
                <p>Seu padrão predominante está relacionado à INSEGURANÇA.</p>
                <p>A insegurança faz você duvidar da sua própria capacidade, mesmo quando há evidências claras de que você consegue.</p>
                <p>Você pode até saber o que quer fazer — mas, antes de agir, surge a dúvida: "Será que eu consigo?" "Será que estou preparada?" "E se eu fizer errado?"</p>
                <h3 className="text-xl font-bold mt-8 mb-4 text-emerald-800">O QUE PODE ESTAR ACONTECENDO POR TRÁS DISSO</h3>
                <p>Em algum nível, você pode ter aprendido a confiar mais nas referências externas do que na própria percepção.</p>
                <p>Por isso, mesmo quando já possui conhecimento, experiência ou capacidade suficiente para dar um passo, ainda procura sinais de que está fazendo a escolha certa.</p>
                <p>O problema é que essa confirmação nem sempre chega. Quando você condiciona sua ação à sensação de estar completamente preparada, pode acabar adiando experiências que seriam justamente as responsáveis por construir a confiança que está buscando.</p>
                <p>A segurança que você espera sentir antes de agir muitas vezes é construída depois que você começa a agir.</p>
                <h3 className="text-xl font-bold mt-8 mb-4 text-emerald-800">COMO ESSE PADRÃO PODE APARECER NA SUA VIDA</h3>
                <p>Você pode perceber esse padrão quando pensa demais antes de tomar decisões, busca opiniões mesmo quando já sabe o que gostaria de fazer, compara seu processo com o de outras pessoas ou diminui suas próprias conquistas e capacidades.</p>
                <p>Você também pode se preparar excessivamente antes de se expor, abandonar uma ideia quando começa a duvidar da própria capacidade ou esperar sentir confiança para só então começar.</p>
                <p>Ter dúvidas não significa não estar preparada.<br/>A dúvida pode continuar presente enquanto você aprende a confiar mais em si mesma.</p>
                <h3 className="text-xl font-bold mt-8 mb-4 text-emerald-800">UMA PERGUNTA IMPORTANTE</h3>
                <p>Pense em algo que você gostaria de fazer, mas diante do qual ainda sente insegurança.<br/>"Se eu não precisasse provar que sou capaz, o que eu já me permitiria fazer?"<br/>Observe a primeira resposta que surgir antes que sua mente comece a procurar justificativas.</p>
                <h3 className="text-xl font-bold mt-8 mb-4 text-emerald-800">SEU PRIMEIRO MOVIMENTO</h3>
                <p>Escolha uma pequena decisão que você vem adiando por insegurança.<br/>Em vez de perguntar: "Tenho certeza de que consigo?", experimente perguntar:<br/>"O que eu faria agora se confiasse um pouco mais na minha própria capacidade?"<br/>Então escolha uma ação pequena e concreta para realizar nas próximas 24 horas.</p>
                <p>Você não precisa eliminar toda a insegurança para começar. Pode começar enquanto aprende a confiar em si.</p>
              </>
            )}

            {resultado.resultado_dominante === 'PROCRASTINAÇÃO' && (
              <>
                <p>Olá, {resultado.nome || 'JANAINA BRANDAO ARAUJO'}.</p>
                <p>Seu padrão predominante está relacionado à PROCRASTINAÇÃO.</p>
                <p>A procrastinação nem sempre significa preguiça, falta de disciplina ou desorganização. Muitas vezes, você sabe exatamente o que precisa fazer — e até deseja fazer — mas existe uma distância entre saber e começar.</p>
                <p>Você pode ocupar o tempo com outras tarefas, esperar o momento ideal, organizar mais um pouco, pesquisar mais, pensar mais ou dizer a si mesma que fará quando estiver com mais disposição.</p>
                <p>E aquilo que realmente importa continua sendo adiado.</p>
                <h3 className="text-xl font-bold mt-8 mb-4 text-emerald-800">O QUE PODE ESTAR ACONTECENDO POR TRÁS DISSO</h3>
                <p>Em muitos casos, a procrastinação funciona como uma forma de evitar algum desconforto associado à ação.</p>
                <p>Pode ser o receio de errar, de não fazer tão bem quanto gostaria, de se expor, de lidar com uma tarefa difícil ou até com as consequências de finalmente conseguir aquilo que deseja.</p>
                <p>Por isso, procrastinar pode trazer um alívio imediato: enquanto você não começa, também não precisa enfrentar o desconforto.</p>
                <p>O problema é que esse alívio costuma durar pouco. Depois podem surgir cobrança, culpa, ansiedade e aquela sensação incômoda de estar sempre devendo alguma coisa a si mesma.</p>
                <p>adiamento → alívio momentâneo → cobrança → culpa → mais dificuldade para começar.</p>
                <h3 className="text-xl font-bold mt-8 mb-4 text-emerald-800">COMO ESSE PADRÃO PODE APARECER NA SUA VIDA</h3>
                <p>Você pode perceber esse padrão quando deixa tarefas importantes para depois, mesmo tendo tempo para realizá-las; começa várias coisas e encontra dificuldade para concluir; ou ocupa-se com tarefas menores para evitar justamente aquela que realmente precisa da sua atenção.</p>
                <p>Você também pode esperar estar motivada ou inspirada para começar, pesquisar e planejar excessivamente sem entrar em ação ou precisar que o prazo e a urgência aumentem para finalmente conseguir fazer.</p>
                <p>Você não precisa sentir vontade para começar.<br/>Muitas vezes, é justamente o movimento que produz a disposição que você estava esperando sentir antes.</p>
                <h3 className="text-xl font-bold mt-8 mb-4 text-emerald-800">UMA PERGUNTA IMPORTANTE</h3>
                <p>Pense em algo importante que você vem adiando.<br/>"O que eu evito sentir, enfrentar ou descobrir quando adio essa ação?"<br/>Não procure uma resposta perfeita. Observe o que aparece primeiro.<br/>Às vezes, compreender o que está sendo evitado é mais transformador do que continuar tentando se obrigar a fazer.</p>
                <h3 className="text-xl font-bold mt-8 mb-4 text-emerald-800">SEU PRIMEIRO MOVIMENTO</h3>
                <p>Escolha uma única coisa que você vem adiando.<br/>Agora reduza essa tarefa até encontrar uma ação que possa ser feita em 10 minutos ou menos.<br/>Não é terminar tudo. Não é resolver o problema inteiro. É apenas romper a inércia.<br/>Pergunte a si mesma:<br/>"Qual é a menor ação concreta que posso fazer agora para sair da intenção e entrar em movimento?"<br/>Faça essa pequena ação antes de planejar o restante.</p>
                <p>Porque, neste momento, você não precisa provar que consegue chegar até o final. Precisa apenas começar.</p>
              </>
            )}
          </div>
          
          <div className="mt-12 p-6 md:p-8 bg-stone-100 rounded-2xl border border-stone-200 text-center">
            <h3 className="text-xl font-bold mb-2 text-stone-800">E SE VOCÊ QUISER IR ALÉM DESTE PRIMEIRO PASSO?</h3>
            <p className="text-stone-700 mb-6">
              Este resultado mostra o padrão que mais se destacou nas suas respostas, mas ele não conta toda a sua história. Por trás da {resultado.resultado_dominante.toLowerCase()} podem existir experiências, crenças e formas de proteção que foram sendo construídas ao longo da sua vida — e compreender essa origem pode ser o próximo passo para transformar esse padrão.
            </p>
            <p className="text-stone-700 mb-8 font-medium">
              Se você percebeu que esse padrão se repete em diferentes áreas da sua vida e sente que está na hora de compreender o que existe por trás dele, eu posso te acompanhar nesse processo.
            </p>
            <a href={`https://wa.me/5521983928113?text=Quero%20aprofundar%20meu%20diagnóstico%20de%20${resultado.resultado_dominante}`} target="_blank" rel="noreferrer" className="block text-center w-full bg-teal-700 text-white font-medium py-4 rounded-xl hover:bg-teal-800 transition-colors shadow-lg shadow-stone-200">
              QUERO APROFUNDAR MEU DIAGNÓSTICO
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
