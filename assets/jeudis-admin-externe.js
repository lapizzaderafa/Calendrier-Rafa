/* Les Jeudis Rafa — administration de TEST, Supabase seulement.
   Aucune réservation stockée dans le navigateur. */
(function(){
"use strict";
const J=window.RafaJeudis,API=window.RafaJeudisApi,$=id=>document.getElementById(id);
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const plan=J.scheduleFor(),today=plan.today;
let date=J.weekday(today)===4?today:plan.target;
let view="prep",orders=[],settings=null,currentId=null,showArchived=false,busy=false,isAuthenticated=false;
const current=()=>orders.filter(o=>o.status!=="cancelled");
const pending=()=>current().filter(o=>o.status!=="delivered").sort(compare);
const compare=(a,b)=>String(a.pickups?.[0]?.time||"").localeCompare(b.pickups?.[0]?.time||"")||
 String(a.created_at||"").localeCompare(String(b.created_at||""));
const count=o=>Number(o.pizza_qty)||0;
const sum=rows=>rows.reduce((a,b)=>a+count(b),0);
const cost=o=>Number(o.total_cents||0)/100;
const times=o=>(o.pickups||[]).map(p=>J.niceTime(p.time)).join(" / ");
const pizzaRows=o=>(o.items||[]).map(i=>'<div class="summary-line"><span>'+safe(i.pizza)+'</span><b>'+Number(i.qty)+' ×</b></div>').join("");
function setBusy(yes){busy=yes}
function showError(err){$("view").innerHTML='<div class="error">'+safe(err.message||err)+'</div>'}
async function reload(){
 if(busy||!isAuthenticated)return;
 try{
  orders=await API.adminOrders(date);
  settings=await API.adminSettings(date);
  render();
 }catch(e){showError(e)}
}
async function action(order,kind,ask=true){
 if(busy)return;
 const id=order.id;
 if(ask){
  if(kind==="delete"){
   const typed=prompt("Effacer DÉFINITIVEMENT la commande de "+order.customer_name+
    " ("+id+") ?\n"+(order.paid?"Attention : commande payée; vérifier le remboursement.\n":"")+
    "Cette action est irréversible.\nSaisis son identifiant exact pour confirmer :", "");
   if(typed===null||typed.trim()!==id){if(typed!==null)alert("Identifiant incorrect. Aucun changement.");return}
  }else if(kind==="cancel"){
   if(!confirm("Annuler la réservation de "+order.customer_name+" et libérer son créneau ?"+
     (order.paid?"\nAttention : commande déjà payée, remboursement manuel à vérifier.":"")))return;
  }else if(kind==="restore"){
   if(!confirm("Rétablir cette commande ? Le serveur vérifiera sa capacité."))return;
  }
 }
 setBusy(true);
 try{await API.adminAction(id,kind);orders=await API.adminOrders(date);currentId=null;render()}
 catch(e){alert("Modification refusée : "+e.message)}
 finally{setBusy(false)}
}
function prepView(){
 const area=$("view"),list=current().sort(compare),summary=new Map();
 area.innerHTML='<h2>Préparer mon jeudi</h2><p class="muted">Tout ce que tu dois préparer, groupé par heure. Tu détermines toi-même l’ordre de cuisson.</p>';
 if(!list.length){area.innerHTML+='<div class="empty">Aucune commande pour ce jeudi.</div>';return}
 for(const o of list)for(const p of o.items||[])summary.set(p.pizza,(summary.get(p.pizza)||0)+Number(p.qty));
 const total=document.createElement("div");total.className="order";
 total.innerHTML='<h3>'+sum(list)+' pizzas · '+list.length+' commandes</h3><p class="muted">'+sum(list)+' pâtons et '+sum(list)+' boîtes à préparer</p>'+
 [...summary].sort((a,b)=>b[1]-a[1]).map(([name,n])=>'<div class="summary-line"><span>'+safe(name)+'</span><b>'+n+' ×</b></div>').join("");
 area.appendChild(total);
 for(const t of J.slots()){
  const arrivals=list.filter(o=>o.pickups?.some(p=>p.time===t.key));if(!arrivals.length)continue;
  const b=document.createElement("article");b.className="order";
  b.innerHTML='<h3>'+safe(t.label)+' · '+arrivals.reduce((n,o)=>n+count(o),0)+' pizzas</h3>'+
   arrivals.map(o=>'<p class="muted">'+safe(o.customer_name)+' · '+safe(o.id)+'</p>'+pizzaRows(o)).join("");
  area.appendChild(b);
 }
 const button=document.createElement("button");button.className="button";button.textContent="Ouvrir le mode service";
 button.onclick=()=>{view="service";currentId=null;render()};area.appendChild(button);
}
function serviceView(){
 const area=$("view"),queue=pending();
 area.innerHTML='<h2>Mode service</h2><p class="muted">Une commande affichée à la fois. Une fois les pizzas remises, clique sur le bouton pour passer automatiquement à la suivante.</p>';
 if(!queue.length){area.innerHTML+='<div class="success">Toutes les commandes sont remises!</div>';return}
 if(!queue.some(o=>o.id===currentId))currentId=queue[0].id;
 const o=queue.find(x=>x.id===currentId)||queue[0];
 const card=document.createElement("article");card.className="order";
 card.innerHTML='<span class="kicker">Commande en cours</span><h2 style="font-size:35px;margin:12px 0">'+safe(times(o))+'</h2>'+
 '<h3>'+safe(o.customer_name)+' · '+count(o)+' pizza(s)</h3>'+
 '<p class="muted">'+safe(o.customer_phone)+' · '+safe(o.id)+'</p>'+
 pizzaRows(o)+
 '<p class="muted section-spacer">'+(o.payment_method==="cash"?"Comptant":"Interac")+' · '+(o.paid?"Payé":"Paiement à vérifier")+'</p>'+
 '<button class="button" type="button" id="complete">✓ Commande remise — suivante</button>'+
 '<button class="button secondary" type="button" id="markPaid">'+(o.paid?"Marquer impayé":"Marquer payé")+'</button>'+
 '<button class="button secondary" type="button" id="cancel">Annuler cette réservation</button>';
 area.appendChild(card);
 $("complete").onclick=()=>action(o,"delivered",false);
 $("markPaid").onclick=()=>action(o,o.paid?"unpaid":"paid",false);
 $("cancel").onclick=()=>action(o,"cancel");
 if(queue.length>1){
  const next=document.createElement("div");next.innerHTML='<h3 class="section-spacer">Prochaines commandes</h3>';
  for(const item of queue.filter(i=>i.id!==o.id)){
   const b=document.createElement("button");b.className="button secondary";b.type="button";b.style.textAlign="left";
   b.textContent=times(item)+" · "+item.customer_name+" · "+count(item)+" pizza(s)";
   b.onclick=()=>{currentId=item.id;render()};next.appendChild(b);
  }area.appendChild(next);
 }
}
function orderView(){
 const area=$("view");
 area.innerHTML='<h2>Commandes et historique</h2><p class="muted">Annuler conserve une trace; supprimer définitivement efface la commande de la base de test. Tu peux restaurer une annulation si le créneau est encore libre.</p>';
 const toggle=document.createElement("label");toggle.className="checkrow";
 const check=document.createElement("input");check.type="checkbox";check.checked=showArchived;
 check.onchange=()=>{showArchived=check.checked;render()};
 toggle.append(check,document.createTextNode(" Afficher aussi les commandes annulées et terminées"));area.appendChild(toggle);
 const list=orders.filter(o=>showArchived||!["cancelled","delivered"].includes(o.status)).sort(compare);
 if(!list.length){area.innerHTML+='<div class="empty">Aucune commande à afficher.</div>';return}
 for(const o of list){
  const block=document.createElement("article");block.className="order";
  block.innerHTML='<div class="order-top"><strong>'+safe(times(o))+' · '+safe(o.customer_name)+'</strong>'+
   '<span class="pill">'+safe(o.status==="cancelled"?"Annulée":o.status==="delivered"?"Remise":o.status==="ready"?"Prête":"À préparer")+'</span></div>'+
   '<p class="muted">'+safe(o.id)+' · '+safe(o.customer_phone)+' · '+safe(o.customer_email)+'</p>'+
   pizzaRows(o)+
   '<div class="muted section-spacer">'+cost(o)+' $ · '+(o.paid?"Payé":"Non payé")+'</div>'+
   '<div class="order-actions"><button data-k="open" type="button">Ouvrir</button>'+
   '<button data-k="paid" type="button">'+(o.paid?"Marquer impayé":"Marquer payé")+'</button>'+
   '<button data-k="cancel" type="button">'+(o.status==="cancelled"?"Rétablir":"Annuler")+'</button>'+
   '<button data-k="delete" class="danger-action" type="button">Supprimer définitivement</button></div>';
  block.querySelector('[data-k="open"]').disabled=["cancelled","delivered"].includes(o.status);
  block.querySelector('[data-k="open"]').onclick=()=>{view="service";currentId=o.id;render()};
  block.querySelector('[data-k="paid"]').onclick=()=>action(o,o.paid?"unpaid":"paid",false);
  block.querySelector('[data-k="cancel"]').disabled=o.status==="delivered";
  block.querySelector('[data-k="cancel"]').onclick=()=>action(o,o.status==="cancelled"?"restore":"cancel");
  block.querySelector('[data-k="delete"]').onclick=()=>action(o,"delete");
  area.appendChild(block);
 }
}
function groceriesView(){
 const area=$("view"),source=new Map((window.RAFA_PIZZA_GROUPS||[]).flatMap(g=>g[1].map(p=>[p[0],p[1]])));
 const usage=new Map();
 area.innerHTML='<h2>Liste d’épicerie</h2><p class="muted">Mise à jour après les nouvelles commandes et les annulations. Les quantités en grammes ne seront calculées qu’après validation des fiches recettes.</p>';
 const list=current(),qty=sum(list);
 if(!qty){area.innerHTML+='<div class="empty">Aucune pizza à préparer pour ce jeudi.</div>';return}
 const rows=[{name:"Pâtons",qty,unit:"unités"},{name:"Boîtes à pizza",qty,unit:"unités"}];
 for(const o of list)for(const i of o.items||[]){
  const ingredients=(source.get(i.pizza)||"").replace(/, et /gi,", ").split(/,\s*|\s+et\s+/i).map(s=>s.trim()).filter(Boolean);
  for(const value of ingredients){
   const key=value.toLocaleLowerCase("fr-CA");
   const x=usage.get(key)||{name:value,qty:0};x.qty+=Number(i.qty);usage.set(key,x);
  }
 }
 for(const [,x] of [...usage].sort((a,b)=>a[0].localeCompare(b[0],"fr")))rows.push({name:x.name,qty:x.qty,unit:"pizza(s) concernée(s)"});
 for(const r of rows){const div=document.createElement("div");div.className="checkrow";
  div.innerHTML='<strong>'+safe(r.name)+'</strong><span class="muted">'+r.qty+' '+r.unit+'</span>';area.appendChild(div)}
 const copy=document.createElement("button");copy.className="button secondary";copy.textContent="Copier la liste";
 copy.onclick=()=>navigator.clipboard?.writeText(rows.map(r=>r.name+" — "+r.qty+" "+r.unit).join("\n")).then(()=>{copy.textContent="Liste copiée"}).catch(()=>alert("Copie indisponible"));
 area.appendChild(copy);
}
function reportView(){
 const list=current(),area=$("view"),paid=list.reduce((n,o)=>n+(o.paid?cost(o):0),0);
 area.innerHTML='<h2>Bilan test</h2>'+
 '<div class="summary-line"><span>Pizzas réservées</span><strong>'+sum(list)+'</strong></div>'+
 '<div class="summary-line"><span>Ventes prévues</span><strong>'+list.reduce((n,o)=>n+cost(o),0)+' $</strong></div>'+
 '<div class="summary-line"><span>Marqué payé</span><strong>'+paid+' $</strong></div>'+
 '<div class="summary-line"><span>Commandes remises</span><strong>'+list.filter(o=>o.status==="delivered").length+'</strong></div>';
}
function settingsView(){
 const s=settings||{paused:false,closed_slots:[],pickup_address:"",pickup_instructions:""},area=$("view");
 area.innerHTML='<h2>Réglages du jeudi</h2><p class="muted">Ici, tu peux suspendre les nouvelles commandes et saisir l’adresse affichée aux clients APRÈS leur confirmation.</p>'+
 '<label class="field">Adresse de cueillette <input id="pickupAddress" maxlength="240"></label>'+
 '<label class="field">Instructions de stationnement <textarea id="pickupInstructions" rows="3" maxlength="750"></textarea></label>'+
 '<label class="checkrow"><span>Suspendre les nouvelles commandes</span><input type="checkbox" id="paused"></label>'+
 '<h3 class="section-spacer">Bloquer des heures pour les nouvelles commandes</h3>';
 $("pickupAddress").value=s.pickup_address||"";
 $("pickupInstructions").value=s.pickup_instructions||"";
 $("paused").checked=!!s.paused;
 for(const slot of J.slots()){
  const label=document.createElement("label");label.className="checkrow";label.textContent=slot.label;
  const cb=document.createElement("input");cb.type="checkbox";cb.value=slot.key;cb.dataset.closed="1";
  cb.checked=(s.closed_slots||[]).includes(slot.key);
  label.appendChild(cb);area.appendChild(label);
 }
 const btn=document.createElement("button");btn.className="button";btn.type="button";btn.textContent="Enregistrer les réglages de ce jeudi";
 btn.onclick=async()=>{
  if(busy)return;
  setBusy(true);btn.disabled=true;
  try{
   const payload={
    paused:$("paused").checked,
    closedSlots:[...document.querySelectorAll("[data-closed]:checked")].map(x=>x.value),
    pickupAddress:$("pickupAddress").value.trim(),
    pickupInstructions:$("pickupInstructions").value.trim()
   };
   await API.adminSaveSettings(date,payload);settings=await API.adminSettings(date);
   alert("Réglages enregistrés sur le serveur de test.");
  }catch(e){alert("Impossible d'enregistrer : "+e.message)}
  finally{setBusy(false);btn.disabled=false}
 };area.appendChild(btn);
}
function render(){
 if(!isAuthenticated)return;
 $("adminDate").value=date;
 const list=current(),qty=sum(list);
 $("targetDate").textContent=J.formatDate(date)+" · base de test partagée entre appareils";
 $("statPizzas").textContent=qty+" / 25";
 $("statOrders").textContent=list.length;
 $("statSales").textContent=list.reduce((n,o)=>n+cost(o),0)+" $";
 for(const b of document.querySelectorAll("[data-view]")){
  b.classList.toggle("active",b.dataset.view===view);
  b.setAttribute("aria-selected",String(b.dataset.view===view));
 }
 ({prep:prepView,service:serviceView,orders:orderView,groceries:groceriesView,report:reportView,settings:settingsView}[view])();
}
$("adminDate").onchange=e=>{date=e.target.value;currentId=null;reload()};
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{if(!isAuthenticated)return;view=b.dataset.view;currentId=null;render()});
function showLogin(message){
 $("view").innerHTML='<section class="order"><span class="kicker">Administration Rafa — TEST</span>'+
  '<h2>Connexion de test</h2><p class="muted">Cette base est différente de ton vrai site. Crée un nouveau mot de passe réservé à cet environnement.</p>'+
  '<p class="muted"><strong>Compte :</strong> raphael.frenette@gmail.com</p>'+
  '<label class="field">Mot de passe de test <input type="password" id="testPass" minlength="8" autocomplete="current-password" placeholder="Au moins 8 caractères"></label>'+
  '<button class="button" type="button" id="testLogin">Me connecter</button>'+
  '<button class="button secondary" type="button" id="testRegister">Créer mon accès de test (une seule fois)</button>'+
  '<div id="loginFeedback" class="muted section-spacer" aria-live="polite">'+safe(message||"")+'</div></section>';
 const pass=$("testPass");
 function say(msg){$("loginFeedback").textContent=msg}
 $("testLogin").onclick=async()=>{
  if(!pass.value){say("Entre ton mot de passe de test.");return}
  say("Connexion...");
  try{await API.loginAdmin(pass.value);await init()}catch(e){say("Connexion refusée : "+e.message)}
 };
 $("testRegister").onclick=async()=>{
  if(pass.value.length<8){say("Choisis au moins huit caractères.");return}
  say("Création du compte de test...");
  try{
   const data=await API.createAdminAccess(pass.value);
   if(data?.session){await init();return}
   say("Compte créé. Vérifie ta boîte courriel pour confirmer ton adresse, puis reviens ici pour te connecter avec le même mot de passe.");
  }catch(e){say("Création impossible : "+e.message)}
 };
}
async function init(){
 $("view").innerHTML='<p class="muted">Connexion au serveur Supabase de test...</p>';
 try{
  const user=await API.currentUser();
  if((user.email||"").toLowerCase()!=="raphael.frenette@gmail.com")throw Error("Accès administrateur réservé à Rafa.");
  isAuthenticated=true;
  await reload();
 }catch(e){isAuthenticated=false;showLogin(e.message)}
}
setInterval(()=>{if(!document.hidden&&!busy&&view!=="settings")reload()},20000);
init();
})();