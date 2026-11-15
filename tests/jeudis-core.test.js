/* Exécuter avec: node tests/jeudis-core.test.js
   Zéro dépendance et aucune écriture en base de données. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const store=new Map();
const sandbox={
 window:{},
 localStorage:{
  getItem:key=>store.get(key)||null,
  setItem:(key,value)=>store.set(key,value),
  removeItem:key=>store.delete(key)
 },
 Intl,Date,Math,Number,Object,String,Array,Set,Map,JSON
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(require("node:path").join(__dirname,"../assets/jeudis-core.js"),"utf8"),sandbox);
const J=sandbox.window.RafaJeudis;
const date="2026-11-19";
const clear=()=>{store.clear()};
const order=(id,time,qty,status="pending",items=[{pizza:"Margherita",qty}])=>({
 id,date,items,status,pickups:[{time,qty}],createdAt:"2026-11-15T10:00:00Z"
});
const noBooking=()=>({paused:false,closedSlots:[]});
let passed=0;
function test(name,fn){clear();fn();passed++;console.log("✓",name)}
test("Dimanche 15 novembre: prochaine cueillette 19 novembre",()=>{
 const p=J.scheduleFor(new Date("2026-11-15T17:00:00Z"));
 assert.equal(p.target,"2026-11-19");assert.equal(p.open,true);
});
test("Mercredi: 11 h 59 ouvert, 12 h ferme (Québec)",()=>{
 const before=J.scheduleFor(new Date("2026-11-18T16:59:00Z"));
 const after=J.scheduleFor(new Date("2026-11-18T17:00:00Z"));
 assert.equal(before.open,true);assert.equal(after.open,false);
 assert.equal(after.target,"2026-11-19");
});
test("Jeudi minuit: date bascule la semaine suivante",()=>{
 const p=J.scheduleFor(new Date("2026-11-19T05:00:00Z"));
 assert.equal(p.target,"2026-11-26");assert.equal(p.open,true);
});
test("Deux pizzas déjà réservées à 17 h: 3 de plus passent si la production le permet",()=>{
 const existing=[order("a","17:00",2)];
 assert.ok(J.allocation(1,"17:00",existing,date,noBooking()));
 assert.ok(J.allocation(3,"17:00",existing,date,noBooking()));
 assert.equal(J.allocation(5,"17:00",existing,date,noBooking()),null);
 assert.ok(J.allocation(2,"17:20",existing,date,noBooking()));
});
test("3 pizzas à 17 h sur calendrier vide",()=>{
 const pickup=J.allocation(3,"17:00",[],date,noBooking());
 assert.equal(pickup?.[0].qty,3);
});
test("Deux voitures max par créneau, même s'il reste une pizza",()=>{
 const existing=[order("a","17:00",1),order("b","17:00",1)];
 assert.equal(J.allocation(1,"17:00",existing,date,noBooking()),null);
});
test("Aucune commande si 30 pizzas déjà réservées",()=>{
 const existing=[];
 for(let i=0;i<10;i++)existing.push(order(String(i),J.slots()[i].key,3));
 assert.equal(J.scheduleCheck(existing,date).total,30);
 assert.equal(J.allocation(1,"20:40",existing,date,noBooking()),null);
});
test("Annulation libère l'horaire et les quantités",()=>{
 const list=[order("a","17:00",5)];
 assert.equal(J.allocation(2,"17:00",list,date,noBooking()),null);
 list[0].status="cancelled";
 assert.ok(J.allocation(2,"17:00",list,date,noBooking()));
 assert.equal(J.activeOrders(list,date).length,0);
 assert.equal(J.scheduleCheck(list,date).total,0);
});
test("Suppression définitive ne laisse aucune capacité bloquée",()=>{
 let list=[order("a","17:00",6)];
 list=list.filter(o=>o.id!=="a");
 assert.equal(J.scheduleCheck(list,date).total,0);
 assert.equal(J.allocation(3,"17:00",list,date,noBooking())?.[0].qty,3);
});
test("Une commande terminée garde son créneau réservé",()=>{
 const list=[order("a","17:00",6,"delivered")];
 assert.equal(J.allocation(1,"17:00",list,date,noBooking()),null);
});
test("Restaurer une commande annulée doit refaire la validation de capacité",()=>{
 const old=order("a","17:00",6,"cancelled");
 const fresh=order("b","17:00",6);
 assert.equal(J.scheduleCheck([old,fresh],date).ok,true);
 const restore={...old,status:"pending"};
 assert.equal(J.scheduleCheck([restore,fresh],date).ok,false);
});
test("Journée suspendue et créneau fermé ne sont pas vendables",()=>{
 assert.equal(J.allocation(1,"17:00",[],date,{paused:true,closedSlots:[]}),null);
 assert.equal(J.allocation(1,"17:00",[],date,{paused:false,closedSlots:["17:00"]}),null);
});
test("Attribution des recettes correcte sur plusieurs lots de démo",()=>{
 const parts=J.assignPizzas([{pizza:"Speck",qty:2},{pizza:"Mortadella",qty:2},{pizza:"New York",qty:1}],[{time:"17:00",qty:3},{time:"17:20",qty:2}]);
 assert.equal(parts.length,2);
 assert.deepEqual(JSON.parse(JSON.stringify(parts.map(p=>p.pizzas))),[
  [{pizza:"Speck",qty:2},{pizza:"Mortadella",qty:1}],
  [{pizza:"Mortadella",qty:1},{pizza:"New York",qty:1}]
 ]);
});
test("Moteur refuse un calendrier incohérent",()=>{
 const invalid=[order("a","17:00",5),order("b","17:00",5)];
 assert.equal(J.scheduleCheck(invalid,date).ok,false);
 assert.equal(J.allocation(1,"17:20",invalid,date,noBooking()),null);
});

test("Cinq pizzas : une seule cueillette à 17 h",()=>{
 const pickups=J.allocation(5,"17:00",[],date,noBooking());
 assert.equal(pickups.length,1);
 assert.equal(pickups[0].qty,5);
 const report=J.scheduleCheck([order("five","17:00",5)],date);
 assert.equal(report.ok,true);
 assert.equal(report.production["16:20"]+report.production["16:40"],5);
});
test("Six pizzas dans une seule commande ; sept : arrangement spécial",()=>{
 assert.equal(J.allocation(6,"17:00",[],date,noBooking())?.length,1);
 assert.equal(J.allocation(7,"17:00",[],date,noBooking()),null);
});
test("La production peut être avancée pour préserver la prochaine cueillette",()=>{
 const a=order("a","17:00",3),b=order("b","17:20",6);
 assert.equal(J.scheduleCheck([a,b],date).ok,true);
});
test("Deux grosses commandes rapprochées ne dépassent pas la production",()=>{
 const a=order("a","17:00",6),b=order("b","17:20",6);
 assert.equal(J.scheduleCheck([a,b],date).ok,false);
});
console.log("\n"+passed+" tests réussis.");
