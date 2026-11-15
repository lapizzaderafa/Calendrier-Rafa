(function(){
"use strict";
const J=window.RafaJeudis,$=id=>document.getElementById(id),C=J.CONFIG;
let view="orders",focusDate=J.scheduleFor().target;
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusLabels={pending:"À préparer",preparing:"En préparation",ready:"Prête",delivered:"Remise",cancelled:"Annulée"};
function all(){return J.loadDemo()}
function update(id,patch){const list=all(),i=list.findIndex(o=>o.id===id);if(i<0)return;list[i]={...list[i],...patch};J.saveDemo(list);render()}
function orders(){return all().filter(o=>o.date===focusDate);}
function available(){return J.activeOrders(orders(),focusDate);}
function total(oo){return oo.reduce((n,o)=>n+J.amount(o.items),0)}
function card(o){
 const el=document.createElement("article");el.className="order";
 const plans=(o.pickups||[]).map(p=>J.niceTime(p.time)+" ("+p.qty+")").join(" · ");
 el.innerHTML='<div class="order-top"><div><strong>'+safe(plans||"Aucun créneau")+'</strong><div class="muted">'+safe(o.name)+' · '+safe(o.id)+'</div></div><span class="pill">'+safe(statusLabels[o.status]||o.status)+'</span></div>'+
 '<div class="order-info">'+o.items.map(i=>safe(i.qty+" × "+i.pizza)).join("<br>")+'</div>'+
 '<div class="muted section-spacer">'+(J.amount(o.items)*C.unitPrice)+' $ · '+(o.payment==="cash"?"Comptant":"Interac")+' · '+(o.paid?"Payé":"Non payé")+'</div>'+
 '<div class="order-actions"><button type="button" data-action="advance">Étape suivante</button><button type="button" data-action="paid">'+(o.paid?"Annuler payé":"Marquer payé")+'</button><button type="button" data-action="cancel">'+(o.status==="cancelled"?"Rétablir":"Annuler commande")+'</button></div>';
 el.querySelector('[data-action="advance"]').disabled=["delivered","cancelled"].includes(o.status);
 el.querySelector('[data-action="advance"]').onclick=()=>{const next={pending:"preparing",preparing:"ready",ready:"delivered"}[o.status];if(next)update(o.id,{status:next})};
 el.querySelector('[data-action="paid"]').onclick=()=>update(o.id,{paid:!o.paid});
 el.querySelector('[data-action="cancel"]').onclick=()=>update(o.id,{status:o.status==="cancelled"?"pending":"cancelled"});
 return el;
}
function orderView(){
 const list=orders().sort((a,b)=>(a.pickups?.[0]?.time||"").localeCompare(b.pickups?.[0]?.time||""));
 $("view").innerHTML='<h2>Commandes fictives</h2><p class="muted">Tu peux cliquer sur chaque statut. Les commandes restent uniquement dans ton navigateur.</p>';
 if(!list.length){$("view").innerHTML+='<div class="empty">Aucune commande fictive pour ce jeudi. Passe d’abord par la démo client.</div>';return;}
 list.forEach(o=>$("view").appendChild(card(o)));
}
function serviceView(){
 const list=available().filter(o=>o.status!=="delivered").sort((a,b)=>(a.pickups?.[0]?.time||"").localeCompare(b.pickups?.[0]?.time||""));
 $("view").innerHTML='<h2>Service en direct</h2><p class="muted">Ordre de sortie et boutons de progression. Les remises en plusieurs fois restent regroupées par commande.</p>';
 if(!list.length){$("view").innerHTML+='<div class="empty">Aucune commande active à préparer.</div>';return;}
 list.forEach(o=>$("view").appendChild(card(o)));
}
function groceriesView(){
 $("view").innerHTML='<h2>Épicerie automatique</h2><p class="muted">Liste regroupée à partir de la composition de tes pizzas. Les grammes ne sont pas inventés : ils seront calculés après validation des fiches recettes.</p>';
 const groups=window.RAFA_PIZZA_GROUPS||[];
 const recipe=new Map(groups.flatMap(g=>g[1].map(p=>[p[0],p[1]])));
 const usage=new Map(),ordersNow=available();
 for(const o of ordersNow)for(const item of o.items){
  const description=recipe.get(item.pizza)||"";
  const chunks=description.replace(/, et /g,", ").split(/,\s*|\s+et\s+/i).map(s=>s.trim()).filter(Boolean);
  for(const ingredient of chunks){const key=ingredient.toLowerCase();const r=usage.get(key)||{label:ingredient,pizzas:0};r.pizzas+=Number(item.qty)||0;usage.set(key,r)}
 }
 const arr=[...usage].sort((a,b)=>a[0].localeCompare(b[0],"fr")).map(([k,v])=>({key:k,...v}));
 const set=(()=>{try{return JSON.parse(localStorage.getItem("rafa-jeudis-grocery-"+focusDate)||"{}")}catch{return {}}})();
 if(!arr.length){$("view").innerHTML+='<div class="empty">L’épicerie s’affichera dès la première commande fictive.</div>';return;}
 arr.forEach(i=>{
  const row=document.createElement("div");row.className="checkrow";
  const label=document.createElement("label"),check=document.createElement("input");check.type="checkbox";check.checked=!!set[i.key];
  check.onchange=()=>{set[i.key]=check.checked;localStorage.setItem("rafa-jeudis-grocery-"+focusDate,JSON.stringify(set))};
  label.append(check,document.createTextNode(i.label));
  const note=document.createElement("span");note.className="muted";note.textContent=i.pizzas+" pizza(s) concernée(s)";
  row.append(label,note);$("view").appendChild(row);
 });
 const btn=document.createElement("button");btn.type="button";btn.className="button secondary";btn.textContent="Copier ma liste d'épicerie";
 btn.onclick=()=>navigator.clipboard.writeText(arr.map(i=>(set[i.key]?"☑ ":"☐ ")+i.label+" — "+i.pizzas+" pizza(s) concernée(s); quantité à préciser").join("\n")).then(()=>{btn.textContent="Liste copiée"}).catch(()=>alert("Copie non disponible dans ce navigateur"));
 $("view").appendChild(btn);
}
function reportView(){
 const oo=available(),units=new Map(),paid=oo.reduce((sum,o)=>sum+(o.paid?J.amount(o.items)*C.unitPrice:0),0);
 for(const o of oo)for(const i of o.items)units.set(i.pizza,(units.get(i.pizza)||0)+i.qty);
 const pairs=[...units].sort((a,b)=>b[1]-a[1]);
 $("view").innerHTML='<h2>Bilan fictif</h2><div class="summary-line"><span>Ventes réservées</span><strong>'+(total(oo)*C.unitPrice)+' $</strong></div><div class="summary-line"><span>Montant marqué payé</span><strong>'+paid+' $</strong></div><div class="summary-line"><span>Reste à recevoir</span><strong>'+(total(oo)*C.unitPrice-paid)+' $</strong></div><h3 class="section-spacer">Pizzas commandées</h3>';
 if(!pairs.length){$("view").innerHTML+='<p class="muted">Aucune donnée pour ce jeudi.</p>';return;}
 pairs.forEach(([name,q])=>$("view").innerHTML+='<div class="summary-line"><span>'+safe(name)+'</span><b>'+q+'</b></div>');
}
function render(){
 const oo=available(),qty=total(oo);
 $("targetDate").textContent="Jeudi de démonstration : "+J.formatDate(focusDate)+" · 3 pizzas / 20 min · plafond 30";
 $("statPizzas").textContent=qty+" / 30";$("statOrders").textContent=oo.length;$("statSales").textContent=(qty*C.unitPrice)+" $";
 for(const b of document.querySelectorAll("[data-view]")){b.classList.toggle("active",b.dataset.view===view);b.setAttribute("aria-selected",String(b.dataset.view===view))}
 ({orders:orderView,service:serviceView,groceries:groceriesView,report:reportView}[view])();
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{view=b.dataset.view;render()}));
$("clearDemo").onclick=()=>{if(confirm("Effacer toutes les commandes fictives enregistrées dans CE navigateur ?")){J.saveDemo([]);render()}};
window.addEventListener("storage",render);
render();
})();