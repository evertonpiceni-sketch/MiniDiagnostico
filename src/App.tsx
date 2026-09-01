/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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

  const fetchResult = async (sessionId: string | null) => {
    try {
      // Small delay to allow webhook to process
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
      
      // Fallback para Stripe Buy Button: 
      // Como o Buy Button gerencia o checkout sozinho, o success_url configurado pela Janaína no painel do Stripe
      // pode apenas redirecionar para /resultado. Se chegarmos aqui na página de resultado, confiamos no localStorage.
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
      // Fallback
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
    // Check if returning from Stripe
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
      // Finish quiz
      setCurrentStep('loading');
      await finishQuiz(newRespostas);
    }
  };

  const finishQuiz = async (finalRespostas: Record<number, number>) => {
    // Calculate scores (frontend calc just for submission, backend can recalculate to be safe)
    let score_medo = 0;
    let score_inseguranca = 0;
    let score_procrastinacao = 0;

    PERGUNTAS.forEach(p => {
      const val = finalRespostas[p.id] || 0;
      if (p.categoria === 'MEDO') score_medo += val;
      if (p.categoria === 'INSEGURANÇA') score_inseguranca += val;
      if (p.categoria === 'PROCRASTINAÇÃO') score_procrastinacao += val;
    });

    let dominante = 'MEDO';
    let max = score_medo;
    if (score_inseguranca > max) { dominante = 'INSEGURANÇA'; max = score_inseguranca; }
    if (score_procrastinacao > max) { dominante = 'PROCRASTINAÇÃO'; max = score_procrastinacao; }
    // TODO: Tiebreaker logic from Janaína

    const resultadoCalculado = {
      nome, 
      resultado_dominante: dominante,
      score_medo,
      score_inseguranca,
      score_procrastinacao
    };
    
    // Salvar no localStorage para recuperar caso o Stripe Buy Button redirecione de volta
    localStorage.setItem('janaina_resultado', JSON.stringify(resultadoCalculado));

    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome, email, respostas: finalRespostas,
          score_medo, score_inseguranca, score_procrastinacao,
          resultado_dominante: dominante
        })
      });
      if (!res.ok) throw new Error('Falha de comunicação com o servidor');
      const data = await res.json();
      setQuizSessionId(data.quiz_session_id);
      
      setCurrentStep('paywall');
    } catch (e) {
      console.error(e);
      toast.error('Servidor indisponível. Verifique sua conexão ou tente novamente mais tarde.');
      setCurrentStep('inicio');
    }
  };



  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4 text-stone-800 font-sans">
      <Toaster position="top-center" />
      <AnimatePresence mode="wait">
        {currentStep === 'inicio' && (
          <motion.div key="inicio" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-stone-200">
            <h1 className="text-2xl font-bold mb-2 text-center">Mini Diagnóstico</h1>
            <p className="text-stone-500 mb-8 text-center">Descubra o que te trava</p>
            <form onSubmit={handleStart} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input required type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full border border-stone-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900" placeholder="Seu nome" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">E-mail</label>
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-stone-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-900" placeholder="seu@email.com" />
              </div>
              <button type="submit" className="w-full bg-teal-700 text-white font-medium py-3 rounded-lg hover:bg-teal-800 transition-colors mt-4">
                COMEÇAR
              </button>
            </form>
          </motion.div>
        )}

        {currentStep === 'quiz' && (
          <motion.div key="quiz" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-xl bg-white p-8 rounded-2xl shadow-sm border border-stone-200">
            <div className="mb-8">
              <span className="text-sm font-medium text-stone-400">Pergunta {currentQuestionIndex + 1} de {PERGUNTAS.length}</span>
              <div className="w-full bg-stone-100 h-1.5 rounded-full mt-2 overflow-hidden">
                <div className="bg-teal-700 h-full transition-all duration-300" style={{ width: `${((currentQuestionIndex) / PERGUNTAS.length) * 100}%` }} />
              </div>
            </div>
            <h2 className="text-xl font-medium mb-8 leading-relaxed">
              {PERGUNTAS[currentQuestionIndex].texto}
            </h2>
            <div className="space-y-3">
              {OPCOES_RESPOSTA.map((opcao) => (
                <button
                  key={opcao.label}
                  onClick={() => handleAnswer(opcao.valor)}
                  className="w-full text-left px-6 py-4 rounded-xl border border-stone-200 hover:border-teal-700 hover:bg-stone-50 transition-colors"
                >
                  {opcao.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {currentStep === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-stone-400 mb-4" />
            <p className="text-stone-500">Processando...</p>
          </motion.div>
        )}

        {currentStep === 'paywall' && (
          <motion.div key="paywall" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-stone-200 text-center">
            <h2 className="text-2xl font-bold mb-4">Seu resultado está pronto!</h2>
            <p className="text-stone-600 mb-8 leading-relaxed">
              Identificamos qual dos três padrões aparece com mais força nas suas respostas.
              <br /><br />
              Desbloqueie seu diagnóstico completo para descobrir o que pode estar por trás desse padrão, como ele aparece na sua vida e qual pode ser seu primeiro movimento.
            </p>
            
            <div className="bg-stone-50 p-6 rounded-xl border border-stone-200 mb-6 text-left">
              <p className="font-bold text-lg text-stone-800 mb-2">Diagnóstico Completo — R$ 9,90</p>
              <p className="text-sm text-stone-600 mb-4">Pague via PIX ou Cartão de Crédito/Débito (Até parcelado)</p>
              
              <StripeBuyButton
                buy-button-id="buy_btn_1UAhRXDi05Nlzxp3LUM7iKKs"
                publishable-key="pk_live_51U8Y2oDi05Nlzxp3UkGitm1KdK7v7pIZAsZKY61BkVjmArAtt7DDDjQsL3ogLG45jfA3BDah4CUniaQjPzq5At4X00uTTvUtF1"
                client-reference-id={quizSessionId || undefined}
              >
              </StripeBuyButton>
            </div>

            <div className="text-sm text-stone-600 bg-white border border-stone-200 p-6 rounded-xl text-left">
              <p className="font-semibold mb-1">Prefere PIX direto (Manual)?</p>
              <p>Envie <strong>R$ 9,90</strong> para a Chave PIX E-mail:</p>
              <p className="font-mono bg-stone-100 block px-3 py-2 rounded border border-stone-200 mt-2 mb-2 text-center text-sm font-bold">contato.janainaaraujo@gmail.com</p>
              <p className="text-xs mb-4 text-center">(JANAINA BRANDÃO ARAUJO TREINAMENTOS)</p>
              
              <a href={`https://wa.me/5521983928113?text=Oi!%20Fiz%20o%20PIX%20manual%20do%20Diagnóstico%20Completo.%20Aqui%20está%20o%20comprovante.`} target="_blank" rel="noreferrer" className="block text-center text-stone-800 underline font-medium hover:text-stone-600 transition-colors">
                Enviar o comprovante no WhatsApp
              </a>
            </div>
          </motion.div>
        )}

        {currentStep === 'resultado' && resultado && (
          <motion.div 
            key="resultado" 
            initial={{ opacity: 0, scale: 0.9, y: 30 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} 
            className="w-full max-w-2xl bg-white p-6 sm:p-8 md:p-12 rounded-2xl shadow-sm border border-stone-200"
          >
            
            <div className="prose prose-stone prose-p:text-base prose-h3:text-lg md:prose-h3:text-xl mt-4 max-w-none">
                {resultado.resultado_dominante === 'MEDO' && (
                  <>
                    <p>Olá, {resultado.nome || 'JANAINA BRANDAO ARAUJO'}.</p>
                    <p>Seu padrão predominante está relacionado ao medo.</p>
                    <p>O medo nem sempre aparece como uma sensação evidente de estar com medo. Muitas vezes, ele se manifesta de formas mais sutis: excesso de análise, necessidade de prever o que pode dar errado, dificuldade para tomar decisões, busca por garantias ou tendência a permanecer no conhecido mesmo quando uma parte de você já sabe que precisa avançar.</p>
                    
                    <h3 className="text-xl font-bold mt-8 mb-4">O QUE PODE ESTAR ACONTECENDO POR TRÁS DISSO</h3>
                    <p>Seu sistema pode ter aprendido que avançar significa se expor ao risco. Por isso, antes de agir, você tenta encontrar segurança, controle ou certeza. O problema é que algumas decisões da vida não oferecem essa garantia — e a tentativa de eliminar todo risco pode acabar se transformando justamente naquilo que mantém você parada.</p>
                    
                    <h3 className="text-xl font-bold mt-8 mb-4">COMO ESSE PADRÃO PODE APARECER NA SUA VIDA</h3>
                    <p>Você pode perceber que sabe o que gostaria de fazer, mas encontra motivos para esperar um pouco mais. Pode imaginar cenários negativos antes mesmo de começar, desistir de oportunidades, voltar atrás em decisões ou escolher situações conhecidas porque parecem mais seguras.</p>
                    <p>Isso não significa necessariamente falta de capacidade. Pode indicar que a necessidade de segurança está falando mais alto do que a sua disposição para experimentar o novo.</p>

                    <h3 className="text-xl font-bold mt-8 mb-4">UMA PERGUNTA IMPORTANTE</h3>
                    <p>O que você faria hoje se não precisasse ter certeza de que vai dar certo?<br/>Observe a primeira resposta que surgir, antes que sua mente comece a explicar por que ainda não é possível.</p>

                    <h3 className="text-xl font-bold mt-8 mb-4">SEU PRIMEIRO MOVIMENTO</h3>
                    <p>Escolha uma situação que você vem evitando e pergunte a si mesma:<br/>"Qual é o menor passo que posso dar agora sem precisar ter certeza de tudo?"<br/>Não tente resolver a situação inteira. Escolha uma ação pequena, concreta e possível nas próximas 24 horas.</p>
                  </>
                )}
                {resultado.resultado_dominante === 'INSEGURANÇA' && (
                  <>
                    <p>Olá, {resultado.nome || 'JANAINA BRANDAO ARAUJO'}.</p>
                    <p>Seu padrão predominante está relacionado à insegurança.</p>
                    <p>A insegurança nem sempre aparece como falta de confiança evidente. Muitas vezes, ela se manifesta na necessidade de confirmação, na comparação com outras pessoas, no excesso de preparação ou naquela sensação de que ainda falta alguma coisa para você estar realmente pronta.</p>
                    <p>Você pode até saber o que quer fazer — mas, antes de agir, surge a dúvida: "Será que eu consigo?" "Será que estou preparada?" "E se eu fizer errado?"</p>
                    
                    <h3 className="text-xl font-bold mt-8 mb-4">O QUE PODE ESTAR ACONTECENDO POR TRÁS DISSO</h3>
                    <p>Em algum nível, você pode ter aprendido a confiar mais nas referências externas do que na própria percepção.</p>
                    <p>Por isso, mesmo quando já possui conhecimento, experiência ou capacidade suficiente para dar um passo, ainda procura sinais de que está fazendo a escolha certa.</p>
                    <p>O problema é que essa confirmação nem sempre chega. Quando você condiciona sua ação à sensação de estar completamente preparada, pode acabar adiando experiências que seriam justamente as responsáveis por construir a confiança que está buscando.</p>
                    <p>A segurança que você espera sentir antes de agir muitas vezes é construída depois que você começa a agir.</p>

                    <h3 className="text-xl font-bold mt-8 mb-4">COMO ESSE PADRÃO PODE APARECER NA SUA VIDA</h3>
                    <p>Você pode perceber esse padrão quando pensa demais antes de tomar decisões, busca opiniões mesmo quando já sabe o que gostaria de fazer, compara seu processo com o de outras pessoas ou diminui suas próprias conquistas e capacidades.</p>
                    <p>Você também pode se preparar excessivamente antes de se expor, abandonar uma ideia quando começa a duvidar da própria capacidade ou esperar sentir confiança para só então começar.</p>
                    <p>Ter dúvidas não significa não estar preparada.<br/>A dúvida pode continuar presente enquanto você aprende a confiar mais em si mesma.</p>

                    <h3 className="text-xl font-bold mt-8 mb-4">UMA PERGUNTA IMPORTANTE</h3>
                    <p>Pense em algo que você gostaria de fazer, mas diante do qual ainda sente insegurança.<br/>"Se eu não precisasse provar que sou capaz, o que eu já me permitiria fazer?"<br/>Observe a primeira resposta que surgir antes que sua mente comece a procurar justificativas.</p>

                    <h3 className="text-xl font-bold mt-8 mb-4">SEU PRIMEIRO MOVIMENTO</h3>
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

                    <h3 className="text-xl font-bold mt-8 mb-4">O QUE PODE ESTAR ACONTECENDO POR TRÁS DISSO</h3>
                    <p>Em muitos casos, a procrastinação funciona como uma forma de evitar algum desconforto associado à ação.</p>
                    <p>Pode ser o receio de errar, de não fazer tão bem quanto gostaria, de se expor, de lidar com uma tarefa difícil ou até com as consequências de finalmente conseguir aquilo que deseja.</p>
                    <p>Por isso, procrastinar pode trazer um alívio imediato: enquanto você não começa, também não precisa enfrentar o desconforto.</p>
                    <p>O problema é que esse alívio costuma durar pouco. Depois podem surgir cobrança, culpa, ansiedade e aquela sensação incômoda de estar sempre devendo alguma coisa a si mesma.</p>
                    <p>adiamento → alívio momentâneo → cobrança → culpa → mais dificuldade para começar.</p>

                    <h3 className="text-xl font-bold mt-8 mb-4">COMO ESSE PADRÃO PODE APARECER NA SUA VIDA</h3>
                    <p>Você pode perceber esse padrão quando deixa tarefas importantes para depois, mesmo tendo tempo para realizá-las; começa várias coisas e encontra dificuldade para concluir; ou ocupa-se com tarefas menores para evitar justamente aquela que realmente precisa da sua atenção.</p>
                    <p>Você também pode esperar estar motivada ou inspirada para começar, pesquisar e planejar excessivamente sem entrar em ação ou precisar que o prazo e a urgência aumentem para finalmente conseguir fazer.</p>
                    <p>Você não precisa sentir vontade para começar.<br/>Muitas vezes, é justamente o movimento que produz a disposição que você estava esperando sentir antes.</p>

                    <h3 className="text-xl font-bold mt-8 mb-4">UMA PERGUNTA IMPORTANTE</h3>
                    <p>Pense em algo importante que você vem adiando.<br/>"O que eu evito sentir, enfrentar ou descobrir quando adio essa ação?"<br/>Não procure uma resposta perfeita. Observe o que aparece primeiro.<br/>Às vezes, compreender o que está sendo evitado é mais transformador do que continuar tentando se obrigar a fazer.</p>

                    <h3 className="text-xl font-bold mt-8 mb-4">SEU PRIMEIRO MOVIMENTO</h3>
                    <p>Escolha uma única coisa que você vem adiando.<br/>Agora reduza essa tarefa até encontrar uma ação que possa ser feita em 10 minutos ou menos.<br/>Não é terminar tudo. Não é resolver o problema inteiro. É apenas romper a inércia.<br/>Pergunte a si mesma:<br/>"Qual é a menor ação concreta que posso fazer agora para sair da intenção e entrar em movimento?"<br/>Faça essa pequena ação antes de planejar o restante.</p>
                    <p>Porque, neste momento, você não precisa provar que consegue chegar até o final. Precisa apenas começar.</p>
                  </>
                )}
                
            </div>

            <div className="mt-12 p-6 md:p-8 bg-stone-100 rounded-2xl border border-stone-200 text-center">
              <h3 className="text-xl font-bold mb-2">E SE VOCÊ QUISER IR ALÉM DESTE PRIMEIRO PASSO?</h3>
              <p className="text-stone-700 mb-6">
                Este resultado mostra o padrão que mais se destacou nas suas respostas, mas ele não conta toda a sua história. Por trás da {resultado.resultado_dominante.toLowerCase()} podem existir experiências, crenças e formas de proteção que foram sendo construídas ao longo da sua vida — e compreender essa origem pode ser o próximo passo para transformar esse padrão.
              </p>
              <p className="text-stone-700 mb-8">
                Se você percebeu que esse padrão se repete em diferentes áreas da sua vida e sente que está na hora de compreender o que existe por trás dele, eu posso te acompanhar nesse processo.
              </p>
              
              <a href={`https://wa.me/5521983928113?text=Quero%20aprofundar%20meu%20diagnóstico%20de%20${resultado.resultado_dominante}`} target="_blank" rel="noreferrer" className="block text-center w-full bg-teal-700 text-white font-medium py-4 rounded-xl hover:bg-teal-800 transition-colors shadow-lg shadow-stone-200">
                QUERO APROFUNDAR MEU DIAGNÓSTICO
              </a>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
