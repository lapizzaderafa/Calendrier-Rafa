/* Les Jeudis Rafa — logique partagee, version DEMO sans backend.
   Regle: un seul jeudi reservable, mercredi 12 h (America/Toronto) limite.
   Le jeudi, le jeudi suivant devient la seule date possible.
   Important: la confirmation atomique devra se faire sur serveur avant lancement reel. */
(function(global){
"use strict";
const CONFIG=Object.freeze({unitPrice:27,slotCapacity:3,dailyCapacity:25,startHour:17,endHour:21,slotMinutes:20,maxCarsPerSlot:2,maxAutomaticPickups:1,maxSinglePickup:25,prepMinutesPerPizza:4.5,handoffMinutesPerCar:2,bufferMinutes:2,timezone:"America/Toronto",demoStorageKey:"rafa-jeudis-demo-v1"});
function parts(now){
  const f=new Intl.DateTimeFormat("en-CA",{timeZone:CONFIG.timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
  const v=Object.fromEntries(f.formatToParts(now).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
  return {year:Number(v.year),month:Number(v.month),day:Number(v.day),hour:Number(v.hour),minute:Number(v.minute)};
}
function plusDays(ymd,n){
  const [y,m,d]=ymd.split("-").map(Number), t=new Date(Date.UTC(y,m-1,d+n,12,0,0));
  return [t.getUTCFullYear(),String(t.getUTCMonth()+1).padStart(2,"0"),String(t.getUTCDate()).padStart(2,"0")].join("-");
}
function weekday(ymd){const [y,m,d]=ymd.split("-").map(Number);return new Date(Date.UTC(y,m-1,d,12)).getUTCDay();}
function scheduleFor(now){
  now=now||new Date();
  const p=parts(now),today=[p.year,String(p.month).padStart(2,"0"),String(p.day).padStart(2,"0")].join("-");
  const day=weekday(today);
  const delta=(4-day+7)%7||7; // chaque jeudi ne propose jamais celui en cours
  const target=plusDays(today,delta);
  const closed=(day===3 && p.hour>=12); // mercredi a partir de midi: fin des commandes pour demain
  return {today,target,open:!closed,closed,weekday:day,cutoff:plusDays(target,-1)+"T12:00",reopen:closed?plusDays(today,1)+"T00:00":null};
}
function slots(){
  const a=[];for(let m=CONFIG.startHour*60;m<CONFIG.endHour*60;m+=CONFIG.slotMinutes){
    a.push({key:String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0"),
      label:Math.floor(m/60)+" h"+(m%60?" "+String(m%60).padStart(2,"0"):"")});
  }return a;
}
function amount(items){return (items||[]).reduce((n,i)=>n+Math.max(0,Math.floor(Number(i.qty)||0)),0);}
function activeOrders(orders,date){
  return (orders||[]).filter(o=>o&&o.date===date&&!["cancelled","expired"].includes(o.status));
}
function occupancy(orders,date){
  const s=slots(), used=Object.fromEntries(s.map(x=>[x.key,0]));
  for(const o of activeOrders(orders,date))for(const a of (o.pickups||[]))if(used[a.time]!==undefined)used[a.time]+=Number(a.qty)||0;
  return used;
}
function settingsKey(date){return "rafa-jeudis-settings-"+date;}
function loadSettings(date){
 try{
  const raw=JSON.parse(localStorage.getItem(settingsKey(date))||"{}");
  return {paused:raw.paused===true,closedSlots:Array.isArray(raw.closedSlots)?raw.closedSlots.filter(x=>slots().some(s=>s.key===x)):[]};
 }catch{return {paused:false,closedSlots:[]};}
}
function saveSettings(date,settings){
 const data={paused:!!settings.paused,closedSlots:[...new Set(settings.closedSlots||[])].filter(x=>slots().some(s=>s.key===x))};
 localStorage.setItem(settingsKey(date),JSON.stringify(data));
}
function carCounts(orders,date){
 const cars=Object.fromEntries(slots().map(s=>[s.key,0]));
 for(const o of activeOrders(orders,date)){
  const seen=new Set();
  for(const p of o.pickups||[]){
   // Une commande est un vehicule par heure de retrait, meme avec plusieurs types de pizza.
   if(Object.hasOwn(cars,p.time)&&!seen.has(p.time)){cars[p.time]++;seen.add(p.time);}
  }
 }
 return cars;
}
function productionKey(index){
 const minutes=CONFIG.startHour*60+index*CONFIG.slotMinutes;
 return String(Math.floor(minutes/60)).padStart(2,"0")+":"+String((minutes+1440)%60).padStart(2,"0");
}
function scheduleCheck(orders,date){
 const current=activeOrders(orders,date),used=occupancy(current,date),cars=carCounts(current,date);
 const errors=[],s=slots(),valid=new Set(s.map(x=>x.key)),jobs=[],production={};
 let total=0;
 for(const o of current){
  const qty=amount(o.items);
  total+=qty;
  const ps=o.pickups||[];
  if(!Number.isInteger(qty)||qty<1||ps.length!==1){
   errors.push("Commande invalide : "+(o.id||"?"));continue;
  }
  const p=ps[0],n=Number(p.qty),index=s.findIndex(x=>x.key===p.time);
  if(!valid.has(p.time)||!Number.isInteger(n)||n!==qty){
   errors.push("Cueillette invalide : "+(o.id||"?"));continue;
  }
  jobs.push({index,qty:n,id:o.id||"?"});
 }
 if(total>CONFIG.dailyCapacity)errors.push("Maximum de 25 pizzas par jeudi atteint");
 for(const slot of s){
  if(cars[slot.key]>CONFIG.maxCarsPerSlot)
   errors.push("Trop de voitures a "+slot.key);
 }
 // Une commande choisit un début de plage. Les périodes de production
 // nécessaires sont consommées à partir de ce début (3 pizzas/20 min).
 // Les commandes importantes neutralisent ainsi les heures qui suivent.
 jobs.sort((a,b)=>a.index-b.index);
 for(const job of jobs){
  let left=job.qty;
  for(let i=job.index;i<s.length&&left>0;i++){
   const key=s[i].key,free=Math.max(0,CONFIG.slotCapacity-(production[key]||0));
   const take=Math.min(left,free);
   production[key]=(production[key]||0)+take;left-=take;
  }
  if(left>0)errors.push("Temps de production insuffisant pour "+s[job.index]?.key);
 }
 return {ok:errors.length===0,errors,total,used,cars,production};
}
function allocation(qty,startTime,orders,date,opts){
 qty=Number(qty);
 if(!Number.isInteger(qty)||qty<1||qty>CONFIG.dailyCapacity)return null;
 if(!slots().some(s=>s.key===startTime))return null;
 const settings=opts||loadSettings(date);
 if(settings.paused||(settings.closedSlots||[]).includes(startTime))return null;
 const present=activeOrders(orders,date),check=scheduleCheck(present,date);
 if(!check.ok||check.total+qty>CONFIG.dailyCapacity)return null;
 const pickups=[{time:startTime,qty}];
 const proposed=[...present,{date,status:"pending",items:[{qty}],pickups}];
 return scheduleCheck(proposed,date).ok?pickups:null;
}
function allOptions(qty,orders,date,opts){
 return slots().map(s=>({...s,pickups:allocation(qty,s.key,orders,date,opts)}));
}
function productionPlan(orders,date){
 const report=scheduleCheck(orders,date);
 return slots().map(slot=>{
  const i=slots().findIndex(s=>s.key===slot.key);
  return {pickup:slot.key,
   productionWindows:slots().slice(i).filter(s=>(report.production[s.key]||0)>0).map(s=>s.key),
   pizzaCount:report.used[slot.key],cars:report.cars[slot.key],
   estimatedPrepPizzas:report.production[slot.key]||0,
   overbooked:!report.ok};
 });
}
function assignPizzas(items,pickups){
 const remaining=(items||[]).map(i=>({pizza:i.pizza,qty:Math.floor(Number(i.qty)||0)})).filter(x=>x.qty>0);
 return (pickups||[]).map(p=>{
  let toAssign=p.qty;const pizzas=[];
  for(const item of remaining){
   if(toAssign<=0)break;
   const take=Math.min(toAssign,item.qty);
   if(take>0){pizzas.push({pizza:item.pizza,qty:take});item.qty-=take;toAssign-=take;}
  }
  return {...p,pizzas,complete:toAssign===0};
 });
}
function loadDemo(){
 try{const v=JSON.parse(localStorage.getItem(CONFIG.demoStorageKey)||"[]");return Array.isArray(v)?v:[];}catch{return [];}
}
function saveDemo(orders){localStorage.setItem(CONFIG.demoStorageKey,JSON.stringify(orders));}
function formatDate(ymd){
 const [y,m,d]=ymd.split("-").map(Number);
 return new Intl.DateTimeFormat("fr-CA",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(y,m-1,d,12)));
}
function niceTime(key){const [h,m]=key.split(":").map(Number);return h+" h"+(m?" "+String(m).padStart(2,"0"):"");}
global.RafaJeudis={CONFIG,parts,plusDays,weekday,scheduleFor,slots,amount,activeOrders,occupancy,carCounts,settingsKey,loadSettings,saveSettings,scheduleCheck,allocation,allOptions,productionPlan,assignPizzas,loadDemo,saveDemo,formatDate,niceTime};
})(window);
