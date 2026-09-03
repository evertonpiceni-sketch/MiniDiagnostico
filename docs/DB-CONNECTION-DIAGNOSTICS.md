# Diagnóstico de conexão Supabase

## Status registrado

O fluxo do Mini Diagnóstico chega ao final do quiz, mas a persistência da sessão pode retornar `DB_CONNECTION` no endpoint `/api/quiz`.

Esse código significa que a função serverless da Vercel tentou acessar o endpoint REST do Supabase, mas a conexão de rede não foi estabelecida. Não significa, por si só, erro de formulário, cálculo do resultado ou Stripe.

## Como o backend diagnostica

O arquivo `api/[...path].ts`:

- remove a barra final de `SUPABASE_URL`;
- exige URL HTTPS em domínio `*.supabase.co`;
- exige `SUPABASE_SERVICE_ROLE_KEY` configurada;
- acessa `${SUPABASE_URL}/rest/v1/quiz_sessions`;
- aplica timeout de 10 segundos;
- converte falhas de rede como `ENOTFOUND`, `EAI_AGAIN` e `ECONNREFUSED` em `DB_CONNECTION`;
- converte timeout em `DB_TIMEOUT`;
- preserva respostas HTTP do Supabase como `DB_400`, `DB_401`, `DB_403`, `DB_404` e `DB_409`.

Nenhuma chave secreta deve ser registrada neste documento, em issues ou em commits.

## Interpretação dos códigos

| Código | Significado | Ação |
|---|---|---|
| `DB_CONFIG` | URL/chave ausente ou chave curta | Conferir variáveis da Vercel |
| `DB_URL_INVALID` | URL fora do formato esperado | Usar a URL do projeto Supabase |
| `DB_CONNECTION` | Falha de conexão/DNS/rede | Conferir URL, projeto e disponibilidade do Supabase |
| `DB_TIMEOUT` | Supabase não respondeu no limite | Verificar disponibilidade/conectividade |
| `DB_401` | Credencial recusada | Conferir a service role key do mesmo projeto |
| `DB_403` | Permissão recusada | Conferir credencial/permissões do backend |
| `DB_404` | Recurso/tabela não encontrado | Conferir projeto e tabela `quiz_sessions` |
| `DB_400` | Dados/schema rejeitados | Conferir `supabase/schema.sql` e schema implantado |
| `DB_409` | Conflito ao criar sessão | Repetição/conflito de sessão; revisar registro existente |

## Checklist de produção

1. Na Vercel, confirmar `SUPABASE_URL` em **Production**.
2. Confirmar `SUPABASE_SERVICE_ROLE_KEY` em **Production**.
3. Garantir que as duas variáveis pertencem ao **mesmo projeto Supabase**.
4. Não usar a chave pública/anon no lugar da service role key no backend.
5. Após alterar variáveis, executar um novo **Redeploy** de Production.
6. Testar `/api/health`.
7. Testar o fluxo completo: cadastro → 12 perguntas → gravação em `quiz_sessions` → paywall.
8. Depois testar pagamento → webhook Stripe → `paid` → resultado.

## Critério de encerramento

O incidente de conexão é considerado resolvido quando:

- `/api/health` reportar banco conectado;
- `POST /api/quiz` retornar `201` para uma nova sessão (ou `200` quando uma sessão idêntica for reutilizada);
- a linha aparecer em `public.quiz_sessions`;
- o restante do fluxo de pagamento e resultado funcionar sem erro de persistência.

## Segurança

Nunca registrar no GitHub ou compartilhar em mensagens:

- `SUPABASE_SERVICE_ROLE_KEY`;
- `STRIPE_SECRET_KEY`;
- `STRIPE_WEBHOOK_SECRET`;
- `RESEND_API_KEY`;
- qualquer outro segredo da Vercel.

O diagnóstico deve usar apenas códigos de erro e informações não sensíveis.