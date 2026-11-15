/* Les Jeudis Rafa — DEMO locale, aucune commande commerciale. */
(function(){
"use strict";
const J=window.RafaJeudis,C=J.CONFIG,$=id=>document.getElementById(id);
const groups=window.RAFA_PIZZA_GROUPS||[];
const pizzas=groups.flatMap(g=>g[1].map(p=>({name:p[0],description:p[1],group:g[0]})));
const cart=new Map();
let plan=J.scheduleFor(),date=plan.target,desired=1,selected=null;
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const items=()=>[...cart].filter(([,qty])=>qty>0).map(([pizza,qty])=>({pizza,qty,unitPrice:C.unitPrice}));
const chosen=()=>J.amount(items());
const orders=()=>J.loadDemo();
function renderPizzas(){
 const holder=$("pizzas");holder.innerHTML="";
 for(const p of pizzas){
  const el=document.createElement("div");el.className="pizza";
  el.innerHTML='<div><strong>'+safe(p.name)+'</strong><br><small>'+safe(p.group)+'</small></div>'+
   '<small>'+safe(p.description)+'</small><div class="counter">'+
   '<button class="stepper" data-d="-1" type="button" aria-label="Retirer une '+safe(p.name)+'">−</button>'+
   '<span class="qty">0</span><button class="stepper" data-d="1" type="button" aria-label="Ajouter une '+safe(p.name)+'">+</button></div>';
  el.querySelectorAll("[data-d]").forEach(button=>button.addEventListener("click",()=>{
   const delta=Number(button.dataset.d);
   if(delta>0&&chosen()>=desired)return;
   const n=Math.max(0,(cart.get(p.name)||0)+delta);
   if(n)cart.set(p.name,n);else cart.delete(p.name);
   selected=null;render();
  }));
  holder.appendChild(el);
 }
}
function showSchedule(){
 const settings=J.loadSettings(date),all=orders();
 const schedule=J.scheduleCheck(all,date);
 const left=Math.max(0,C.dailyCapacity-schedule.total);
 $("targetTitle").textContent="Pour le "+J.formatDate(date);
 $("deadline").textContent="Un seul jeudi réservable · limite mercredi "+J.formatDate(J.plusDays(date,-1)).replace(/^mercredi /,"")+" à 12 h · "+left+" pizza(s) encore disponibles";
 $("closedMessage").classList.toggle("hidden",plan.open&&!settings.paused);
 $("closedMessage").textContent=!plan.open
  ?"Les commandes du jeudi de demain ont fermé mercredi à midi. La prochaine vente ouvrira jeudi."
  :"Les commandes sont temporairement suspendues pour ce jeudi.";
 $("orderForm").classList.toggle("hidden",!plan.open||settings.paused);
 const options=J.allOptions(desired,all,date,settings);
 const valid=options.find(o=>o.key===selected&&o.pickups);
 if(!valid)selected=null;
 $("hours").innerHTML="";
 for(const opt of options){
  const enabled=plan.open&&!settings.paused&&!!opt.pickups;
  const button=document.createElement("button");
  button.type="button";button.className="slot"+(selected===opt.key?" selected":"");
  button.disabled=!enabled;button.setAttribute("aria-pressed",String(selected===opt.key));
  const detail=enabled?(opt.pickups.length===1?"Disponible":opt.pickups.length+" remises"):"Indisponible";
  button.innerHTML=safe(opt.label)+"<span>"+safe(detail)+"</span>";
  button.onclick=()=>{selected=opt.key;render()};
  $("hours").appendChild(button);
 }
 const offer=options.find(o=>o.key===selected&&o.pickups);
 if(offer){
  const chunks=J.assignPizzas(items(),offer.pickups);
  $("selectedHours").innerHTML="<strong>Ton horaire :</strong> "+chunks.map(p=>
   safe(J.niceTime(p.time))+" ("+p.qty+" pizza"+(p.qty>1?"s":"")+")"+
   (chosen()===desired?" : "+p.pizzas.map(x=>safe(x.qty+" × "+x.pizza)).join(", "):"")
  ).join(" · ")+"<br><small>"+(chunks.length>1
   ?"Cette commande exige plusieurs remises consécutives. Reste sur place entre les remises."
   :"Tes pizzas seront préparées pour ce retrait.")+"</small>";
 }else{
  $("selectedHours").textContent=!schedule.ok
   ?"Une incohérence a été détectée dans la simulation. Aucune place supplémentaire n'est proposée."
   :desired>C.slotCapacity*C.maxAutomaticPickups
   ?"Pour plus de "+(C.slotCapacity*C.maxAutomaticPickups)+" pizzas, contacte Rafa afin d'organiser une commande spéciale."
   :left<desired?"Il ne reste pas assez de capacité pour cette quantité."
   :"Choisis une heure disponible pour "+desired+" pizza(s). Certaines quantités nécessitent plusieurs remises.";
 }
 $("confirmBtn").disabled=!plan.open||settings.paused||!offer||chosen()!==desired;
}
function render(){
 const amount=chosen();
 $("desiredQty").textContent=desired;
 $("desiredMinus").disabled=desired<=1;
 $("desiredPlus").disabled=desired>=C.dailyCapacity;
 $("chosenProgress").textContent=amount===desired
  ?"Toutes tes pizzas sont choisies. Tu peux sélectionner ton heure."
  :"Choisis encore "+(desired-amount)+" pizza(s). Les heures pour "+desired+" pizza(s) sont déjà calculées.";
 document.querySelectorAll(".pizza").forEach((el,i)=>{
  el.querySelector(".qty").textContent=cart.get(pizzas[i].name)||0;
  el.querySelector('[data-d="1"]').disabled=amount>=desired;
  el.querySelector('[data-d="-1"]').disabled=!(cart.get(pizzas[i].name)||0);
 });
 $("cart").innerHTML=amount?items().map(i=>'<div class="summary-line"><span>'+safe(i.pizza)+" × "+i.qty+"</span><b>"+i.qty*C.unitPrice+" $</b></div>").join("")
  :'<p class="muted">Aucune recette sélectionnée pour le moment.</p>';
 $("total").textContent=(desired*C.unitPrice).toLocaleString("fr-CA")+" $";
 showSchedule();
}
$("desiredMinus").addEventListener("click",()=>{
 if(desired<=1)return;desired--;
 while(chosen()>desired){
  const key=[...cart.keys()].at(-1);if(!key)break;
  const qty=(cart.get(key)||0)-1;if(qty>0)cart.set(key,qty);else cart.delete(key);
 }
 selected=null;render();
});
$("desiredPlus").addEventListener("click",()=>{if(desired<C.dailyCapacity){desired++;selected=null;render()}});
$("orderForm").addEventListener("submit",e=>{
 e.preventDefault();$("notice").innerHTML="";
 const current=J.scheduleFor(),settings=J.loadSettings(date);
 if(!current.open||current.target!==date||settings.paused){
  $("notice").innerHTML='<div class="error">Cette période de commande n’est plus ouverte. Actualise la page.</div>';
  refreshClock();return;
 }
 const data=items(),qty=chosen(),all=orders();
 if(qty!==desired)return;
 const pickups=J.allocation(qty,selected,all,date,settings);
 if(!pickups){$("notice").innerHTML='<div class="error">Cette heure n’est plus disponible. Choisis-en une autre.</div>';selected=null;render();return;}
 const name=$("customerName").value.trim(),email=$("customerEmail").value.trim(),phone=$("customerPhone").value.trim();
 if(name.length<2||!email.includes("@")||phone.length<7||!$("contactConsent").checked)return;
 const id="DEMO-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6);
 const segments=J.assignPizzas(data,pickups).map(p=>({...p,status:"pending",arrived:false}));
 if(segments.some(p=>!p.complete)){alert("Allocation de pizzas incomplète. Aucune commande enregistrée.");return;}
 const order={id,date,name,email,phone,payment:$("payment").value,paid:false,status:"pending",items:data,pickups:segments,createdAt:new Date().toISOString()};
 const updated=[...all,order];
 if(!J.scheduleCheck(updated,date).ok){$("notice").innerHTML='<div class="error">Capacité modifiée. Réessaie.</div>';selected=null;render();return;}
 try{J.saveDemo(updated)}catch{$("notice").innerHTML='<div class="error">Stockage de démonstration indisponible.</div>';return;}
 $("notice").innerHTML='<div class="success"><span class="kicker">Confirmation de démonstration</span>'+
  '<h3 style="margin-top:9px">Commande fictive '+safe(id)+'</h3><p>'+qty+' pizza(s) · '+qty*C.unitPrice+' $</p>'+
  '<p><strong>Retraits :</strong> '+segments.map(p=>safe(J.niceTime(p.time))+" ("+p.qty+") : "+p.pizzas.map(i=>safe(i.qty+" × "+i.pizza)).join(", ")).join(" · ")+'</p>'+
  '<h3>Service au volant</h3><p><strong>Lieu :</strong> Cap-Rouge, Québec. Adresse exacte non renseignée dans cette démo.</p>'+
  '<p>À ton arrivée, stationne-toi à l’arrière dans l’emplacement indiqué. Reste dans ton auto : Rafa viendra te remettre les pizzas chaudes dans leurs boîtes.</p>'+
  '<p>Cette simulation ne réserve rien auprès de Rafa, n’envoie aucun courriel et ne traite aucun paiement.</p></div>';
 cart.clear();desired=1;selected=null;$("orderForm").reset();render();
});
function refreshClock(){
 const now=J.scheduleFor();
 if(now.target!==date||now.open!==plan.open){
  plan=now;date=now.target;selected=null;$("notice").innerHTML="";render();
 }
}
window.addEventListener("storage",render);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshClock()});
setInterval(refreshClock,30000);
renderPizzas();render();
})();