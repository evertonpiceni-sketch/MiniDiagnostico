# Mini Diagnóstico — auditoria final de produção (2026-09-07)

## Fonte de verdade
- Identidade visual: prancha aprovada pela cliente e hero desktop aprovado em 07/09/2026.
- Preço: R$ 9,90.
- Pagamentos: somente Asaas, Pix e cartão de crédito.
- Resultado: confidencial antes da confirmação financeira server-side.
- Entrega: resultado/relatório protegido por token; sem dependência de e-mail.

## Estado auditado do código
- `api/checkout.ts` cria cobrança `CREDIT_CARD` no Asaas e devolve `invoiceUrl`; não usa Stripe.
- `api/asaas-pix.ts` é a rota de Pix.
- `src/App.tsx` chama `/api/checkout` para cartão e `/api/asaas-pix` para Pix.
- O guard de produção rejeita referências executáveis de Stripe, preço/layout antigos e vazamento de resultado.
- `package.json` não possui SDK Stripe.
- `ADMIN_BOOTSTRAP_SECRET` não é referenciado pelo código atual e não faz parte do fluxo do Mini Diagnóstico.

## Achado crítico
A produção observada pelo usuário abriu `checkout.stripe.com` e exibiu texto de Stripe/e-mail. Isso não corresponde ao `main` auditado. Portanto o domínio de produção está servindo um artefato/deployment antigo ou outro deployment que não corresponde ao commit atual.

## Pendências antes de declarar concluído
1. Incorporar a branch visual final na `main` somente após CI/build.
2. Garantir que o deployment de produção do domínio canônico corresponda ao SHA da `main` final.
3. Confirmar que cartão abre `invoiceUrl` do Asaas e nunca `checkout.stripe.com`.
4. Confirmar Pix com QR Code + Copia e Cola e confirmação por webhook/verificação server-side.
5. Fazer teste real de R$ 9,90 antes de declarar E2E financeiro aprovado.
6. Conferir visualmente desktop e mobile contra a prancha aprovada.

## Critério de aceite
Nenhum texto, SDK, URL ou fluxo executável de Stripe; nenhum resultado pré-pagamento; R$ 9,90; Pix/cartão Asaas; relatório protegido; identidade visual fiel à referência aprovada.
