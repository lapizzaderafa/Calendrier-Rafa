(function(){
"use strict";
const J=window.RafaJeudis,$=id=>document.getElementById(id),C=J.CONFIG;
let view="prep",focusDate=J.scheduleFor().target,showArchived=false;
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusLabels={pending:"À préparer",preparing:"En préparation",ready:"Prête",delivered:"Remise",cancelled:"Annulée"};
function all(){return J.loadDemo()}
function update(id,patch){const list=all(),i=list.findIndex(o=>o.id===id);if(i<0)return;list[i]={...list[i],...patch};J.saveDemo(list);render()}
function orders(){return all().filter(o=>o.date===focusDate);}
function removePermanently(order){
 const answer=prompt("Suppression définitive de la commande "+order.id+" ("+order.name+").\nCette opération est irréversible.\nPour confirmer, saisis exactement le numéro de commande : "+order.id);
 if(answer===null)return;
 if(answer.trim()!==order.id){alert("Numéro incorrect. Aucune commande supprimée.");return;}
 const list=all(),updated=list.filter(o=>o.id!==order.id);
 if(updated.length===list.length){alert("Cette commande n'existe plus.");render();return;}
 try{J.saveDemo(updated);if(window.rafaCurrentServiceId===order.id)window.rafaCurrentServiceId=null;render();}
 catch(e){alert("Échec de la suppression locale.")}
}
function available(){return J.activeOrders(orders(),focusDate);}
function total(oo){return oo.reduce((n,o)=>n+J.amount(o.items),0)}
function card(o){
 const el=document.createElement("article");el.className="order";
 const plans=(o.pickups||[]).map(p=>J.niceTime(p.time)+" ("+p.qty+")").join(" · ");
 el.innerHTML='<div class="order-top"><div><strong>'+safe(plans||"Aucun créneau")+'</strong><div class="muted">'+safe(o.name)+' · '+safe(o.id)+'</div></div><span class="pill">'+safe(statusLabels[o.status]||o.status)+'</span></div>'+
 '<div class="order-info">'+o.items.map(i=>safe(i.qty+" × "+i.pizza)).join("<br>")+'</div>'+
 '<div class="order-info"><strong>Contact client</strong><br>Tél. : '+safe(o.phone||"Non fourni")+'<br>Courriel : '+safe(o.email||"Non fourni")+'</div>'+
 '<div class="muted section-spacer">'+(J.amount(o.items)*C.unitPrice)+' $ · '+(o.payment==="cash"?"Comptant":"Interac")+' · '+(o.paid?"Payé":"Non payé")+' · '+(o.arrived?"Client arrivé":"Arrivée non signalée")+'</div>'+
 '<div class="order-actions"><button type="button" data-action="advance">Étape suivante</button><button type="button" data-action="arrival">'+(o.arrived?"Client non arrivé":"Client arrivé au stationnement arrière")+'</button><button type="button" data-action="paid">'+(o.paid?"Annuler payé":"Marquer payé")+'</button><button type="button" data-action="cancel">'+(o.status==="cancelled"?"Rétablir":"Annuler commande")+'</button><button type="button" data-action="delete" class="danger-action">Supprimer définitivement</button></div>';
 el.querySelector('[data-action="advance"]').disabled=["delivered","cancelled"].includes(o.status);
 el.querySelector('[data-action="advance"]').onclick=()=>{const next={pending:"preparing",preparing:"ready",ready:"delivered"}[o.status];if(next)update(o.id,{status:next})};
 el.querySelector('[data-action="arrival"]').onclick=()=>update(o.id,{arrived:!o.arrived});
 el.querySelector('[data-action="paid"]').onclick=()=>update(o.id,{paid:!o.paid});
 el.querySelector('[data-action="cancel"]').onclick=()=>{
  if(o.status==="delivered"){alert("Cette commande est déjà remise. Aucun retour en arrière automatique.");return}
  if(o.status==="cancelled"){
   const proposal=all().map(x=>x.id===o.id?{...x,status:"pending"}:x);
   const check=J.scheduleCheck(proposal,focusDate);
   if(!check.ok){alert("Impossible de rétablir la réservation : "+check.errors.join(" · "));return}
   J.saveDemo(proposal);render();return;
  }
  if(!confirm("Annuler cette commande fictive et libérer sa capacité ?"))return;
  update(o.id,{status:"cancelled",cancelledAt:new Date().toISOString()});
 };
 el.querySelector('[data-action="delete"]').onclick=()=>removePermanently(o);
 return el;
}
function orderView(){
 const list=orders().filter(o=>showArchived||!["cancelled","delivered"].includes(o.status)).sort((a,b)=>(a.pickups?.[0]?.time||"").localeCompare(b.pickups?.[0]?.time||""));
 $("view").innerHTML='<h2>Commandes</h2><p class="muted">Annuler libère les créneaux et retire les pizzas de l’épicerie. Supprimer efface définitivement la commande de cette démonstration. Les commandes terminées et annulées sont archivées.</p>';
 const toggle=document.createElement("label");toggle.className="checkrow";
 const box=document.createElement("input");box.type="checkbox";box.checked=showArchived;
 box.onchange=()=>{showArchived=box.checked;render()};
 toggle.append(box,document.createTextNode(" Afficher aussi les commandes annulées et terminées"));
 $("view").appendChild(toggle);
 if(!list.length){const empty=document.createElement("div");empty.className="empty";empty.textContent="Aucune commande dans cette vue."; $("view").appendChild(empty);return;}
 list.forEach(o=>$("view").appendChild(card(o)));
}
function prepView(){
 const data=available().sort((a,b)=>(a.pickups?.[0]?.time||"").localeCompare(b.pickups?.[0]?.time||""));
 const totalPizzas=total(data);
 $("view").innerHTML='<h2>Préparer mon jeudi</h2><p class="muted">Toutes les pizzas de la soirée, puis les commandes regroupées par heure. Le choix de l’ordre de cuisson reste entièrement libre.</p>';
 if(!data.length){$("view").innerHTML+='<div class="empty">Aucune commande fictive à préparer.</div>';return}
 const allByName=new Map();
 for(const o of data)for(const i of o.items)allByName.set(i.pizza,(allByName.get(i.pizza)||0)+Number(i.qty));
 const totals=document.createElement("div");totals.className="order";
 totals.innerHTML='<h3>À prévoir : '+totalPizzas+' pizzas</h3><p class="muted">'+totalPizzas+' pâtons et '+totalPizzas+' boîtes (1 boîte par pizza)</p>'+
 [...allByName].sort((a,b)=>b[1]-a[1]).map(([name,qty])=>'<div class="summary-line"><span>'+safe(name)+'</span><b>'+qty+' ×</b></div>').join("");
 $("view").appendChild(totals);
 const batches=new Map();
 for(const o of data){
  const parts=J.assignPizzas(o.items,o.pickups||[]);
  for(const part of parts){
   if(!batches.has(part.time))batches.set(part.time,[]);
   batches.get(part.time).push({name:o.name,id:o.id,part});
  }
 }
 for(const [at,entries] of [...batches].sort((a,b)=>a[0].localeCompare(b[0]))){
  const el=document.createElement("article");el.className="order";
  const count=entries.reduce((n,e)=>n+e.part.qty,0);
  el.innerHTML='<div class="order-top"><h3>'+safe(J.niceTime(at))+'</h3><span class="pill">'+count+' pizza(s)</span></div>'+
   entries.map(e=>'<p class="muted">'+safe(e.name)+' · '+safe(e.id)+'</p>'+
   e.part.pizzas.map(i=>'<div class="summary-line"><span>'+safe(i.pizza)+'</span><b>'+i.qty+' ×</b></div>').join("")).join("");
  $("view").appendChild(el);
 }
 const button=document.createElement("button");button.className="button";button.textContent="Passer en mode service";button.onclick=()=>{view="service";render()};$("view").appendChild(button);
}
function serviceView(){
 const area=$("view"),waiting=available().filter(o=>o.status!=="delivered").sort((a,b)=>(a.pickups?.[0]?.time||"").localeCompare(b.pickups?.[0]?.time||"")||String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
 area.innerHTML='<h2>Mode service</h2><p class="muted">Une seule commande à la fois. Tu choisis l’ordre de cuisson, puis tu cliques une fois que toutes les pizzas sont remises.</p>';
 if(!waiting.length){area.innerHTML+='<div class="success"><strong>Toutes les commandes sont terminées!</strong><br>Plus aucune remise en attente pour cette journée fictive.</div>';return}
 if(!window.rafaCurrentServiceId||!waiting.some(o=>o.id===window.rafaCurrentServiceId))window.rafaCurrentServiceId=waiting[0].id;
 const o=waiting.find(x=>x.id===window.rafaCurrentServiceId)||waiting[0];
 const card=document.createElement("article");card.className="order";
 card.innerHTML='<span class="kicker">Commande en cours</span><h2 style="font-size:34px;margin:10px 0">'+safe(J.niceTime(o.pickups[0].time))+'</h2>'+
  '<h3>'+safe(o.name)+' — '+J.amount(o.items)+' pizza(s)</h3>'+
  '<p class="muted">'+safe(o.phone||"")+' · '+safe(o.id)+'</p>'+
  o.items.map(i=>'<div class="summary-line"><span>'+safe(i.pizza)+'</span><strong>'+i.qty+' ×</strong></div>').join("")+
  '<p class="muted section-spacer">Paiement '+(o.payment==="cash"?"comptant":"Interac")+' · '+(o.paid?"reçu":"à vérifier")+'</p>'+
  ((o.pickups||[]).length>1?'<p class="alert">Attention : cette commande comporte plusieurs heures de remise dans le prototype. Marque-la terminée seulement lorsque toutes les pizzas ont été remises.</p>':'')+
  '<button class="button" id="finishCurrent" type="button">✓ Commande remise — suivante</button>'+
  '<button class="button secondary" id="paidCurrent" type="button">'+(o.paid?"Paiement reçu ✓":"Marquer payé")+'</button>';
 card.insertAdjacentHTML("beforeend",'<button class="button secondary" id="cancelCurrent" type="button">Annuler cette réservation</button>');
 area.appendChild(card);
 $("cancelCurrent").onclick=()=>{
  if(!confirm("Annuler la réservation de "+o.name+" et libérer ses places ?"))return;
  update(o.id,{status:"cancelled",cancelledAt:new Date().toISOString()});
  window.rafaCurrentServiceId=null;render();
 };
 $("finishCurrent").onclick=()=>{
  const list=all(),index=list.findIndex(x=>x.id===o.id);
  if(index<0)return;
  list[index]={...list[index],status:"delivered",completedAt:new Date().toISOString()};
  J.saveDemo(list);window.rafaCurrentServiceId=null;render();
 };
 $("paidCurrent").onclick=()=>update(o.id,{paid:!o.paid});
 const next=document.createElement("div");next.innerHTML='<h3 class="section-spacer">Prochaines commandes</h3>';
 for(const x of waiting.filter(x=>x.id!==o.id)){
  const b=document.createElement("button");b.type="button";b.className="button secondary";b.style.textAlign="left";
  b.textContent=J.niceTime(x.pickups[0].time)+" · "+x.name+" · "+J.amount(x.items)+" pizza(s)";
  b.onclick=()=>{window.rafaCurrentServiceId=x.id;render()};next.appendChild(b);
 }
 area.appendChild(next);
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
function settingsView(){
 const settings=J.loadSettings(focusDate),check=J.scheduleCheck(available(),focusDate);
 $("view").innerHTML='<h2>Réglages des nouvelles commandes</h2><p class="muted">La fermeture d’une heure ne supprime pas les commandes déjà acceptées. Ces réglages restent locaux à la démonstration.</p>';
 const label=document.createElement("label");label.className="checkrow";label.textContent="Suspendre les nouvelles commandes ";
 const pause=document.createElement("input");pause.type="checkbox";pause.checked=settings.paused;
 pause.onchange=()=>{J.saveSettings(focusDate,{...J.loadSettings(focusDate),paused:pause.checked});render()};
 label.prepend(pause);$("view").appendChild(label);
 const h=document.createElement("h3");h.className="section-spacer";h.textContent="Fermer un créneau pour de nouvelles commandes";$("view").appendChild(h);
 for(const slot of J.slots()){
  const row=document.createElement("label");row.className="checkrow";
  const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.checked=settings.closedSlots.includes(slot.key);
  checkbox.onchange=()=>{const current=J.loadSettings(focusDate),set=new Set(current.closedSlots);if(checkbox.checked)set.add(slot.key);else set.delete(slot.key);J.saveSettings(focusDate,{...current,closedSlots:[...set]});render()};
  row.append(checkbox,document.createTextNode(" "+slot.label));$("view").appendChild(row);
 }
 if(!check.ok){const warning=document.createElement("div");warning.className="error";warning.textContent=check.errors.join(" · ");$("view").appendChild(warning)}
}
function render(){
 const choices=[...new Set([J.scheduleFor().target,focusDate,...J.loadDemo().map(o=>o.date).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d))])].sort().reverse();
 $("adminDate").innerHTML=choices.map(d=>'<option value="'+d+'">'+safe(J.formatDate(d))+'</option>').join("");
 $("adminDate").value=focusDate;
 const oo=available(),qty=total(oo);
 $("targetDate").textContent="Jeudi de démonstration : "+J.formatDate(focusDate)+" · 3 pizzas / 20 min · plafond 30";
 $("statPizzas").textContent=qty+" / 30";$("statOrders").textContent=oo.length;$("statSales").textContent=(qty*C.unitPrice)+" $";
 for(const b of document.querySelectorAll("[data-view]")){b.classList.toggle("active",b.dataset.view===view);b.setAttribute("aria-selected",String(b.dataset.view===view))}
 ({prep:prepView,orders:orderView,service:serviceView,groceries:groceriesView,report:reportView,settings:settingsView}[view])();
}
$("adminDate").onchange=e=>{focusDate=e.target.value;window.rafaCurrentServiceId=null;render()};
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{view=b.dataset.view;window.rafaCurrentServiceId=null;render()}));
$("clearDemo").onclick=()=>{if(confirm("Effacer toutes les commandes fictives enregistrées dans CE navigateur ?")){J.saveDemo([]);render()}};
window.addEventListener("storage",render);
render();
})();