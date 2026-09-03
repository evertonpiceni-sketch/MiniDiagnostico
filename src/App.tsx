import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { OPCOES_RESPOSTA, PERGUNTAS } from './data';
import { Loader2, Check, Copy, Sparkles, Smartphone, CreditCard, ShieldCheck, MessageCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const StripeBuyButton = 'stripe-buy-button' as any;
const StripePricingTable = 'stripe-pricing-table' as any;

const PIX_CODE = '00020126530014br.gov.bcb.pix0131contato.janainaaraujo@gmail.com52040000530398654049.905802BR5914JANAINA ARAUJO6014RIO DE JANEIRO62070503***63049B5A';
const PIX_KEY = 'contato.janainaaraujo@gmail.com';

export default function App() {
  const [currentStep, setCurrentStep] = useState<'inicio' | 'quiz' | 'paywall' | 'resultado' | 'loading'>(() => { if (typeof window !== 'undefined') { const path = window.location.pathname; if (path === '/resultado') return 'resultado'; if (path === '/paywall') return 'paywall'; } return 'inicio'; });
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [quizSessionId, setQuizSessionId] = useState<string | null>(() => { return new URLSearchParams(window.location.search).get('session_id') || localStorage.getItem('quiz_session_id'); });
  const [resultado, setResultado] = useState<any>(null);
  useEffect(() => { if (quizSessionId) localStorage.setItem('quiz_session_id', quizSessionId); }, [quizSessionId]);

  const [activePaymentTab, setActivePaymentTab] = useState<'pix' | 'card'>('pix');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isVerifyingPix, setIsVerifyingPix] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const copyToClipboard = async (text: string, type: 'code' | 'key') => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 3000);
        toast.success('Código PIX Copia e Cola copiado! Cole no aplicativo do seu banco.');
      } else {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 3000);
        toast.success('Chave PIX copiada: contato.janainaaraujo@gmail.com');
      }
    } catch (e) {
      toast.error('Não foi possível copiar automaticamente. Selecione o código manualmente.');
    }
  };

  const handleConfirmPix = async () => {
    const currentId = quizSessionId || localStorage.getItem('quiz_session_id');
    if (!currentId) {
      toast.error('Sessão do quiz não encontrada. Por favor, refaça o diagnóstico.');
      return;
    }
    setIsVerifyingPix(true);
    try {
      const res = await fetch(`/api/quiz/${currentId}/verify-payment`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.payment_status === 'paid') {
          toast.success('Pagamento confirmado! Carregando seu diagnóstico completo...');
          setCurrentStep('loading');
          await fetchResult(currentId);
          return;
        }
      }
      toast('Ainda aguardando processamento bancário. Tente novamente em alguns segundos.');
    } catch (err) {
      toast.error('Erro de conexão ao verificar pagamento. Tente novamente.');
    } finally {
      setIsVerifyingPix(false);
    }
  };

  const handleCheckout = async () => {
    let currentSessionId = quizSessionId || new URLSearchParams(window.location.search).get('session_id') || localStorage.getItem('quiz_session_id');
    if (!currentSessionId) {
       toast.error("Sessão não encontrada. Por favor, volte e refaça o quiz.");
       setTimeout(() => { window.location.href = '/'; }, 2000);
       return;
    }
    if (currentSessionId !== quizSessionId) {
       setQuizSessionId(currentSessionId);
    }
    setIsCheckoutLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_session_id: currentSessionId })
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

  const whatsappResultUrl = () => {
    if (!resultado || resultado.payment_status !== 'paid') return '#';
    const message = [
      `*Mini Diagnóstico de ${resultado.nome || 'Cliente'}*`,
      '',
      `*Padrão dominante:* ${resultado.resultado_dominante}`,
      `Medo: ${resultado.score_medo}/12`,
      `Insegurança: ${resultado.score_inseguranca}/12`,
      `Procrastinação: ${resultado.score_procrastinacao}/12`,
      '',
      'Seu diagnóstico completo foi liberado após a confirmação do pagamento.',
      window.location.href
    ].join('\n');
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  const fetchResult = async (sessionId: string | null) => {
    try {
      if (sessionId) {
        try {
          await fetch(`/api/quiz/${sessionId}/verify-payment`, { method: 'POST' });
        } catch(e){}
      }
      await new Promise(r => setTimeout(r, 600));
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
      if (!backendPaid) {
        if (window.location.pathname.includes('/resultado')) {
           toast.error('Pagamento não identificado. Conclua o pagamento para ver seu resultado.');
           setTimeout(() => { window.location.href = '/'; }, 2000);
        }
        setCurrentStep('paywall');
      }
    } catch (e) {
      toast.error('Não foi possível verificar seu pagamento no momento.');
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

  // Polling automático de pagamento
  useEffect(() => {
    let interval: any;
    if (currentStep === 'paywall' && quizSessionId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/quiz/${quizSessionId}/verify-payment`, { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            if (data.payment_status === 'paid') {
              clearInterval(interval);
              toast.success('Pagamento identificado com sucesso! Desbloqueando seu diagnóstico...');
              setCurrentStep('loading');
              await fetchResult(quizSessionId);
            }
          }
        } catch (e) {}
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [currentStep, quizSessionId]);

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
        setCurrentStep('paywall');
      } else {
        const errorData = await res.json().catch(() => null);
        toast.error(errorData?.error || 'Erro ao salvar o quiz. Verifique as configurações do banco de dados.');
        setCurrentStep('quiz');
      }
    } catch (e) {
      console.error(e);
      toast.error('Erro de conexão com o servidor.');
      setCurrentStep('quiz');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-sky-50 to-emerald-50 flex flex-col items-center justify-center p-4 text-stone-800 font-sans">
      <Toaster position="top-center" />
      
      <AnimatePresence mode="wait">
      {currentStep === 'inicio' && (
        <motion.div
          key="inicio"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-stone-200">
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
        </motion.div>
      )}

      {currentStep === 'quiz' && (
        <motion.div
          key="pergunta"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-xl bg-white p-8 rounded-2xl shadow-sm border border-stone-200">
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
        </motion.div>
      )}

      {currentStep === 'loading' && (
        <motion.div
          key="processando"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-stone-400 mb-4" />
          <p className="text-stone-500 font-medium">Processando...</p>
        </motion.div>
      )}

      {currentStep === 'paywall' && (
        <motion.div
          key="paywall"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-lg bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-stone-200 text-center">
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200/60 rounded-full text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Resultado Calculado com Sucesso</span>
          </div>

          <h2 className="text-2xl font-bold mb-2 text-stone-900">Desbloqueie seu Diagnóstico Completo</h2>
          <p className="text-stone-600 mb-6 text-sm leading-relaxed">
            Identificamos qual dos três padrões tem maior peso nas suas respostas.
            Descubra a raiz inconsciente do seu bloqueio e qual deve ser o seu primeiro movimento terapêutico.
          </p>

          {/* Abas de Pagamento */}
          <div className="flex bg-stone-100 p-1 rounded-xl mb-6 border border-stone-200">
            <button
              id="tab-pix"
              type="button"
              onClick={() => setActivePaymentTab('pix')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                activePaymentTab === 'pix'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>Pagar via PIX (R$ 9,90)</span>
            </button>
            <button
              id="tab-card"
              type="button"
              onClick={() => setActivePaymentTab('card')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                activePaymentTab === 'card'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <CreditCard className="w-4 h-4 text-stone-500" />
              <span>Cartão de Crédito</span>
            </button>
          </div>

          {activePaymentTab === 'pix' && (
            <div className="space-y-4 text-left">
              {/* Box com QR Code e detalhes */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="bg-white p-2 rounded-lg border border-stone-200 shadow-xs flex-shrink-0">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(PIX_CODE)}`}
                    alt="QR Code PIX R$ 9,90"
                    width={130}
                    height={130}
                    className="rounded"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-bold tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">Aprovação Instantânea</span>
                    <span className="text-base font-bold text-stone-900">R$ 9,90</span>
                  </div>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Abra o app do seu banco, escolha <strong>Pix</strong> e aponte a câmera para o QR Code ao lado, ou use o botão abaixo para <strong>Copiar o Código Pix</strong>.
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Beneficiária: <strong>Janaína Araújo</strong>
                  </p>
                </div>
              </div>

              {/* Código Pix Copia e Cola com botão de clique único */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wide">
                  Código Pix Copia e Cola:
                </label>
                <div className="relative">
                  <input
                    readOnly
                    type="text"
                    value={PIX_CODE}
                    className="w-full text-xs font-mono bg-stone-50 border border-stone-300 rounded-xl py-2.5 pl-3 pr-24 text-stone-700 focus:outline-none select-all"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    id="btn-copiar-pix-inline"
                    type="button"
                    onClick={() => copyToClipboard(PIX_CODE, 'code')}
                    className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>

                {/* Botão de Destaque para Copiar */}
                <button
                  id="btn-copiar-pix-destaque"
                  type="button"
                  onClick={() => copyToClipboard(PIX_CODE, 'code')}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.99] cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-5 h-5 text-emerald-200" />
                      <span>CÓDIGO PIX COPIADO! COLE NO APP DO BANCO</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      <span>CLIQUE AQUI PARA COPIAR O CÓDIGO PIX</span>
                    </>
                  )}
                </button>
              </div>

              {/* Chave E-mail alternativa */}
              <div className="flex items-center justify-between text-xs text-stone-600 px-1 pt-1">
                <span>Chave E-mail: <strong>contato.janainaaraujo@gmail.com</strong></span>
                <button
                  id="btn-copiar-chave-email"
                  type="button"
                  onClick={() => copyToClipboard(PIX_KEY, 'key')}
                  className="text-emerald-700 hover:text-emerald-900 font-semibold underline inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey ? 'Chave copiada' : 'Copiar chave'}</span>
                </button>
              </div>

              {/* Status de Polling + Botão de Confirmação Imediata */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-900">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
                  </span>
                  <span>Aguardando identificação do seu pagamento...</span>
                </div>
                
                <button
                  id="btn-confirmar-pix"
                  type="button"
                  disabled={isVerifyingPix}
                  onClick={handleConfirmPix}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                >
                  {isVerifyingPix ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-stone-300" />
                      <span>Verificando pagamento...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Já fiz o PIX! Liberar meu resultado agora</span>
                    </>
                  )}
                </button>
              </div>

              {/* Botão de WhatsApp */}
              <div className="text-center pt-1">
                <a
                  href={`https://wa.me/5521983928113?text=Ol%C3%A1!%20Fiz%20o%20pagamento%20de%20R$%209,90%20do%20Mini%20Diagn%C3%B3stico%20via%20PIX%20(Sess%C3%A3o:%20${encodeURIComponent(quizSessionId || '')}).%20Segue%20o%20comprovante:`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-emerald-700 font-medium transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>Dúvidas ou enviar comprovante no WhatsApp? Clique aqui</span>
                </a>
              </div>
            </div>
          )}

          {activePaymentTab === 'card' && (
            <div className="space-y-4 text-left">
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-stone-700 text-xs leading-relaxed space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-900 text-sm">Cartão de Crédito / Carteiras Digitais</span>
                  <span className="font-bold text-stone-900 text-base">R$ 9,90</span>
                </div>
                <p className="text-stone-600">
                  Pagamento protegido pela Stripe. Aceita cartões Visa, Mastercard, Elo, Hipercard, Apple Pay e Google Pay.
                </p>
              </div>

              {/* Botão Direto de Checkout Oficial da Stripe */}
              <button
                id="btn-pagar-cartao-stripe"
                type="button"
                disabled={isCheckoutLoading}
                onClick={handleCheckout}
                className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm hover:shadow transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer text-sm"
              >
                {isCheckoutLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Redirecionando para o Checkout Seguro...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    <span>PAGAR COM CARTÃO DE CRÉDITO (R$ 9,90)</span>
                  </>
                )}
              </button>

              <div className="pt-2">
                <p className="text-[11px] text-stone-500 text-center mb-2">
                  Ou selecione pela tabela de pagamento Stripe abaixo:
                </p>
                <div className="w-full max-w-md mx-auto min-h-[160px]">
                  <StripePricingTable
                    pricing-table-id="prctbl_1UBY83Di05Nlzxp3DgkBxMcV"
                    publishable-key="pk_live_51U8Y2oDi05Nlzxp3UkGitm1KdK7v7pIZAsZKY61BkVjmArAtt7DDDjQsL3ogLG45jfA3BDah4CUniaQjPzq5At4X00uTTvUtF1"
                    client-reference-id={quizSessionId}
                  ></StripePricingTable>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {currentStep === 'resultado' && resultado && (
        <motion.div
          key="resultado"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-2xl bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-stone-200">
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
          
          <div className="mt-8 p-5 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
            <MessageCircle className="w-8 h-8 text-[#25D366] mx-auto mb-2" />
            <h3 className="text-lg font-bold text-emerald-900 mb-1">Receba seu resultado no WhatsApp</h3>
            <p className="text-sm text-stone-600 mb-4">
              O WhatsApp abrirá com seu resultado preenchido. Escolha uma conversa — inclusive a conversa com você mesma — e toque em enviar.
            </p>
            <a
              href={whatsappResultUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold py-4 px-5 rounded-xl transition-colors shadow-md"
            >
              <MessageCircle className="w-5 h-5" />
              RECEBER RESULTADO PELO WHATSAPP
            </a>
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
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
