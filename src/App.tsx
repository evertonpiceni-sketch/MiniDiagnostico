import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Variants } from 'motion/react';
import { ArrowLeft, ArrowRight, AtSign, Check, Copy, CreditCard, Loader2, LockKeyhole, Menu, MessageCircle, MonitorSmartphone, ShieldCheck, Smartphone, Sparkles, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { OPCOES_RESPOSTA, PERGUNTAS } from './data';

const resultadoContainerVariants: Variants = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: .6, ease: 'easeOut', staggerChildren: .16 } } };
const resultadoItemVariants: Variants = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: .45, ease: 'easeOut' } } };
const Instagram = AtSign;

export default function App() {
  const [currentStep, setCurrentStep] = useState<'inicio'|'quiz'|'paywall'|'resultado'|'loading'>(() => window.location.pathname === '/resultado' ? 'resultado' : window.location.pathname === '/paywall' ? 'paywall' : 'inicio');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [quizSessionId, setQuizSessionId] = useState<string|null>(() => new URLSearchParams(window.location.search).get('session_id') || localStorage.getItem('quiz_session_id'));
  const [resultToken, setResultToken] = useState(() => new URLSearchParams(window.location.search).get('token') || sessionStorage.getItem('result_token') || '');
  const [resultado, setResultado] = useState<any>(null);
  const [activePaymentTab, setActivePaymentTab] = useState<'pix'|'card'>('pix');
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixCpf, setPixCpf] = useState('');
  const [pixData, setPixData] = useState<{payload:string;encodedImage:string}|null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (quizSessionId) localStorage.setItem('quiz_session_id', quizSessionId); }, [quizSessionId]);

  const fetchResult = async (sessionId: string|null, token = resultToken) => {
    if (!sessionId || !token) { setCurrentStep('paywall'); return; }
    try {
      sessionStorage.setItem('result_token', token);
      await fetch(`/api/quiz/${encodeURIComponent(sessionId)}/verify-payment`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token}) }).catch(() => null);
      const res = await fetch(`/api/quiz/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.payment_status === 'paid') { setResultado(data); setCurrentStep('resultado'); return; }
      setCurrentStep('paywall');
    } catch { toast.error('Não foi possível verificar o pagamento agora.'); setCurrentStep('paywall'); }
  };

  const recoverPaidResult = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/quiz/${encodeURIComponent(sessionId)}/recover-access`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.payment_status !== 'paid' || !data.token) return false;
      sessionStorage.setItem('result_token', data.token);
      setResultToken(data.token);
      history.replaceState({}, '', `/resultado?session_id=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(data.token)}`);
      await fetchResult(sessionId, data.token);
      return true;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const recoverableSessionId = sessionId || localStorage.getItem('quiz_session_id');
    const token = params.get('token') || sessionStorage.getItem('result_token') || '';
    if (token) setResultToken(token);
    if (window.location.pathname === '/resultado' && sessionId) {
      setCurrentStep('loading');
      if (token) void fetchResult(sessionId, token);
      else void recoverPaidResult(sessionId).then((recovered) => { if (!recovered) setCurrentStep('paywall'); });
    } else if (window.location.pathname === '/paywall' && sessionId && !token) {
      void recoverPaidResult(sessionId);
    } else if (window.location.pathname === '/' && recoverableSessionId && !token) {
      void recoverPaidResult(recoverableSessionId);
    }
  }, []);

  useEffect(() => {
    if (currentStep !== 'paywall' || !quizSessionId || !resultToken) return;
    const interval = window.setInterval(async () => {
      const res = await fetch(`/api/quiz/${encodeURIComponent(quizSessionId)}/verify-payment`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token:resultToken}) }).catch(() => null);
      if (!res?.ok) return;
      const data = await res.json().catch(() => ({}));
      if (data.payment_status === 'paid') { window.clearInterval(interval); setCurrentStep('loading'); void fetchResult(quizSessionId, resultToken); }
    }, 4000);
    return () => window.clearInterval(interval);
  }, [currentStep, quizSessionId, resultToken]);

  const handleStart = (e: React.FormEvent) => { e.preventDefault(); if (nome.trim() && whatsapp.replace(/\D/g,'').length >= 10) { setShowLeadForm(false); setCurrentStep('quiz'); } else toast.error('Informe nome e WhatsApp válido com DDD.'); };
  const selected = respostas[PERGUNTAS[currentQuestionIndex]?.id];

  const finishQuiz = async (answers:Record<number,number>) => {
    setCurrentStep('loading');
    try {
      const res = await fetch('/api/quiz', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({nome:nome.trim(), whatsapp, respostas:answers}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.quiz_session_id) throw new Error(data.error || 'Não foi possível salvar o diagnóstico.');
      localStorage.removeItem('janaina_resultado');
      setQuizSessionId(data.quiz_session_id);
      setCurrentStep('paywall');
      history.replaceState({}, '', `/paywall?session_id=${encodeURIComponent(data.quiz_session_id)}`);
    } catch(e) { toast.error(e instanceof Error ? e.message : 'Erro de conexão com o servidor.'); setCurrentStep('quiz'); }
  };

  const handleAnswer = (valor:number) => {
    const questionId = PERGUNTAS[currentQuestionIndex].id;
    const nextAnswers = {...respostas, [questionId]:valor};
    setRespostas(nextAnswers);
  };

  const handleNextQuestion = () => {
    if (selected === undefined) return toast.error('Selecione uma resposta para continuar.');
    if (currentQuestionIndex < PERGUNTAS.length - 1) setCurrentQuestionIndex(i => i + 1);
    else void finishQuiz(respostas);
  };

  const handleCheckout = async () => {
    if (!quizSessionId) return toast.error('Sessão não encontrada. Refaça o diagnóstico.');
    setIsCheckoutLoading(true);
    try {
      const res = await fetch('/api/checkout', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({quiz_session_id:quizSessionId}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url || !data.token) throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
      sessionStorage.setItem('result_token', data.token); setResultToken(data.token);
      window.location.assign(data.url);
    } catch(e) { toast.error(e instanceof Error ? e.message : 'Erro ao iniciar pagamento.'); setIsCheckoutLoading(false); }
  };

  const generatePix = async () => {
    if (!quizSessionId) return toast.error('Sessão não encontrada.');
    const cpfCnpj = pixCpf.replace(/\D/g,'');
    if (cpfCnpj.length !== 11) return toast.error('Informe um CPF válido com 11 números.');
    setPixLoading(true);
    try {
      const res = await fetch('/api/asaas-pix', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({quiz_session_id:quizSessionId, cpfCnpj}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data.error || 'Não foi possível gerar o Pix.');
      sessionStorage.setItem('result_token', data.token); setResultToken(data.token);
      if (data.paid) { setCurrentStep('loading'); return void fetchResult(quizSessionId, data.token); }
      if (!data.payload || !data.encodedImage) throw new Error('O Asaas não retornou QR Code válido.');
      setPixData({payload:data.payload, encodedImage:String(data.encodedImage).replace(/\s/g,'')});
    } catch(e) { toast.error(e instanceof Error ? e.message : 'Erro ao gerar Pix.'); } finally { setPixLoading(false); }
  };

  const copyPix = async () => { if (!pixData) return; try { await navigator.clipboard.writeText(pixData.payload); setCopied(true); setTimeout(()=>setCopied(false),1800); } catch { toast.error('Selecione e copie o código manualmente.'); } };

  return <div className="brand-shell min-h-screen flex flex-col items-center justify-center text-stone-800 font-sans"><Toaster position="top-center"/><AnimatePresence mode="wait">
    {currentStep === 'inicio' && <motion.main key="inicio" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="approved-landing">
      <img className="approved-landing__art" src="/landing-approved-reference.webp" alt="Mini Diagnóstico Janaína Araújo"/>
      <section className="approved-mobile">
        <img className="approved-mobile__logo" src="/ja-logo-approved.webp" alt="Janaína Araújo — Terapeuta Integrativa"/>
        <p className="approved-mobile__eyebrow">MINI DIAGNÓSTICO</p>
        <h1>Descubra o que está te impedindo de avançar</h1>
        <p>Você sabe que quer mudar alguma coisa. Talvez até saiba o que precisa fazer. Mas, na hora de avançar, algo acontece.</p>
        <p>Responda a 12 perguntas rápidas e descubra qual padrão pode estar agindo por trás dessa trava.</p>
        <div className="approved-mobile__benefits"><span><Sparkles/><b>Rápido</b><small>5 minutos</small></span><span><ShieldCheck/><b>Seguro</b><small>e confidencial</small></span><span><MonitorSmartphone/><b>100%</b><small>online</small></span></div>
        <img className="approved-mobile__hero" src="/hero-approved-repaired.webp" alt="Mulher em momento de serenidade e autoconhecimento"/>
      </section>
      <button type="button" className="approved-landing__main-cta" onClick={()=>setShowLeadForm(true)}>Iniciar meu diagnóstico <ArrowRight/></button>
      {showLeadForm && <div className="lead-modal" role="dialog" aria-modal="true" aria-labelledby="lead-modal-title"><form onSubmit={handleStart} className="lead-modal__card">
        <button type="button" className="lead-modal__close" aria-label="Fechar" onClick={()=>setShowLeadForm(false)}><X/></button>
        <img src="/ja-logo-approved.webp" alt="Janaína Araújo"/><p className="brand-eyebrow">MINI DIAGNÓSTICO</p><h2 id="lead-modal-title">Vamos começar?</h2><p>Informe seus dados para iniciar as 12 perguntas.</p>
        <label>Nome<input id="landing-v2-name" required autoComplete="name" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Seu nome"/></label>
        <label>WhatsApp<input required type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="(51) 99999-9999"/></label>
        <button className="primary-action">Iniciar meu diagnóstico <ArrowRight/></button><small><LockKeyhole/> Seus dados estão seguros e protegidos.</small>
      </form></div>}
    </motion.main>}
    {currentStep === 'quiz' && <motion.main key={`q-${currentQuestionIndex}`} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} className="journey-page"><section className="brand-page-card quiz-card"><div className="brand-card-header"><img src="/ja-logo-approved.webp" alt="Janaína Araújo"/><span>Pergunta {currentQuestionIndex+1} de {PERGUNTAS.length}</span><Menu/></div><div className="progress-track"><div className="progress-fill" style={{width:`${((currentQuestionIndex+1)/PERGUNTAS.length)*100}%`}}/></div><button type="button" onClick={()=>setCurrentQuestionIndex(i=>Math.max(0,i-1))} className="brand-back" disabled={currentQuestionIndex===0}><ArrowLeft/> Voltar</button><p className="brand-eyebrow">AUTOCONHECIMENTO</p><h2>{PERGUNTAS[currentQuestionIndex]?.texto}</h2><div className="answer-list">{OPCOES_RESPOSTA.map((op,index)=><button key={op.label} type="button" onClick={()=>handleAnswer(op.valor)} aria-pressed={selected===op.valor} className="answer-option"><span>{String.fromCharCode(65+index)}</span>{op.label}</button>)}</div><div className="journey-actions"><button type="button" onClick={()=>setCurrentQuestionIndex(i=>Math.max(0,i-1))} disabled={currentQuestionIndex===0} className="secondary-action"><ArrowLeft/> Voltar</button><button type="button" onClick={handleNextQuestion} className="primary-action">{currentQuestionIndex===PERGUNTAS.length-1?'Ir para pagamento':'Próxima'} <ArrowRight/></button></div><p className="brand-card-quote">Cada resposta te aproxima da sua verdade.</p></section></motion.main>}
    {currentStep === 'loading' && <motion.div key="loading" initial={{opacity:0}} animate={{opacity:1}} className="flex flex-col items-center"><Loader2 className="w-8 h-8 animate-spin mb-4"/><p>Processando com segurança...</p></motion.div>}
    {currentStep === 'paywall' && <motion.div key="paywall" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="brand-page-card payment-card w-full max-w-lg bg-white p-6 md:p-8 rounded-2xl shadow-sm border text-center"><div className="brand-card-header"><img src="/ja-logo-approved.webp" alt="Janaína Araújo"/><LockKeyhole/></div><div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full text-xs font-semibold mb-3"><Sparkles className="w-4 h-4"/>Resultado calculado com segurança</div><h2 className="text-2xl font-bold">Seu resultado</h2><div className="result-preview result-locked"><span>✦</span><small>Sua principal área de atenção foi identificada</small><strong>Resultado confidencial</strong><p>Conclua o pagamento para desbloquear o relatório completo.</p></div><h3 className="payment-title">Finalizar pagamento</h3><p className="text-stone-600 mb-5">Mini Diagnóstico Emocional • Relatório completo + orientações • <strong>R$ 9,90</strong></p><div className="flex bg-stone-100 p-1.5 rounded-xl mb-6 gap-1"><button id="tab-pix" type="button" onClick={()=>setActivePaymentTab('pix')} className={`flex-1 py-3 rounded-lg ${activePaymentTab==='pix'?'payment-tab-active bg-white':''}`}><Smartphone className="inline w-4 h-4 mr-2"/>Pix</button><button id="tab-card" type="button" onClick={()=>setActivePaymentTab('card')} className={`flex-1 py-3 rounded-lg ${activePaymentTab==='card'?'payment-tab-active bg-white':''}`}><CreditCard className="inline w-4 h-4 mr-2"/>Cartão de crédito</button></div>{activePaymentTab==='pix' && <div className="space-y-4 text-left">{!pixData ? <><div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">Pix seguro via Asaas. O QR Code e o Copia e Cola são gerados para esta sessão e a confirmação é automática.</div><label className="block text-sm font-medium">CPF do pagador<input value={pixCpf} onChange={e=>setPixCpf(e.target.value)} inputMode="numeric" maxLength={14} className="w-full border rounded-lg px-4 py-3 mt-1" placeholder="000.000.000-00"/></label><button id="btn-pagar-pix-asaas" type="button" disabled={pixLoading} onClick={generatePix} className="w-full py-4 bg-emerald-700 text-white font-bold rounded-xl">{pixLoading?<Loader2 className="inline w-5 h-5 animate-spin"/>:'GERAR PIX — R$ 9,90'}</button></> : <div className="space-y-4 text-center"><div className="font-bold">PIX • R$ 9,90</div><img src={`data:image/png;base64,${pixData.encodedImage}`} alt="QR Code Pix Asaas" className="w-56 h-56 mx-auto bg-white p-3 rounded-xl"/><textarea readOnly value={pixData.payload} className="w-full min-h-24 border rounded-xl p-3 text-xs"/><button type="button" onClick={copyPix} className="w-full py-4 bg-emerald-700 text-white font-bold rounded-xl">{copied?<><Check className="inline w-4 h-4"/> PIX COPIADO</>:<><Copy className="inline w-4 h-4"/> COPIAR CÓDIGO PIX</>}</button><p className="text-xs text-stone-500">Aguardando confirmação automática do Asaas...</p></div>}</div>}{activePaymentTab==='card' && <div className="space-y-4 text-left"><div className="bg-stone-50 border rounded-xl p-4 text-sm"><div className="flex justify-between font-semibold"><span>Cartão de crédito</span><span>R$ 9,90</span></div><p className="mt-2 text-stone-600">Pagamento protegido pelo Asaas. Você será direcionado à página segura do Asaas para informar os dados do cartão.</p></div><button id="btn-pagar-cartao-asaas" type="button" disabled={isCheckoutLoading} onClick={handleCheckout} className="w-full py-4 bg-purple-800 text-white font-bold rounded-xl">{isCheckoutLoading?<><Loader2 className="inline w-5 h-5 animate-spin"/> Abrindo Asaas...</>:<><CreditCard className="inline w-5 h-5"/> CONCLUIR PAGAMENTO — R$ 9,90</>}</button></div>}<p className="text-xs text-stone-500 mt-5"><ShieldCheck className="inline w-4 h-4"/> O resultado só é liberado após confirmação server-side do pagamento.</p></motion.div>}
    {currentStep==='resultado' && resultado && <motion.div key="resultado" variants={resultadoContainerVariants} initial="hidden" animate="visible" className="brand-page-card report-card w-full max-w-2xl bg-white p-6 md:p-10 rounded-2xl shadow-sm border"><div className="report-brand"><img src="/ja-logo-approved.webp" alt="Janaína Araújo"/><p>Seu Relatório Personalizado</p><small>Mini Diagnóstico Emocional</small></div><motion.h2 variants={resultadoItemVariants} className="text-2xl md:text-3xl font-bold mb-6 text-emerald-800 text-center border-b pb-6">Sua principal área de atenção: {resultado.resultado_dominante}</motion.h2><motion.div variants={resultadoItemVariants} className="space-y-4 text-stone-700 leading-relaxed"><p>Olá, {resultado.nome}.</p><p>Este resultado indica o padrão que mais se destacou nas suas respostas. Ele é uma ferramenta de autoconhecimento e não substitui avaliação, diagnóstico ou acompanhamento de profissionais de saúde.</p>{resultado.resultado_dominante==='MEDO'&&<><p>O medo é um mecanismo de proteção. Quando ocupa espaço demais, pode favorecer excesso de cautela, perfeccionismo e dificuldade para agir diante da incerteza.</p><h3 className="text-xl font-bold text-emerald-800">Seu primeiro movimento</h3><p>Escolha uma decisão pequena que você vem adiando e defina uma ação concreta e segura para as próximas 24 horas.</p></>}{resultado.resultado_dominante==='INSEGURANÇA'&&<><p>A insegurança pode fazer você questionar capacidades que já demonstrou possuir e buscar confirmação externa antes de confiar na própria percepção.</p><h3 className="text-xl font-bold text-emerald-800">Seu primeiro movimento</h3><p>Escolha uma pequena decisão e pergunte: “O que eu faria agora se confiasse um pouco mais na minha capacidade?”</p></>}{resultado.resultado_dominante==='PROCRASTINAÇÃO'&&<><p>A procrastinação muitas vezes aparece como uma forma de evitar desconforto, incerteza ou exposição, e não simplesmente como falta de disciplina.</p><h3 className="text-xl font-bold text-emerald-800">Seu primeiro movimento</h3><p>Reduza uma tarefa adiada à menor ação concreta que possa ser feita em dez minutos ou menos.</p></>}</motion.div><motion.div variants={resultadoItemVariants} className="report-actions">{quizSessionId&&resultToken&&<a href={`/api/diagnostico-pdf?id=${encodeURIComponent(quizSessionId)}&token=${encodeURIComponent(resultToken)}`} className="report-download">BAIXAR MEU DIAGNÓSTICO EM PDF</a>}<p>Mais do que um resultado, este é um convite para ampliar seu autoconhecimento.</p><div className="therapist-contact"><h3>Aprofunde seu diagnóstico com Janaína</h3><p>Se este resultado fez sentido para você, converse diretamente com a terapeuta.</p><a id="resultado-whatsapp-cta" href={`https://wa.me/5521983928113?text=${encodeURIComponent(`Olá, Janaína! Quero aprofundar meu diagnóstico de ${resultado.resultado_dominante}.`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle/> FALAR COM JANAÍNA NO WHATSAPP</a><a href="https://instagram.com/eujanainaaraujo" target="_blank" rel="noopener noreferrer"><Instagram/> @eujanainaaraujo</a></div></motion.div></motion.div>}
  </AnimatePresence></div>;
}
