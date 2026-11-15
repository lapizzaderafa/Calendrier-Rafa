(function(){
"use strict";
const J=window.RafaJeudis,$=id=>document.getElementById(id),C=J.CONFIG;
const GROUPS=window.RAFA_PIZZA_GROUPS||[];
const pizzas=GROUPS.flatMap(group=>group[1].map(x=>({name:x[0],description:x[1],group:group[0]})));
const cart=new Map(),plan=J.scheduleFor(),date=plan.target;
let selected=null,desired=1;
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function buildPizzas(){
 const container=$("pizzas");container.innerHTML="";
 for(const p of pizzas){
  const el=document.createElement("div");el.className="pizza";
  el.innerHTML='<div><strong>'+safe(p.name)+'</strong><br><small>'+safe(p.group)+'</small></div><small>'+safe(p.description)+'</small><div class="counter"><button class="stepper" data-d="-1" type="button" aria-label="Retirer une '+safe(p.name)+'">−</button><span class="qty">0</span><button class="stepper" data-d="1" type="button" aria-label="Ajouter une '+safe(p.name)+'">+</button></div>';
  const qty=el.querySelector(".qty");
  el.querySelectorAll("[data-d]").forEach(btn=>btn.addEventListener("click",()=>{
   if(Number(btn.dataset.d)>0&&J.amount(items())>=desired)return;
   const next=Math.max(0,Math.min(desired,(cart.get(p.name)||0)+Number(btn.dataset.d)));
   if(next){cart.set(p.name,next)}else{cart.delete(p.name)}
   qty.textContent=next;selected=null;render();
  }));
  container.appendChild(el);
 }
}
function items(){return [...cart].filter(([_,qty])=>qty>0).map(([pizza,qty])=>({pizza,qty,unitPrice:C.unitPrice}));}
function orders(){return J.loadDemo();}
function render(){
 const amount=J.amount(items()),all=orders();
 $("desiredQty").textContent=desired;
 $("desiredMinus").disabled=desired<=1||amount>=desired;
 $("desiredPlus").disabled=desired>=30;
 $("chosenProgress").textContent=amount===desired
   ?"Parfait! Tes "+desired+" pizza(s) sont choisies. Tu peux sélectionner ton heure de cueillette."
   :"Choisis encore "+(desired-amount)+" pizza(s). Les heures disponibles pour "+desired+" pizza(s) sont déjà affichées.";
 document.querySelectorAll(".pizza").forEach((el,i)=>{
   el.querySelector('[data-d="1"]').disabled=amount>=desired;
   el.querySelector('[data-d="-1"]').disabled=!(cart.get(pizzas[i].name)||0);
 });
 $("cart").innerHTML=amount?items().map(i=>'<div class="summary-line"><span>'+safe(i.pizza)+' × '+i.qty+'</span><b>'+(i.qty*C.unitPrice)+' $</b></div>').join(""):'<p class="muted">Aucune pizza sélectionnée.</p>';
 $("total").textContent=(desired*C.unitPrice).toLocaleString("fr-CA")+" $";
 $("hours").innerHTML="";
 const options=J.allOptions(desired,all,date);
 for(const opt of options){
  const btn=document.createElement("button"),valid=plan.open&&!!opt.pickups&&desired>0;
  btn.type="button";btn.className="slot"+(selected===opt.key?" selected":"");btn.disabled=!valid;
  const details=valid?(opt.pickups.length===1?"Disponible":opt.pickups.length+" cueillettes"):"Indisponible";
  btn.innerHTML=safe(opt.label)+"<span>"+safe(details)+"</span>";
  btn.onclick=()=>{selected=opt.key;render()};
  $("hours").appendChild(btn);
 }
 const offer=options.find(x=>x.key===selected&&x.pickups);
 if(offer){
  $("selectedHours").innerHTML='<strong>Retraits proposés :</strong> '+offer.pickups.map(p=>safe(J.niceTime(p.time))+" ("+p.qty+" pizza"+(p.qty>1?"s":"")+")").join(" · ")+".<br><small>Chaque groupe de pizzas sera préparé pour son heure de retrait.</small>";
 }else{selected=null;$("selectedHours").textContent="Choisis une heure disponible pour "+desired+" pizza(s). Le nombre de cueillettes dépend de la place restante.";}
 $("confirmBtn").disabled=!plan.open||!selected||amount!==desired;
}
$("targetTitle").textContent="Pour le "+J.formatDate(date);
$("deadline").textContent="Date unique offerte • Fin des commandes : mercredi "+J.formatDate(J.plusDays(date,-1)).replace(/^mercredi /,"")+" à 12 h (Québec).";
if(!plan.open){
 $("closedMessage").classList.remove("hidden");
 $("closedMessage").textContent="Les commandes du jeudi de demain ont fermé mercredi à 12 h. La réservation pour le jeudi suivant ouvrira dès jeudi. Aucune autre date n'est proposée.";
 $("orderForm").classList.add("hidden");
}else{$("closedMessage").classList.add("hidden");}
$("desiredMinus").addEventListener("click",()=>{if(desired>1&&J.amount(items())<desired){desired--;selected=null;render()}});
$("desiredPlus").addEventListener("click",()=>{if(desired<30){desired++;selected=null;render()}});
$("orderForm").addEventListener("submit",e=>{
 e.preventDefault();$("notice").innerHTML="";
 if(!plan.open||J.amount(items())!==desired)return;
 const current=J.scheduleFor();if(!current.open||current.target!==date){$("notice").innerHTML='<div class="error">La période de commande a changé. Actualise la page.</div>';return;}
 const data=items(),quantity=J.amount(data);
 const allocation=J.allocation(quantity,selected,J.loadDemo(),date);
 if(!allocation){$("notice").innerHTML='<div class="error">Cette heure vient de devenir indisponible dans cette démonstration. Choisis une autre heure.</div>';selected=null;render();return;}
 const name=$("customerName").value.trim(),email=$("customerEmail").value.trim(),phone=$("customerPhone").value.trim();
 if(!name||!email||!phone)return;
 const id="DEMO-"+String(Date.now()).slice(-7);
 const obj={id,date,name,email,phone,payment:$("payment").value,paid:false,status:"pending",items:data,pickups:allocation,createdAt:new Date().toISOString()};
 const currentOrders=J.loadDemo();currentOrders.push(obj);J.saveDemo(currentOrders);
 $("notice").innerHTML='<div class="success"><span class="kicker">Confirmation de démonstration</span><h3 style="margin-top:9px">Commande fictive '+safe(id)+' confirmée</h3><p>'+quantity+' pizza(s) · '+(quantity*C.unitPrice)+' $.</p><p><strong>Heure(s) de retrait :</strong> '+allocation.map(a=>safe(J.niceTime(a.time))+" ("+a.qty+" pizza"+(a.qty>1?"s":"")+")").join(" · ")+'</p><h3>Service au volant chez Rafa</h3><p><strong>Rendez-vous :</strong> Cap-Rouge, Québec. <strong>Adresse exacte :</strong> non configurée dans cette démo.</p><p><strong>Arrivée :</strong> accède au stationnement arrière indiqué dans les instructions qui accompagneront ta confirmation réelle. Reste dans ton auto : Rafa viendra te remettre tes pizzas chaudes et emballées.</p><p><strong>Contact :</strong> '+safe(name)+' · '+safe(phone)+' · '+safe(email)+'</p><p><strong>Attention :</strong> aucun vrai paiement, courriel ou envoi à Rafa. Dans la version en production, l\'adresse exacte sera transmise par le serveur seulement après la confirmation enregistrée.</p></div>';
 cart.clear();desired=1;selected=null;$("orderForm").reset();document.querySelectorAll(".pizza .qty").forEach(n=>n.textContent="0");render();
});
window.addEventListener("storage",render);
buildPizzas();render();
})();