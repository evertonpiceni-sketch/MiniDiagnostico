const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldTry = `    try {
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
    }`;

const newTry = `    try {
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
    }`;

code = code.replace(oldTry, newTry);

fs.writeFileSync('src/App.tsx', code);
console.log('Finished fixing quiz finish handler.');
