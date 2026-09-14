# Relatório de publicação — resultados Mini Diagnóstico

Data: 14/09/2026

## Escopo aplicado
- Mesmo layout de resultado para o fluxo técnico de teste e para o resultado pago.
- Os dois fluxos usam a mesma `.report-card` e a mesma camada de apresentação em `src/result-enhancer.ts`.
- Os textos são lidos diretamente de `src/result-content.ts`, que contém a versão definitiva aprovada de MEDO, INSEGURANÇA e PROCRASTINAÇÃO.
- Nenhum resumo ou reescrita dos textos foi introduzido na camada visual.

## Ajustes visuais
- Cards compactados para retirar excesso de espaço vazio.
- Hierarquia mantida: abertura, interpretação, sinais, efeitos, pergunta importante, caminho de transformação, práticas e frase final.
- Cabeçalho visual reaproveita a arte dos PDFs existentes apenas como imagem de topo; o conteúdo textual visível é renderizado em HTML a partir da fonte canônica.
- Layout responsivo para celular e desktop.
- PROCRASTINAÇÃO preserva o ciclo completo com as setas.

## Ações
- CTA de WhatsApp permanece clicável e abre conversa com Janaína com nome e padrão predominante na mensagem.
- Botão de download de PDF permanece ativo.
- O mesmo comportamento é aplicado ao teste administrativo e ao resultado liberado após pagamento.

## Arquivos alterados
- `src/result-enhancer.ts`
- `src/result-final.css`

## Commits
- `72d18312e4fd3aaaad28ed720d71a83bcf971166` — Apply canonical result layout to test and paid views
- `e337078fc7b74584150b62534182841c0face2b0` — Compact result cards and align approved visual hierarchy

## Observação
As mudanças não alteram perguntas, desempate, pagamento, autenticação ou lógica do diagnóstico.