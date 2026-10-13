const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const P=require('../mcl-permissoes');
const admin={id:'a',tipo:'Administrador',ativo:true},func={id:'f',tipo:'Funcionário',ativo:true};
const todas=m=>P.ABAS.flatMap(t=>t.acoes.map(a=>[t.id,a,m[t.id][a]]));

test('catálogo do front e do banco são os mesmos',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'..','supabase','permissoes.sql'),'utf8');
 const json=sql.slice(sql.indexOf("select '{",sql.indexOf('mcl_catalogo_permissoes'))+8);
 const banco=JSON.parse(json.slice(0,json.indexOf("}'::jsonb")+1));
 assert.deepEqual(Object.fromEntries(P.ABAS.map(t=>[t.id,t.acoes])),banco);
 for(const t of P.ABAS)for(const a of t.acoes)assert.ok(P.ACOES[a],`ação sem rótulo: ${a}`);
});

test('administrador sem linha salva tem tudo, menos gerenciar permissões',()=>{
 const m=P.padrao(admin);
 for(const [aba,acao,v] of todas(m))assert.equal(v,!(aba==='registers'&&acao==='permissoes'),`${aba}.${acao}`);
});

test('funcionário sem linha salva vê só documentos, orçamento e viagens',()=>{
 const m=P.padrao(func),sim=new Set(['documents.ver','documents.criar','documents.editar','budgets.ver','trips.ver','trips.criar','trips.editar']);
 for(const [aba,acao,v] of todas(m))assert.equal(v,sim.has(`${aba}.${acao}`),`${aba}.${acao}`);
 assert.deepEqual(P.abasVisiveis(m).map(t=>t.id),['documents','budgets','trips']);
});

test('o padrão do front é o mesmo de mcl_padrao_permissao no SQL',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'..','supabase','permissoes.sql'),'utf8');
 const bloco=sql.slice(sql.indexOf('mcl_padrao_permissao'),sql.indexOf('$$;',sql.indexOf('mcl_padrao_permissao')));
 const pares=[...bloco.matchAll(/\('(\w+)','(\w+)'\)/g)].map(m=>`${m[1]}.${m[2]}`).sort();
 const front=todas(P.padrao(func)).filter(([, ,v])=>v).map(([a,x])=>`${a}.${x}`).sort();
 assert.deepEqual(front,pares);
});

test('linha salva vale sobre o padrão e o que faltar vem do padrão',()=>{
 const m=P.efetivas(admin,{accounts:{ver:false},receivables:{excluir:false},registers:{permissoes:true},lixo:{ver:true}});
 assert.equal(m.accounts.ver,false);assert.equal(m.accounts.criar,true);
 assert.equal(m.receivables.excluir,false);assert.equal(m.receivables.ver,true);
 assert.equal(m.registers.permissoes,true);assert.equal(m.lixo,undefined);
 const f=P.efetivas(func,{cashflow:{ver:true,editar:'sim'}});
 assert.equal(f.cashflow.ver,true);assert.equal(f.cashflow.editar,false);
});

test('usuário inativo não tem nada, mesmo com linha salva',()=>{
 const m=P.efetivas({tipo:'Administrador',ativo:false},P.vazia(true));
 for(const [, ,v] of todas(m))assert.equal(v,false);
 assert.equal(P.abasVisiveis(m).length,0);
});

test('normalizar descarta chaves fora do catálogo e valores que não são booleanos',()=>{
 const m=P.normalizar({accounts:{ver:1,criar:true,outra:true},inventada:{ver:true}});
 assert.equal(m.accounts.ver,false);assert.equal(m.accounts.criar,true);assert.equal(m.accounts.outra,undefined);assert.equal(m.inventada,undefined);
 assert.ok(P.iguais(P.vazia(true),P.normalizar(P.vazia(true))));assert.ok(!P.iguais(P.vazia(true),P.vazia(false)));
});

test('pode() responde pela matriz carregada e é falso antes de carregar',()=>{
 assert.equal(P.pode('accounts'),false);
 P.definir({accounts:{ver:true,excluir:false}},admin);
 assert.equal(P.pode('accounts'),true);assert.equal(P.pode('accounts','excluir'),false);assert.equal(P.pode('accounts','editar'),true);
 assert.equal(P.pode('inexistente'),false);assert.equal(P.gestor(),false);
 P.definir({registers:{permissoes:true}},admin);assert.equal(P.gestor(),true);
});

test('carregar usa a rpc e, sem ela, cai no padrão do perfil',async()=>{
 const sb={rpc:async nome=>{assert.equal(nome,'mcl_matriz_permissoes');return {data:{accounts:{ver:false}},error:null}}};
 const m=await P.carregar(sb,admin);assert.equal(m.accounts.ver,false);assert.equal(m.cashflow.ver,true);assert.equal(P.estado.carregada,true);
 const antes=console.warn;console.warn=()=>{};
 try{const f=await P.carregar({rpc:async()=>({data:null,error:new Error('indisponível')})},func);assert.equal(f.documents.ver,true);assert.equal(f.cashflow.ver,false);assert.equal(P.estado.carregada,false)}finally{console.warn=antes}
});

test('app.js lê o menu e cada botão pela matriz, não pelo tipo do perfil',()=>{
 const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
 assert.ok(app.includes("pode(id)"),'menu filtrado por pode()');
 for(const trecho of ["pode('accounts','criar')","pode('accounts','editar')","pode('accounts','excluir')","pode('documents','criar')","pode('cashflow','criar')","pode('budgets','criar')","pode('budgets','editar')","pode('budgets','excluir')","pode('budgets','exportar')","pode('trips','criar')","pode('trips','excluir')","pode('planning','criar')","pode('registers','criar')","pode('registers','editar')","pode('registers','excluir')","pode('registers','permissoes')","pode('users','criar')","pode('users','editar')"])assert.ok(app.includes(trecho),trecho);
 assert.ok(!app.includes('navStaff'),'menu fixo por tipo removido');
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.ok(html.indexOf('mcl-permissoes.js')<html.indexOf('app.js?'),'mcl-permissoes.js carrega antes do app.js');
});

test('nenhum módulo decide acesso lendo o texto "Administrador" do menu',()=>{
 const raiz=path.join(__dirname,'..'),html=fs.readFileSync(path.join(raiz,'index.html'),'utf8');
 const carregados=[...html.matchAll(/src="([a-z0-9-]+\.js)/gi)].map(m=>m[1]);
 for(const f of carregados){const t=fs.readFileSync(path.join(raiz,f),'utf8');assert.ok(!/Administrador\/i\.test\(q\('\.user-mini'\)/.test(t),f)}
});
