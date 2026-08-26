# Financeiro MCL

Sistema financeiro exclusivo da **Minha Casa Legal**.

## Estrutura

- `index.html` — entrada única da aplicação
- `app.js` — núcleo financeiro e autenticação
- `rh.js` — módulo oficial de RH
- `ai.js` — integração oficial da IA financeira
- `styles.css` — identidade visual Minha Casa Legal
- `supabase-config.js` — conexão pública com o Supabase Financeiro MCL
- `api/` — funções serverless de leitura e classificação por IA

Não existem arquivos `patch-v*`, diretórios de versões ou dados demonstrativos da Integral.

## Banco de dados

Projeto Supabase exclusivo: `jeuecmmnxvlzpruyoraw` — **Financeiro MCL**.

Contas, pagamentos, documentos, fluxo de caixa, orçamentos, viagens, planejamento, RH, cadastros e usuários usam exclusivamente esse projeto.

O primeiro acesso deve usar **Criar primeiro administrador**. Essa operação só funciona enquanto não houver nenhum perfil cadastrado. Novos usuários criados posteriormente pelo administrador já são confirmados no Auth e não dependem de e-mail de confirmação.

## IA financeira

Os endpoints em `/api` utilizam a variável de ambiente `OPENAI_API_KEY`. Opcionalmente, `OPENAI_FINANCE_MODEL` permite escolher outro modelo; na ausência dessa variável é usado `gpt-5.6-luna`.

A IA pode auxiliar na leitura de contas/faturas, comprovantes e classificação de movimentações. Os dados gravados continuam pertencendo exclusivamente ao Supabase Financeiro MCL.
