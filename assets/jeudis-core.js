/* Les Jeudis Rafa — logique partagee, version DEMO sans backend.
   Regle: un seul jeudi reservable, mercredi 12 h (America/Toronto) limite.
   Le jeudi, le jeudi suivant devient la seule date possible.
   Important: la confirmation atomique devra se faire sur serveur avant lancement reel. */
(function(global){
"use strict";
const CONFIG=Object.freeze({unitPrice:27,slotCapacity:3,dailyCapacity:30,startHour:17,endHour:21,slotMinutes:20,timezone:"America/Toronto",demoStorageKey:"rafa-jeudis-demo-v1"});
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
function allocation(qty,startTime,orders,date){
  qty=Math.floor(Number(qty)||0);
  if(qty<1||qty>CONFIG.dailyCapacity)return null;
  const list=slots(),start=list.findIndex(x=>x.key===startTime);
  if(start<0)return null;
  const total=activeOrders(orders,date).reduce((sum,o)=>sum+amount(o.items),0);
  if(total+qty>CONFIG.dailyCapacity)return null;
  const used=occupancy(orders,date);
  let left=qty;const pickups=[];
  for(let i=start;i<list.length&&left>0;i++){
    const free=Math.max(0,CONFIG.slotCapacity-used[list[i].key]);
    // on n'offre pas un retrait saute dans le temps: tous les creneaux de la commande se suivent
    if(free===0)return null;
    const take=Math.min(free,left);
    pickups.push({time:list[i].key,qty:take});
    left-=take;
  }
  return left===0?pickups:null;
}
function allOptions(qty,orders,date){
  return slots().map(s=>({...s,pickups:allocation(qty,s.key,orders,date)}));
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
global.RafaJeudis={CONFIG,parts,plusDays,weekday,scheduleFor,slots,amount,activeOrders,occupancy,allocation,allOptions,loadDemo,saveDemo,formatDate,niceTime};
})(window);
