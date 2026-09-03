# Diagnóstico de conexão com Supabase

## Objetivo

Registrar o procedimento oficial para diagnosticar falhas de persistência entre a função serverless da Vercel e o Supabase, sem expor credenciais.

## Endpoint de diagnóstico

Depois de um deploy de produção, consultar:

`/api/db-diagnostic`

O endpoint verifica:

1. se `SUPABASE_URL` está configurada;
2. se `SUPABASE_SERVICE_ROLE_KEY` está presente e tem formato mínimo plausível;
3. se `SUPABASE_URL` usa HTTPS e aponta para `*.supabase.co`;
4. se a Vercel consegue resolver e acessar o endpoint REST do Supabase;
5. se a tabela `quiz_sessions` responde.

## Códigos de diagnóstico

| Código | Significado | Próxima verificação |
|---|---|---|
| `DB_OK` | Conexão e consulta à tabela funcionaram | Testar o fluxo completo do quiz |
| `DB_CONFIG_URL_MISSING` | `SUPABASE_URL` ausente | Vercel → Environment Variables |
| `DB_CONFIG_KEY_MISSING` | Service Role Key ausente/inválida | Vercel → Environment Variables |
| `DB_URL_INVALID` | URL inválida | Usar a URL do projeto Supabase |
| `DB_DNS_ENOTFOUND` | Hostname não encontrado | Conferir URL/projeto Supabase |
| `DB_DNS_TEMPORARY` | Falha temporária de DNS | Repetir o teste e verificar disponibilidade do Supabase |
| `DB_CONNECTION_REFUSED` | Conexão recusada | Verificar disponibilidade/configuração do projeto |
| `DB_CONNECTION_RESET` | Conexão interrompida | Repetir e verificar disponibilidade do serviço |
| `DB_CONNECTION` | Falha HTTP não classificada | Consultar logs da função Vercel |
| `DB_TIMEOUT` | Supabase não respondeu no limite | Verificar disponibilidade e latência |
| `DB_401` | Credencial rejeitada | Conferir a Service Role Key do mesmo projeto |
| `DB_403` | Permissão rejeitada | Conferir credencial e permissões |
| `DB_404` | Recurso/tabela não encontrado | Conferir projeto e `quiz_sessions` |
| `DB_400` | Requisição/schema rejeitado | Conferir `supabase/schema.sql` |

## Segurança

O endpoint **não deve retornar nem registrar a Service Role Key**. O diagnóstico pode informar apenas hostname, código de erro, status HTTP e uma descrição segura.

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` ou outras credenciais neste arquivo, em commits ou em mensagens de diagnóstico.

## Procedimento de produção

1. Fazer deploy do commit atual.
2. Abrir `/api/db-diagnostic` na aplicação de produção.
3. Registrar o `code`, `httpStatus` e `detail` retornados.
4. Corrigir somente a camada indicada pelo código.
5. Repetir até obter `DB_OK`.
6. Com `DB_OK`, executar o fluxo: cadastro → 12 perguntas → persistência → paywall → checkout → webhook → resultado.

## Histórico

- `f5b219d97ac4cda7c5d85f8a9ba5c60f2be1b9da` — adiciona diagnóstico preciso de conexão Supabase.
