/* Les Jeudis Rafa — essai inter-appareils, Supabase test uniquement. */
(function(){
"use strict";
const J=window.RafaJeudis,API=window.RafaJeudisApi,$=id=>document.getElementById(id);
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cart=new Map();
let date=J.scheduleFor().target,plan=J.scheduleFor(),desired=1,selected=null;
let menu=[],available=[],fetching=false,sending=false,finished=false,requestId=null;
const count=()=>[...cart.values()].reduce((n,v)=>n+v,0);
const items=()=>[...cart].filter(([,n])=>n>0).map(([pizza,qty])=>({pizza,qty}));
const checkSlot=slot=>!!slot&&plan.open&&!slot.blocked&&Number(slot.pizzas_left)>=desired&&Number(slot.cars_used)<2&&Number(slot.day_left)>=desired;
function errorText(message){$("notice").innerHTML='<div class="error">'+safe(message)+'</div>'}
function renderMenu(){
 const target=$("jeudisPizzaChoices")||$("pizzas");target.innerHTML="";
 for(const p of menu){
  const div=document.createElement("div");div.className="pizza";
  div.innerHTML='<div><strong>'+safe(p.pizza)+'</strong></div><small>'+safe(p.description)+'</small><div class="counter">'+
   '<button type="button" class="stepper" data-dir="-1" aria-label="Retirer">−</button>'+
   '<span class="qty">0</span><button type="button" class="stepper" data-dir="1" aria-label="Ajouter">+</button></div>';
  div.querySelectorAll("[data-dir]").forEach(b=>b.onclick=()=>{
   const d=Number(b.dataset.dir);if(d>0&&count()>=desired)return;
   const n=Math.max(0,(cart.get(p.pizza)||0)+d);
   if(n)cart.set(p.pizza,n);else cart.delete(p.pizza);
   render();
  });
  target.appendChild(div);
 }
}
function render(){
 if(finished)return;
 $("targetTitle").textContent=J.formatDate(date);
 $("deadline").textContent="De 17 h à 21 h · Vous avez jusqu'au mercredi "+
 J.formatDate(J.plusDays(date,-1)).replace(/^mercredi /,"")+" à 12 h pour commander.";
 $("desiredQty").textContent=desired;
 $("desiredMinus").disabled=desired<=1||sending;
 $("desiredPlus").disabled=desired>=Math.min(J.CONFIG.dailyCapacity,Number(available[0]?.day_left??J.CONFIG.dailyCapacity))||sending;
 const remaining=available.length?Math.max(0,Number(available[0]?.day_left)):J.CONFIG.dailyCapacity;
 $("remainingPizzas").textContent=remaining===0?"Complet pour ce jeudi — les nouvelles commandes sont fermées.":remaining+" pizza(s) encore disponibles pour ce jeudi (25 maximum).";
 $("chosenProgress").textContent=count()===desired
  ?"Toutes tes pizzas sont choisies.":"Choisis encore "+(desired-count())+" pizza(s).";
 document.querySelectorAll(".pizza").forEach((d,i)=>{
  d.querySelector(".qty").textContent=cart.get(menu[i].pizza)||0;
  d.querySelector('[data-dir="1"]').disabled=sending||count()>=desired;
  d.querySelector('[data-dir="-1"]').disabled=sending||!(cart.get(menu[i].pizza)||0);
 });
 $("cart").innerHTML=items().map(x=>'<div class="summary-line"><span>'+safe(x.pizza)+' × '+x.qty+'</span><strong>'+(x.qty*27)+' $</strong></div>').join("")||'<p class="muted">Choisis les recettes souhaitées.</p>';
 $("total").textContent=desired*27+" $";
 $("closedMessage").classList.toggle("hidden",plan.open);
 $("closedMessage").textContent="Commandes fermées depuis mercredi midi. La prochaine vente ouvre jeudi.";
 $("orderForm").classList.toggle("hidden",!plan.open);
 const current=available.find(r=>r.pickup_time===selected);
 if(!checkSlot(current))selected=null;
 $("hours").innerHTML="";
 for(const slot of available){
  const btn=document.createElement("button");btn.type="button";btn.className="slot"+(slot.pickup_time===selected?" selected":"");
  btn.disabled=sending||!checkSlot(slot);btn.setAttribute("aria-pressed",String(slot.pickup_time===selected));
  btn.innerHTML=safe(J.niceTime(slot.pickup_time))+"<span>"+(btn.disabled?"Indisponible":"Disponible")+"</span>";
  btn.onclick=()=>{selected=slot.pickup_time;render()};
  $("hours").appendChild(btn);
 }
 $("selectedHours").textContent=selected
  ?(desired>6?"Pour cette grande commande, la plage réservée commence le ":"Cueillette prévue le ")+J.formatDate(date)+" à "+J.niceTime(selected)+(desired>6?". Rafa confirmera le déroulement de la remise.":".")
  :fetching?"Chargement des heures disponibles...":"Choisis une heure de cueillette pour "+desired+" pizza(s).";
 const yes=plan.open&&selected&&count()===desired&&!sending&&menu.length;
 $("confirmBtn").disabled=!yes;
 $("confirmBtn").textContent=sending?"Confirmation en cours...":
  selected?"Confirmer pour le "+J.formatDate(date)+" à "+J.niceTime(selected):"Choisis ton heure";
}
async function refresh(){
 if(finished)return;
 fetching=true;render();
 try{
  available=await API.availability(date);
  if(!Array.isArray(available))throw Error("Réponse du calendrier invalide.");
  $("notice").innerHTML="";
 }catch(e){available=[];errorText("Impossible de charger le calendrier du serveur de test : "+e.message)}
 finally{fetching=false;render()}
}
function showConfirmation(info,id){
 finished=true;$("orderForm").classList.add("hidden");
 const a=info?.pickup_address||"Adresse à configurer dans le back-office de test";
 const instructions=info?.pickup_instructions||"Stationne-toi à l'arrière et reste dans ton auto. Rafa viendra te remettre les pizzas chaudes.";
 const hour=info?.pickups?.[0]?.time||selected;
 const dateValue=info?.pickup_date||date;
 $("notice").innerHTML='<div class="success"><span class="kicker">Confirmation de test</span>'+
 '<h3>Réservation enregistrée — '+safe(id)+'</h3>'+
 '<p><strong>'+safe(J.formatDate(dateValue))+' à '+safe(J.niceTime(hour))+'</strong></p>'+
 '<p>'+safe(count())+' pizza(s) · '+(count()*27)+' $</p>'+
 '<h3>Service au volant à Cap-Rouge</h3>'+
 '<p><strong>Adresse :</strong> '+safe(a)+'</p><p>'+safe(instructions)+'</p>'+
 '<p>Environnement de test : aucun paiement débité et aucun courriel envoyé. Tu peux retrouver cette commande dans le back-office de test.</p></div>';
}
$("desiredMinus").onclick=()=>{
 if(desired<=1||sending)return;desired--;
 while(count()>desired){const last=[...cart.keys()].at(-1),n=cart.get(last)-1;if(n)cart.set(last,n);else cart.delete(last)}
 selected=null;render();
};
$("desiredPlus").onclick=()=>{const left=available.length?Number(available[0].day_left):J.CONFIG.dailyCapacity;if(desired<Math.min(J.CONFIG.dailyCapacity,left)&&!sending){desired++;selected=null;render()}};
$("orderForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(sending||finished||!selected||count()!==desired)return;
 const current=J.scheduleFor();
 if(!current.open||current.target!==date){errorText("Le calendrier a changé. Actualise la page.");return}
 const slot=available.find(r=>r.pickup_time===selected);
 if(!checkSlot(slot)){errorText("Cette heure n'est plus disponible, choisis une autre heure.");await refresh();return}
 const name=$("customerName").value.trim(),email=$("customerEmail").value.trim(),phone=$("customerPhone").value.trim(),pay=$("payment").value;
 if(name.length<2||email.length<5||phone.length<7||!$("contactConsent").checked){errorText("Vérifie les coordonnées avant de confirmer.");return}
 sending=true;render();
 try{
  if(!requestId)requestId=API.uuid();
  const result=await API.reserve({date,pickups:[{time:selected,qty:desired}],items:items(),name,email,phone,payment:pay,requestId});
  let receipt=null;
  try{receipt=await API.confirmation(requestId)}catch{}
  showConfirmation(receipt,result.orderId);
 }catch(e){
  let receipt=null;
  try{if(requestId)receipt=await API.confirmation(requestId)}catch{}
  if(receipt)showConfirmation(receipt,receipt.order_id);
  else{errorText("Commande non confirmée : "+e.message+". Si la connexion a été interrompue, réessaie sans modifier ton panier.");await refresh()}
 }finally{sending=false;render()}
});
async function init(){
 $("notice").innerHTML='<p class="muted">Connexion au serveur de test...</p>';
 try{
  menu=await API.menu();
  if(!menu.length)throw Error("Aucune pizza n'est encore activée sur la carte de test.");
  renderMenu();await refresh();
 }catch(e){errorText("Test non disponible : "+e.message);render()}
}
setInterval(()=>{if(finished)return;const p=J.scheduleFor();if(p.target!==date||p.open!==plan.open){
 plan=p;date=p.target;selected=null;requestId=null;refresh();
 }},30000);
setInterval(()=>{if(!sending&&!document.hidden&&plan.open&&!finished)refresh()},20000);
render();init();
})();