/* Financeiro MCL — acesso à aba Recebimentos
   O menu principal da MCL já decide quais abas o perfil pode visualizar.
   Este guard apenas impede que a camada extra esconda Recebimentos de um
   administrador por não conseguir acessar variáveis léxicas internas do app.js. */
(function(){
'use strict';
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

function menuAlreadyAuthorized(){
  return !!document.querySelector('.nav [data-view="receivables"],.nav [data-view="recebimentos"],.nav [data-view="receipts"]');
}

function currentUser(){
  return window.MCLCurrentProfile || window.profile || null;
}

function allowed(){
  /* Se o app nativo renderizou o item no menu, o perfil já passou pela regra
     de autorização do app.js. Isto corrige o falso bloqueio que ocorria porque
     profile/admin são variáveis privadas do IIFE principal e não existem em window. */
  if(menuAlreadyAuthorized()) return true;
  const u=currentUser();
  const role=norm(u?.role||u?.tipo||u?.type);
  const sector=norm(u?.setor||u?.sector);
  return role==='administrador'||role==='financeiro'||sector==='financeiro';
}

function guard(){
 const buttons=[...document.querySelectorAll('.nav [data-view="receivables"],.nav [data-view="recebimentos"],.nav [data-view="receipts"]')];
 buttons.forEach(b=>{
   if(allowed()){
     b.hidden=false;
     b.style.removeProperty('display');
   } else {
     b.hidden=true;
     b.style.setProperty('display','none','important');
   }
 });
}

document.addEventListener('click',e=>{
 const b=e.target.closest?.('[data-view="receivables"],[data-view="recebimentos"],[data-view="receipts"]');
 if(b&&!allowed()){
   e.preventDefault();
   e.stopImmediatePropagation();
   guard();
 }
},true);

let pending=false;
new MutationObserver(()=>{
 if(pending)return;
 pending=true;
 queueMicrotask(()=>{pending=false;guard()});
}).observe(document.documentElement,{childList:true,subtree:true});

window.addEventListener('load',guard);
setTimeout(guard,0);
window.MCLRecebimentosAccess={allowed,guard};
})();