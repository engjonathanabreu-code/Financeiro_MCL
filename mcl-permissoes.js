/* Financeiro MCL — permissões por aba e por usuário.
   A matriz efetiva vem do banco (rpc mcl_matriz_permissoes), que é quem realmente bloqueia via RLS.
   Este módulo só guarda a matriz, responde pode(aba,acao) e descreve o catálogo para a tela de Cadastros.
   Os ids das abas são os mesmos data-view do menu; "rh" é a aba que rh.js injeta. */
(function(root){
'use strict';
const ABAS=[
 {id:'dashboard',nome:'Visão Geral',acoes:['ver']},
 {id:'accounts',nome:'Contas',acoes:['ver','criar','editar','excluir','ia']},
 {id:'receivables',nome:'Recebimentos',acoes:['ver','criar','editar','excluir','importar','exportar']},
 {id:'documents',nome:'Documentos Fiscais',acoes:['ver','criar','editar','excluir','ia']},
 {id:'cashflow',nome:'Fluxo de Caixa',acoes:['ver','criar','editar','excluir','importar','ia']},
 {id:'budgets',nome:'Orçamentos',acoes:['ver','criar','editar','excluir','exportar']},
 {id:'trips',nome:'Viagens',acoes:['ver','criar','editar','excluir']},
 {id:'planning',nome:'Planejamento',acoes:['ver','criar','editar','excluir']},
 {id:'rh',nome:'RH',acoes:['ver','criar','editar','excluir']},
 {id:'registers',nome:'Cadastros',acoes:['ver','criar','editar','excluir','permissoes']},
 {id:'users',nome:'Usuários',acoes:['ver','criar','editar']}
];
const ACOES={ver:'Ver',criar:'Criar',editar:'Editar',excluir:'Excluir',importar:'Importar',exportar:'Exportar',ia:'Usar IA',permissoes:'Gerenciar permissões'};
const DESCRICOES={
 dashboard:'Painel com saldo, contas a vencer, documentos e viagens.',
 accounts:'Contas a pagar e seus pagamentos. "Usar IA" libera a leitura de contas por IA.',
 receivables:'Municípios, clientes e parcelas a receber. Importar cobre planilhas e relatórios de pagamento; Exportar, o relatório do município.',
 documents:'Notas e comprovantes. Quem envia um documento sempre vê e edita o próprio.',
 cashflow:'Entradas e saídas realizadas. Importar cobre o extrato bancário; Editar também permite somar lançamentos.',
 budgets:'Orçamentos por setor com etapas, gastos e anexos. Exportar gera planilha e PDF.',
 trips:'Viagens e comprovações. Quem registra uma viagem sempre vê e edita a própria.',
 planning:'Receitas e despesas previstas nos próximos meses.',
 rh:'Colaboradores, folha mensal e pagamentos.',
 registers:'Naturezas, setores e esta tabela de permissões.',
 users:'Contas de acesso: criar e editar usuários, setor, função e senha.'
};
const PADRAO_FUNCIONARIO=new Set(['documents:ver','documents:criar','documents:editar','budgets:ver','trips:ver','trips:criar','trips:editar']);
const ehAdmin=p=>String(p?.tipo||'')==='Administrador';
const ativo=p=>!!p&&p.ativo!==false;
const vazia=valor=>{const out={};for(const a of ABAS){out[a.id]={};for(const x of a.acoes)out[a.id][x]=!!valor}return out};
/* Espelho de mcl_padrao_permissao (supabase/permissoes.sql): quem não tem linha salva recebe isto. */
function padrao(perfil){const admin=ehAdmin(perfil),on=ativo(perfil),out={};for(const a of ABAS){out[a.id]={};for(const x of a.acoes)out[a.id][x]=on&&!(a.id==='registers'&&x==='permissoes')&&(admin||PADRAO_FUNCIONARIO.has(`${a.id}:${x}`))}return out}
/* Só chaves do catálogo e só booleanos; o que faltar vem de base (ou false). */
function normalizar(matriz,base=null){const out={};for(const a of ABAS){out[a.id]={};for(const x of a.acoes){const v=matriz?.[a.id]?.[x];out[a.id][x]=typeof v==='boolean'?v:!!base?.[a.id]?.[x]}}return out}
function efetivas(perfil,salvas){if(!ativo(perfil))return vazia(false);return normalizar(salvas,padrao(perfil))}
const abasVisiveis=matriz=>ABAS.filter(a=>!!matriz?.[a.id]?.ver);
const iguais=(a,b)=>ABAS.every(t=>t.acoes.every(x=>!!a?.[t.id]?.[x]===!!b?.[t.id]?.[x]));
const estado={matriz:null,perfil:null,carregada:false,erro:null};
function pode(aba,acao='ver'){return !!estado.matriz?.[aba]?.[acao]}
function definir(matriz,perfil){estado.perfil=perfil||estado.perfil;estado.matriz=efetivas(estado.perfil,matriz);estado.carregada=true;return estado.matriz}
async function carregar(sb,perfil){estado.perfil=perfil;try{const r=await sb.rpc('mcl_matriz_permissoes');if(r.error)throw r.error;estado.matriz=efetivas(perfil,r.data);estado.carregada=true;estado.erro=null}catch(e){estado.matriz=padrao(perfil);estado.carregada=false;estado.erro=e;console.warn('Permissões: tabela indisponível, usando o padrão do perfil.',e?.message||e)}return estado.matriz}
const api={ABAS,ACOES,DESCRICOES,ehAdmin,padrao,vazia,normalizar,efetivas,abasVisiveis,iguais,pode,carregar,definir,estado,gestor:()=>pode('registers','permissoes')};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MCLPermissoes=api;
})(typeof window!=='undefined'?window:globalThis);
