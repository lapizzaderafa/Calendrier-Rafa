/*
 * Rafa — Jeudis / adaptateur Supabase (non activé).
 * Le site public doit charger supabase-js@2 AVANT ce fichier.
 * Prérequis: appliquer et valider supabase/migrations/20261115_rafa_jeudis.sql.
 * L'absence du serveur DOIT déclencher une erreur, jamais un repli sur localStorage
 * pour une vraie réservation.
 * Clé publishable seulement (comme l'administration Rafa existante).
 */
(function(global){
"use strict";
let client;
function db(){
 if(!client){
  const config=global.RafaJeudisBackend;
  if(!config?.enabled||!config.url||!config.publishableKey)
   throw new Error("Le serveur de réservation n'est pas encore activé pour ce test.");
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url))
   throw new Error("Adresse du serveur de test invalide.");
  if(!global.supabase?.createClient)throw new Error("Librairie de réservations indisponible.");
  client=global.supabase.createClient(config.url,config.publishableKey);
 }
 return client;
}
function result(promise){
 return promise.then(({data,error})=>{
  if(error)throw new Error(error.message||"Échec de l'opération.");
  return data;
 });
}
function uuid(){
 if(!global.crypto?.randomUUID)throw new Error("La réservation sécurisée exige une connexion HTTPS.");
 return global.crypto.randomUUID();
}
async function currentUser(){
 const {data,error}=await db().auth.getUser();
 if(error||!data?.user)throw new Error("Connecte-toi dans le back-office Rafa.");
 return data.user;
}
async function menu(){
 return result(db().from("rafa_jeudis_menu").select("pizza,description,position").eq("active",true).order("position"));
}
async function availability(date){
 return result(db().rpc("rafa_jeudis_availability",{p_date:date}));
}
async function reserve({date,pickups,items,name,email,phone,payment,requestId}){
 const id=requestId||uuid();
 const orderId=await result(db().rpc("rafa_jeudis_reserve",{
  p_date:date,
  p_pickups:pickups.map(({time,qty})=>({time,qty})),
  p_items:items.map(({pizza,qty})=>({pizza,qty})),
  p_name:name,
  p_email:email,
  p_phone:phone,
  p_payment:payment,
  p_request_id:id
 }));
 return {orderId,requestId:id};
}
async function confirmation(requestId){
 const rows=await result(db().rpc("rafa_jeudis_confirmation",{p_request_id:requestId}));
 return rows?.[0]||null;
}
async function adminOrders(date){
 await currentUser();
 return result(db().from("rafa_jeudis_orders")
  .select("id,request_id,pickup_date,pickups,items,pizza_qty,customer_name,customer_email,customer_phone,payment_method,paid,total_cents,status,created_at,cancelled_at,delivered_at")
  .eq("pickup_date",date).order("created_at",{ascending:true}));
}
async function adminAction(orderId,action){
 await currentUser();
 if(!["cancel","restore","delete","paid","unpaid","delivered","preparing","ready"].includes(action))
  throw new Error("Action administrative non autorisée.");
 return result(db().rpc("rafa_jeudis_admin_action",{p_id:orderId,p_action:action}));
}
async function adminSettings(date){
 await currentUser();
 const rows=await result(db().from("rafa_jeudis_settings")
  .select("pickup_date,paused,closed_slots,pickup_address,pickup_instructions").eq("pickup_date",date));
 return rows?.[0]||{pickup_date:date,paused:false,closed_slots:[],pickup_address:"",pickup_instructions:""};
}
async function adminSaveSettings(date,{paused=false,closedSlots=[],pickupAddress="",pickupInstructions=""}){
 await currentUser();
 return result(db().from("rafa_jeudis_settings")
  .upsert({pickup_date:date,paused,closed_slots:closedSlots,pickup_address:pickupAddress,pickup_instructions:pickupInstructions},{onConflict:"pickup_date"}));
}
global.RafaJeudisApi=Object.freeze({
 menu,availability,reserve,confirmation,adminOrders,adminAction,adminSettings,adminSaveSettings,currentUser,uuid
});
})(window);
