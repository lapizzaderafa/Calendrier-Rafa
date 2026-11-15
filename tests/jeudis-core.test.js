/* Exécuter avec: node tests/jeudis-core.test.js
   Simulations sans compte, sans coût, sans écriture dans Supabase. */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const store=new Map();
const sandbox={window:{},localStorage:{
 getItem:key=>store.get(key)||null,
 setItem:(key,value)=>store.set(key,value),
 removeItem:key=>store.delete(key)
},Intl,Date,Math,Number,Object,String,Array,Set,Map,JSON};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(require("node:path").join(__dirname,"../assets/jeudis-core.js"),"utf8"),sandbox);
const J=sandbox.window.RafaJeudis,date="2026-11-19";
const settings=()=>({paused:false,closedSlots:[]});
const order=(id,time,qty,status="pending")=>({
 id,date,status,items:[{pizza:"Margherita",qty}],pickups:[{time,qty}]
});
const book=(qty,time,orders=[])=>J.allocation(qty,time,orders,date,settings());
let passed=0;
function test(name,fn){store.clear();fn();passed++;console.log("✓",name)}
test("Prochaine cueillette : jeudi 19 novembre",()=>{
 const x=J.scheduleFor(new Date("2026-11-15T17:00:00Z"));
 assert.equal(x.target,date);assert.equal(x.open,true);
});
test("Mercredi fermeture à midi heure du Québec",()=>{
 assert.equal(J.scheduleFor(new Date("2026-11-18T16:59:00Z")).open,true);
 assert.equal(J.scheduleFor(new Date("2026-11-18T17:00:00Z")).open,false);
});
test("Jeudi minuit : bascule au 26 novembre",()=>{
 assert.equal(J.scheduleFor(new Date("2026-11-19T05:00:00Z")).target,"2026-11-26");
});
test("Maximum par soir réellement fixé à 25",()=>{
 assert.equal(J.CONFIG.dailyCapacity,25);
 assert.equal(book(25,"17:00")?.[0]?.qty,25);
});
test("Aucune limite arbitraire à 5 ou 6 par commande",()=>{
 assert.equal(book(20,"17:00")?.length,1);
 assert.equal(book(20,"17:00")?.[0].qty,20);
});
test("26 pizzas en une seule commande refusées",()=>{
 assert.equal(book(26,"17:00"),null);
});
test("20 à 17h neutralisent les plages suivantes",()=>{
 const existing=[order("a","17:00",20)];
 assert.equal(book(1,"17:20",existing),null);
 assert.equal(book(1,"18:40",existing),null);
});
test("20 pizzas à 17h laissent une plage partiellement libre à 19h",()=>{
 const existing=[order("a","17:00",20)];
 assert.equal(book(1,"19:00",existing)?.[0].qty,1);
});
test("20 pizzas permettent 5 autres à 19h20",()=>{
 const existing=[order("a","17:00",20)];
 assert.equal(book(5,"19:20",existing)?.[0].qty,5);
});
test("20 pizzas + 6 refusées même si heure de production libre",()=>{
 assert.equal(book(6,"19:20",[order("a","17:00",20)]),null);
});
test("25 pizzas vendues : plus de disponibilité",()=>{
 const existing=[order("a","17:00",20),order("b","19:20",5)];
 assert.equal(J.scheduleCheck(existing,date).total,25);
 assert.equal(book(1,"20:40",existing),null);
});
test("Maximum deux voitures pour une même heure",()=>{
 const list=[order("a","17:00",1),order("b","17:00",1)];
 assert.equal(book(1,"17:00",list),null);
});
test("Annulation : libère la capacité quotidienne et les heures",()=>{
 const list=[order("a","17:00",20)];
 assert.equal(book(20,"17:00",list),null);
 list[0].status="cancelled";
 assert.equal(J.scheduleCheck(list,date).total,0);
 assert.equal(book(20,"17:00",list)?.[0].qty,20);
});
test("Suppression : libère la capacité sans reliquat",()=>{
 let list=[order("a","17:00",25)];
 list=list.filter(x=>x.id!=="a");
 assert.equal(J.scheduleCheck(list,date).total,0);
 assert.equal(book(25,"17:00",list)?.length,1);
});
test("Commande remise : reste comptée dans le quota du soir",()=>{
 const list=[order("a","17:00",25,"delivered")];
 assert.equal(J.scheduleCheck(list,date).total,25);
 assert.equal(book(1,"20:40",list),null);
});
test("Restaurer une commande annulée : validation 25 avant réouverture",()=>{
 const cancelled=order("a","17:00",15,"cancelled");
 const newOrder=order("b","17:00",20);
 assert.equal(J.scheduleCheck([cancelled,newOrder],date).ok,true);
 assert.equal(J.scheduleCheck([{...cancelled,status:"pending"},newOrder],date).ok,false);
});
test("Journée suspendue interdit la commande",()=>{
 assert.equal(J.allocation(1,"17:00",[],date,{paused:true,closedSlots:[]}),null);
});
test("Créneau fermé interdit la commande",()=>{
 assert.equal(J.allocation(1,"17:00",[],date,{paused:false,closedSlots:["17:00"]}),null);
});
test("20 pizzas à 20h40 ne peuvent pas être préparées avant 21h",()=>{
 assert.equal(book(20,"20:40"),null);
});
test("Le planning comptabilise exactement toutes les périodes consommées",()=>{
 const x=J.scheduleCheck([order("a","17:00",20)],date);
 assert.equal(x.ok,true);
 assert.equal(Object.values(x.production).reduce((a,b)=>a+b,0),20);
});
test("Cohérence des allocations de recettes sur plusieurs lots",()=>{
 const p=J.assignPizzas([{pizza:"Speck",qty:2},{pizza:"Mortadella",qty:2},{pizza:"New York",qty:1}],[{time:"17:00",qty:3},{time:"17:20",qty:2}]);
 assert.deepEqual(JSON.parse(JSON.stringify(p.map(x=>x.pizzas))),[
 [{pizza:"Speck",qty:2},{pizza:"Mortadella",qty:1}],
 [{pizza:"Mortadella",qty:1},{pizza:"New York",qty:1}]
 ]);
});
test("Calendrier rempli au-delà du quota refusé",()=>{
 const existing=[order("a","17:00",20),order("b","19:20",6)];
 assert.equal(J.scheduleCheck(existing,date).ok,false);
 assert.equal(book(1,"20:40",existing),null);
});
test("Une commande ne peut pas réserver une heure invalide",()=>{
 assert.equal(book(1,"16:00"),null);
 assert.equal(book(0,"17:00"),null);
});
console.log("\n"+passed+" tests réussis.");
