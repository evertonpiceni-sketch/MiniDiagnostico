# Diagnóstico de conexão Supabase

## Objetivo

Registrar no repositório o procedimento oficial para diagnosticar falhas de conexão entre a função serverless da Vercel e o Supabase.

## Sintoma observado

O fluxo do quiz chega à etapa final, mas o `POST /api/quiz` pode retornar `503` com o código `DB_CONNECTION`.

Isso significa que a rota da aplicação foi alcançada, porém a tentativa HTTP da função da Vercel para o endpoint REST do Supabase não foi concluída com sucesso.

## Endpoint de diagnóstico

Após cada deploy de produção, testar:

`GET /api/db-diagnostic`

Exemplo:

`https://mini-diagnostico-chae.vercel.app/api/db-diagnostic`

A resposta nunca deve expor `SUPABASE_SERVICE_ROLE_KEY`.

## Códigos possíveis

| Código | Significado | Próxima verificação |
|---|---|---|
| `DB_OK` | Conexão e tabela respondendo | Nenhuma; testar o fluxo completo |
| `DB_CONFIG_URL_MISSING` | `SUPABASE_URL` ausente | Vercel → Environment Variables |
| `DB_CONFIG_KEY_MISSING` | Service Role Key ausente/inválida | Vercel → Environment Variables |
| `DB_URL_INVALID` | URL não é um endpoint Supabase HTTPS válido | Conferir URL do projeto |
| `DB_DNS_ENOTFOUND` | Hostname não resolvido | Conferir `SUPABASE_URL` |
| `DB_DNS_TEMPORARY` | Falha temporária de DNS | Repetir teste e conferir disponibilidade do projeto |
| `DB_CONNECTION_REFUSED` | Conexão recusada | Conferir disponibilidade/configuração do projeto |
| `DB_CONNECTION_RESET` | Conexão interrompida | Repetir teste e conferir disponibilidade |
| `DB_CONNECTION` | Falha de conexão não classificada | Conferir logs da função Vercel |
| `DB_TIMEOUT` | Supabase não respondeu no limite | Conferir projeto e disponibilidade |
| `DB_401` | Credencial rejeitada | Confirmar Service Role Key do mesmo projeto |
| `DB_403` | Permissão rejeitada | Confirmar credencial e permissões |
| `DB_404` | Recurso/tabela não encontrado | Confirmar projeto e tabela `quiz_sessions` |
| `DB_400` | Requisição/schema rejeitado | Conferir `supabase/schema.sql` |

## Variáveis obrigatórias em Production

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

As duas devem pertencer ao **mesmo projeto Supabase**.

Nunca registrar valores dessas variáveis em issues, commits, screenshots ou documentação.

## Procedimento de validação

1. Fazer deploy da `main`.
2. Abrir `/api/db-diagnostic`.
3. Se retornar `DB_OK`, testar o cadastro completo.
4. Se retornar erro de configuração, corrigir as Environment Variables da Vercel.
5. Após alterar variáveis, fazer novo Redeploy da Production.
6. Repetir `/api/db-diagnostic`.
7. Somente depois validar o fluxo completo: cadastro → 12 perguntas → persistência → paywall → Stripe → webhook → resultado.

## Registro da implementação

A versão inicial do diagnóstico foi adicionada no commit `f5b219d97ac4cda7c5d85f8a9ba5c60f2be1b9da` com a mensagem `fix: add precise Supabase connection diagnostics`.

O diagnóstico diferencia falhas de configuração, DNS, conexão, timeout e respostas HTTP do Supabase, mantendo as credenciais fora da resposta.
