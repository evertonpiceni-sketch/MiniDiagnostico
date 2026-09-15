# Auditoria de resultados — 2026-09-15

Escopo desta branch: corrigir somente a apresentação visual dos resultados, preservando integralmente o conteúdo definitivo e o fluxo existente.

Ordem executada:
1. MEDO
2. INSEGURANÇA
3. PROCRASTINAÇÃO

Gabarito visual: composição aprovada enviada pelo cliente (três resultados lado a lado).
Gabarito textual: `src/result-content.ts` existente, sem alteração nesta branch.

Verificação de diff contra `fddb342`: somente `src/result-approved-layout-fix.css` foi alterado durante as correções visuais até o commit `83ffc6d`.

Pontos preservados: perguntas, lógica, desempate, pagamento, Asaas, WhatsApp e conteúdo definitivo.

Pontos corrigidos no CSS: proporção do poster, hero, marca circular integrada, hierarquia do cabeçalho, frase, título do padrão, composição dos cards, pares de sinais/efeitos, pergunta importante, caminho, práticas, citação, CTAs e rodapé. Em PROCRASTINAÇÃO, os rótulos são texto transparente sobre a fotografia, sem recriar placas artificiais.

Não fazer merge antes da validação visual do Preview e da verificação do PDF baixado.