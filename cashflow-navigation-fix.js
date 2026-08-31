/* Financeiro MCL — mantém o estado interno da navegação sincronizado com o Fluxo canônico */
(()=>{'use strict';
document.addEventListener('click',e=>{
  const b=e.target.closest?.('.nav [data-view="cashflow"]');
  if(!b)return;
  /*
   * app.js guarda a aba ativa em uma variável privada (`view`).
   * O Fluxo canônico intercepta o clique em capture; por isso o handler original
   * não chegava a registrar `cashflow` e qualquer render global voltava ao dashboard.
   * Aqui executamos o handler original uma única vez antes da interceptação canônica,
   * sincronizando o estado privado sem duplicar navegação.
   */
  if(typeof b.onclick!=='function')return;
  e.preventDefault();
  e.stopImmediatePropagation();
  b.onclick.call(b,e);
  setTimeout(()=>window.MCLCashflowCanonical?.render?.(),0);
},true);
})();
