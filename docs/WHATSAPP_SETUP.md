# WhatsApp Cloud API — configuração do envio automático

O backend envia o resultado automaticamente quando o pagamento Stripe muda para `paid`.

## Variáveis de ambiente na Vercel

Cadastre em **Project Settings → Environment Variables**:

- `WHATSAPP_PHONE_NUMBER_ID`: ID do número no WhatsApp Business / Meta Developers.
- `WHATSAPP_ACCESS_TOKEN`: token de acesso da WhatsApp Cloud API. Nunca coloque esse token no frontend ou no GitHub.
- `WHATSAPP_API_VERSION`: versão da Graph API. O código usa `v23.0` quando esta variável não estiver definida.
- `WHATSAPP_TEMPLATE_NAME`: nome de um template aprovado pela Meta para envio iniciado pela empresa. Recomendado para produção.
- `WHATSAPP_TEMPLATE_LANGUAGE`: idioma do template. Padrão: `pt_BR`.
- `APP_URL`: URL pública do app, por exemplo `https://mini-diagnostico-chae.vercel.app`.

## Template esperado

Quando `WHATSAPP_TEMPLATE_NAME` estiver configurado, o backend envia 6 parâmetros no corpo, nesta ordem:

1. nome do cliente
2. padrão dominante
3. pontuação de medo
4. pontuação de insegurança
5. pontuação de procrastinação
6. link do resultado

O template aprovado na Meta precisa ter exatamente os placeholders compatíveis com esses seis parâmetros.

Exemplo de conteúdo:

`Olá, {{1}}! Seu pagamento foi confirmado. Seu padrão dominante é {{2}}. Medo: {{3}}/12, Insegurança: {{4}}/12, Procrastinação: {{5}}/12. Veja seu resultado completo: {{6}}`

Se `WHATSAPP_TEMPLATE_NAME` não estiver configurado, o backend tenta enviar uma mensagem de texto comum. Esse tipo de mensagem está sujeito às regras de janela de atendimento do WhatsApp e pode ser rejeitado pela Meta. Para envio automático confiável após o pagamento, use template aprovado.

## Verificação

Depois do deploy, abra `/api/health` e confira:

- `whatsappConfigured: true`
- `whatsappTemplateConfigured: true` (recomendado em produção)
- `emailDelivery: false`

O envio ocorre apenas no momento em que uma sessão de pagamento passa de pendente para paga, via webhook Stripe ou verificação do pagamento.
