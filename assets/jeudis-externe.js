/* Les Jeudis Rafa — essai inter-appareils, Supabase test uniquement. */
(function(){
"use strict";
const J=window.RafaJeudis,API=window.RafaJeudisApi,$=id=>document.getElementById(id);
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const introButton=$("jeudisOpenOrder");
const orderFlow=$("jeudisOrderFlow");
function revealOrder(scrollIntoView=false){
 if(!orderFlow||!introButton)return;
 if(orderFlow.hidden){
  orderFlow.hidden=false;
  introButton.setAttribute("aria-expanded","true");
  introButton.hidden=true;
  $("jeudis-rafa")?.classList.add("rj-open");
 }
 if(scrollIntoView){
  window.requestAnimationFrame(()=>{
   $("jeudis-commande")?.scrollIntoView({
    behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",
    block:"start"
   });
  });
 }
}
if(introButton&&orderFlow){
 introButton.addEventListener("click",()=>revealOrder(true));
 // Ouvrir le formulaire avant le script de navigation du site principal.
 document.addEventListener("click",event=>{
  const a=event.target instanceof Element?event.target.closest('a[href="#jeudis-commande"]'):null;
  if(a)revealOrder(false);
 },true);
 // Lien direct, rechargement et navigation arrière.
 if(location.hash==="#jeudis-commande")revealOrder(false);
 window.addEventListener("hashchange",()=>{
  if(location.hash==="#jeudis-commande")revealOrder(false);
 });
 window.addEventListener("popstate",()=>{
  if(location.hash==="#jeudis-commande")revealOrder(false);
 });
}
const cart=new Map();
let date=J.scheduleFor().target,plan=J.scheduleFor(),selected=null;
let menu=[],available=[],fetching=false,sending=false,finished=false,requestId=null;
const count=()=>[...cart.values()].reduce((n,v)=>n+v,0);
const items=()=>[...cart].filter(([,n])=>n>0).map(([pizza,qty])=>({pizza,qty}));
const dayLimit=()=>Math.max(0,Math.min(J.CONFIG.dailyCapacity,Number(available[0]?.day_left??0)));
const checkSlot=slot=>{
 const qty=count();
 return qty>0&&qty<=dayLimit()&&!!slot&&plan.open&&!slot.blocked
  &&Number(slot.pizzas_left)>=qty&&Number(slot.cars_used)<2
  &&Number(slot.day_left)>=qty;
};
function errorText(message){$("notice").innerHTML='<div class="error">'+safe(message)+'</div>'}
function renderMenu(){
 const target=$("jeudisPizzaChoices")||$("pizzas");target.innerHTML="";
 for(const p of menu){
  const div=document.createElement("div");div.className="pizza"+(p.is_weekly?" rj-weekly":"");
  div.innerHTML='<div>'+(p.is_weekly?'<span class="rj-weekly-tag">Pizza de la semaine</span>':'')+
    '<strong>'+safe(p.pizza)+'</strong></div><small>'+safe(p.description)+'</small><div class="counter">'+
   '<button type="button" class="stepper" data-dir="-1" aria-label="Retirer">−</button>'+
   '<span class="qty">0</span><button type="button" class="stepper" data-dir="1" aria-label="Ajouter">+</button></div>';
  div.querySelectorAll("[data-dir]").forEach(b=>b.onclick=()=>{
   const d=Number(b.dataset.dir);if(sending||finished||(d>0&&count()>=dayLimit()))return;
   const n=Math.max(0,(cart.get(p.pizza)||0)+d);
   if(n)cart.set(p.pizza,n);else cart.delete(p.pizza);
   requestId=null;
   $("notice").innerHTML="";
   render();
  });
  target.appendChild(div);
 }
}
function render(){
 if(finished)return;
 $("targetTitle").textContent=J.formatDate(date);
 $("deadline").textContent="17 h à 21 h · Commande avant mercredi midi.";
 const qty=count();
 const remaining=available.length?Math.max(0,Number(available[0]?.day_left)):J.CONFIG.dailyCapacity;
 $("remainingPizzas").textContent=remaining===0?"Complet pour ce jeudi — les nouvelles commandes sont fermées.":"";
 document.querySelectorAll(".pizza").forEach((d,i)=>{
  const n=cart.get(menu[i].pizza)||0;
  d.classList.toggle("is-empty",n===0);
  d.querySelector(".qty").textContent=n;
  d.querySelector('[data-dir="1"]').disabled=sending||finished||qty>=dayLimit();
  d.querySelector('[data-dir="-1"]').disabled=sending||finished||!(cart.get(menu[i].pizza)||0);
 });
 const pricing=J.priceFor(qty,date);
 $("launchOffer").hidden=!pricing.promoActive;
 $("cart").innerHTML=items().map(x=>'<div class="summary-line"><span>'+safe(x.pizza)+' × '+x.qty+'</span><strong>'+(x.qty*J.CONFIG.unitPrice)+' $</strong></div>').join("")+
   (pricing.savings?'<div class="summary-line rj-discount"><span>4e pizza offerte</span><strong>−'+pricing.savings+' $</strong></div>':"");
 $("total").innerHTML=pricing.savings
  ? '<del class="rj-previous">'+pricing.regular+' $</del> '+pricing.total+' $'
  : pricing.total+" $";
 const nudge=$("bundleNudge"),nudgeText=$("bundleText");
 const hasBundleCapacity=dayLimit()>=J.CONFIG.promoQty&&available.some(s=>!s.blocked&&Number(s.pizzas_left)>=J.CONFIG.promoQty&&Number(s.cars_used)<2);
 const shouldNudge=pricing.promoActive&&qty>0&&plan.open&&(qty>=J.CONFIG.promoQty||hasBundleCapacity);
 nudge.hidden=!shouldNudge;
 if(shouldNudge){
  $("bundleProgress").innerHTML=Array.from({length:J.CONFIG.promoQty},(_,i)=>'<i class="'+(i<Math.min(qty,J.CONFIG.promoQty)?"filled":"")+'"></i>').join("");
  nudgeText.textContent=pricing.savings
   ? "La 4e pizza est gratuite"
   : "Encore "+(J.CONFIG.promoQty-qty)+" pizza"+(J.CONFIG.promoQty-qty>1?"s":"")+" pour en avoir une gratuite";
 }else{
  $("bundleProgress").innerHTML="";
  nudgeText.textContent="";
 }
 $("closedMessage").classList.toggle("hidden",plan.open);
 $("closedMessage").textContent="Commandes fermées depuis mercredi midi. La prochaine vente ouvre jeudi.";
 $("orderForm").classList.toggle("hidden",!plan.open);
 const current=available.find(r=>r.pickup_time===selected);
 if(!checkSlot(current))selected=null;
 $("rjTimeStep").hidden=qty===0||!plan.open;
 $("rjDetailsStep").hidden=!selected||!plan.open;
 $("hours").innerHTML="";
 $("hours").hidden=qty===0;
 for(const slot of qty>0?available.filter(checkSlot):[]){
  const btn=document.createElement("button");btn.type="button";btn.className="slot"+(slot.pickup_time===selected?" selected":"");
  btn.disabled=sending;
  btn.setAttribute("aria-pressed",String(slot.pickup_time===selected));
  btn.setAttribute("aria-label","Choisir "+J.niceTime(slot.pickup_time)+" pour "+qty+" pizzas");
  btn.textContent=J.niceTime(slot.pickup_time);
  btn.onclick=()=>{selected=slot.pickup_time;render()};
  $("hours").appendChild(btn);
 }
 $("selectedHours").textContent=qty===0?""
  :selected
   ?(qty>3
     ?"Créneau choisi : "+J.niceTime(selected)+". Rafa confirmera l'heure exacte de cueillette."
     :"Créneau choisi : "+J.niceTime(selected)+".")
   :fetching?"Chargement des heures..."
   :available.some(checkSlot)?""
   :"Plus d'heures disponibles pour cette quantité. Essaie avec moins de pizzas.";
 const yes=plan.open&&!!selected&&qty>0&&checkSlot(available.find(r=>r.pickup_time===selected))&&!sending&&menu.length;
 $("confirmBtn").disabled=!yes;
 $("confirmBtn").textContent=sending?"Confirmation en cours...":
  selected?"Confirmer ma commande":"Choisis ton heure";
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
 finished=true;$("orderForm").classList.add("hidden");$("orderColumns").hidden=true;
 const address=info?.pickup_address||"Adresse à configurer dans le back-office de test";
 const instructions=info?.pickup_instructions||"Stationne-toi à l'arrière et reste dans ton auto. Rafa viendra te remettre les pizzas chaudes.";
 const hour=info?.pickups?.[0]?.time||selected;
 const dateValue=info?.pickup_date||date;
 const pizzas=items().map(x=>'<div class="rj-receipt-line"><span>'+safe(x.pizza)+' × '+x.qty+'</span></div>').join("");
 const confirmedTotal=Number.isInteger(info?.total_cents)?info.total_cents/100:J.priceFor(count(),dateValue).total;
 const discount=J.priceFor(count(),dateValue).savings;
 $("notice").innerHTML=
  '<div class="success rj-receipt">'+
   '<span class="kicker">Commande confirmée</span>'+
   '<h3>Merci pour ta commande!</h3>'+
   '<p class="rj-receipt-lede">Tes pizzas seront prêtes pour la cueillette.</p>'+
   '<p class="rj-receipt-date">'+safe(J.formatDate(dateValue))+' · '+safe(J.niceTime(hour))+'</p>'+
   '<p class="rj-receipt-id">Numéro de commande : '+safe(id)+'</p>'+
   '<div class="rj-receipt-detail"><h4>Ta commande</h4>'+
    pizzas+
    (discount?'<p class="rj-receipt-line">4e pizza offerte</p>':"")+
    '<div class="rj-receipt-total"><span>Total</span><strong>'+confirmedTotal+' $</strong></div>'+
   '</div>'+
   '<div class="rj-receipt-detail"><h4>Cueillette à Cap-Rouge</h4>'+
    '<p><strong>Adresse :</strong> '+safe(address)+'</p>'+
    '<p>'+safe(instructions)+'</p>'+
   '</div>'+
   '<p class="rj-receipt-demo">Environnement de test : aucun paiement débité et aucun courriel envoyé.</p>'+
  '</div>';
 $("notice").scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
}

$("orderForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(sending||finished||!selected||count()<1||count()>dayLimit())return;
 const current=J.scheduleFor();
 if(!current.open||current.target!==date){errorText("Le calendrier a changé. Actualise la page.");return}
 const slot=available.find(r=>r.pickup_time===selected);
 if(!checkSlot(slot)){errorText("Cette heure n'est plus disponible, choisis une autre heure.");await refresh();return}
 const name=$("customerName").value.trim(),email=$("customerEmail").value.trim(),phone=$("customerPhone").value.trim(),pay=$("payment").value;
 if(name.length<2||email.length<5||phone.length<7||!$("contactConsent").checked){errorText("Vérifie les coordonnées avant de confirmer.");return}
 sending=true;render();
 try{
  if(!requestId)requestId=API.uuid();
  const result=await API.reserve({date,pickups:[{time:selected,qty:count()}],items:items(),name,email,phone,payment:pay,requestId});
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
 $("notice").innerHTML="";
 try{
  menu=await API.menu(date);
  if(!menu.length)throw Error("Aucune pizza n'est encore activée sur la carte de test.");
  renderMenu();await refresh();
 }catch(e){errorText("Test non disponible : "+e.message);render()}
}
setInterval(()=>{if(finished)return;const p=J.scheduleFor();if(p.target!==date){
 plan=p;date=p.target;selected=null;requestId=null;cart.clear();available=[];menu=[];
 $("jeudisPizzaChoices").innerHTML="";init();
 }else if(p.open!==plan.open){plan=p;selected=null;requestId=null;refresh()}
},30000);
setInterval(()=>{if(!sending&&!document.hidden&&plan.open&&!finished)refresh()},20000);
render();init();
})();