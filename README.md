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

## Permissões por aba

Em **Cadastros › Permissões por usuário**, quem tem a ação "Gerenciar permissões" escolhe, para cada usuário, o que ele pode fazer em cada aba: Ver, Criar, Editar, Excluir e, onde existe, Importar, Exportar e Usar IA. O menu só mostra as abas com "Ver"; os botões de cada tela seguem a mesma matriz; e o banco aplica as mesmas regras por RLS (funções `mcl_pode`, `mcl_pode_de` e `mcl_matriz_permissoes`), então nada depende só da tela.

| Aba | Ações |
|---|---|
| Visão Geral | Ver |
| Contas | Ver, Criar, Editar, Excluir, Usar IA |
| Recebimentos | Ver, Criar, Editar, Excluir, Importar, Exportar |
| Documentos Fiscais | Ver, Criar, Editar, Excluir, Usar IA |
| Fluxo de Caixa | Ver, Criar, Editar, Excluir, Importar, Usar IA |
| Orçamentos | Ver, Criar, Editar, Excluir, Exportar |
| Viagens | Ver, Criar, Editar, Excluir |
| Planejamento | Ver, Criar, Editar, Excluir |
| RH | Ver, Criar, Editar, Excluir |
| Cadastros | Ver, Criar, Editar, Excluir, Gerenciar permissões |
| Usuários | Ver, Criar, Editar |

Quem não tem configuração salva usa o padrão do perfil: Administrador tem tudo (menos gerenciar permissões); os demais veem Documentos Fiscais (ver, criar, editar os próprios), Meu Orçamento (ver) e Viagens (ver, criar, editar as próprias). Enquanto ninguém tiver "Gerenciar permissões" salvo, todos os administradores ativos podem gerenciar; ao salvar a própria configuração, quem gerencia fica com essa ação marcada e não consegue tirá-la de si mesmo. Usuário inativo não tem permissão nenhuma.

Arquivos: `mcl-permissoes.js` (catálogo e matriz no navegador), `supabase/permissoes.sql` (migração `permissoes_por_aba`, com `supabase/permissoes-reverter.sql` para desfazer) e `supabase/functions/admin-users/index.ts` (a Edge Function passa a exigir Usuários › Criar/Editar).

## IA financeira

Os endpoints em `/api` utilizam a variável de ambiente `OPENAI_API_KEY`. Opcionalmente, `OPENAI_FINANCE_MODEL` permite escolher outro modelo; na ausência dessa variável é usado `gpt-5.6-luna`.

A IA pode auxiliar na leitura de contas/faturas, comprovantes e classificação de movimentações. Os dados gravados continuam pertencendo exclusivamente ao Supabase Financeiro MCL.
