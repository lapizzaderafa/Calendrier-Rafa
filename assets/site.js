const SUPABASE_URL = "https://jetogsbyptglaihktdel.supabase.co";
const SUPABASE_KEY = "sb_publishable_YQndqxq2W7Bq2C-0crv0rQ_V4Upvbja";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const BOOKING_START = new Date(2026, 8, 1);
const BOOKING_END = new Date(2026, 11, 31);
// External reservations are confirmed separately from the website's database.
const EXTERNAL_BOOKED_DATES = new Set(["2026-11-09","2026-11-17","2026-11-24","2026-11-25","2026-11-28","2026-12-04"]);
// Personal closures in November (all other Mondays, Tuesdays and Wednesdays).
const NOVEMBER_UNAVAILABLE_DATES = new Set(["2026-11-02","2026-11-03","2026-11-04","2026-11-10","2026-11-11","2026-11-16","2026-11-18","2026-11-23","2026-11-30"]);
const OTHER_CLOSED_MONDAYS = new Set(["2026-10-26","2026-12-07","2026-12-21"]);
function manualCalendarStatus(iso) {
  if (EXTERNAL_BOOKED_DATES.has(iso)) return "booked";
  if (NOVEMBER_UNAVAILABLE_DATES.has(iso)) return "unavailable";
  // November: no recurring rule beyond the exact dates approved by the owner.
  if (iso.startsWith("2026-11-")) return null;
  if (iso < "2026-10-19" || iso > "2026-12-31") return null;
  // Preserve already published October/December closures until separately reviewed.
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 2 || weekday === 3 || OTHER_CLOSED_MONDAYS.has(iso)
    ? "unavailable" : null;
}
function isPubliclyClosedDate(iso) {
  return manualCalendarStatus(iso) !== null;
}
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const PIZZA_GROUPS = [["Sauce rouge",[["Margherita","Sauce tomate, mozza fraîche et basilic."],["’Nduja e miel","Sauce tomate, chair de saucisse épicée, mozza fraîche, gorgonzola et miel épicé."],["New York","Sauce tomate, mozza fraîche et pepperoni."],["Parma","Sauce tomate, mozza fraîche, prosciutto, roquette, parmesan et balsamique."],["Montréal","Sauce tomate, mozza fraîche, smoked meat du Québec, cornichons et trait de crème à la moutarde."],["Jardin","Sauce tomate, tomates et aubergines grillées, ail confit, ricotta fouettée et basilic."]]],["Sauce blanche",[["Cipolla","Crème fraîche, mozza fraîche, lard fumé et confit d'oignon."],["Quattro","Crème fraîche, mozza fraîche, pecorino, gorgonzola et comté."],["Fungus","Crème fraîche, variété de champignons du moment, mozza fraîche et basilic."],["Figus","Crème fraîche, guanciale, mozza fraîche, confit de figues et romarin."],["Mortadella","Crème fraîche, mozza fraîche, mortadelle, pistaches et ricotta fouettée."]]],["Butternut",[["Zucca e Salsiccia","Crème de courge butternut, mozza fraîche, chair de saucisse italienne, sauge et parmesan."]]]];
const $ = id => document.getElementById(id);
function renderPizzas(){
 const grid=$("pizzaGrid"); if(!grid) return; grid.replaceChildren();let index=0;
 for(const [category,pizzas] of PIZZA_GROUPS){
  const group=document.createElement("section");group.className="menu-group";
  const title=document.createElement("h3");title.className="menu-category-title";title.textContent=category;
  const list=document.createElement("ol");list.className="menu-list";
  for(const [name,ingredients] of pizzas){index++;
   const row=document.createElement("li");const number=document.createElement("span");number.className="menu-number";number.setAttribute("aria-hidden","true");number.textContent=String(index).padStart(2,"0");
   const content=document.createElement("div");content.className="menu-content";
   const heading=document.createElement("h4");heading.className="menu-name";heading.textContent=name;
   const description=document.createElement("p");description.className="menu-ingredients";description.textContent=ingredients;
   content.append(heading,description);row.append(number,content);list.appendChild(row);
  }
  group.append(title,list);grid.appendChild(group);
 }
}
function calculateEventPrice(guests){guests=Number(guests);let pricePerPerson,fixedFee;if(guests<=10){pricePerPerson=29;fixedFee=175}else if(guests<=13){pricePerPerson=27;fixedFee=200}else if(guests<=15){pricePerPerson=27;fixedFee=250}else if(guests<=20){pricePerPerson=25;fixedFee=250}else if(guests<=25){pricePerPerson=23;fixedFee=300}else if(guests<=30){pricePerPerson=22;fixedFee=350}else if(guests<=40){pricePerPerson=21;fixedFee=400}else if(guests<=50){pricePerPerson=20;fixedFee=500}else if(guests<=75){pricePerPerson=19;fixedFee=600}else{pricePerPerson=18;fixedFee=750}return{pricePerPerson,fixedFee}}
function updateEstimator(){
  const guests=Number($("guestSlider").value);
  const pricing=calculateEventPrice(guests);
  $("guestNumber").textContent=guests;
  $("personPrice").textContent=`${pricing.pricePerPerson} $ / personne`;
  $("eventFee").textContent=`${pricing.fixedFee} $`;
  $("largeEventNote").classList.toggle("show",guests>50);
}
$("guestSlider").addEventListener("input",updateEstimator);
updateEstimator();
let blockedDates=new Map();let viewDate=startViewDate();function startViewDate(){const now=new Date();const current=new Date(now.getFullYear(),now.getMonth(),1);if(current<BOOKING_START)return new Date(BOOKING_START);if(current>BOOKING_END)return new Date(BOOKING_END.getFullYear(),BOOKING_END.getMonth(),1);return current}function localDateOnly(){const now=new Date();return new Date(now.getFullYear(),now.getMonth(),now.getDate())}function dateKey(year,month,day){return`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`}function mondayIndex(jsDay){return(jsDay+6)%7}function sameOrBeforeMonth(a,b){return a.getFullYear()<b.getFullYear()||(a.getFullYear()===b.getFullYear()&&a.getMonth()<=b.getMonth())}function sameOrAfterMonth(a,b){return a.getFullYear()>b.getFullYear()||(a.getFullYear()===b.getFullYear()&&a.getMonth()>=b.getMonth())}
function renderCalendar(){const year=viewDate.getFullYear(),month=viewDate.getMonth();$("monthTitle").textContent=`${MONTHS[month]} ${year}`;$("prevMonth").disabled=sameOrBeforeMonth(viewDate,BOOKING_START);$("nextMonth").disabled=sameOrAfterMonth(viewDate,new Date(BOOKING_END.getFullYear(),BOOKING_END.getMonth(),1));const grid=$("calendarGrid");grid.innerHTML="";const firstDay=new Date(year,month,1),daysInMonth=new Date(year,month+1,0).getDate(),today=localDateOnly();for(let i=0;i<mondayIndex(firstDay.getDay());i++){const empty=document.createElement("div");empty.className="day empty";grid.appendChild(empty)}for(let day=1;day<=daysInMonth;day++){const date=new Date(year,month,day),key=dateKey(year,month,day),afterBookingEnd=date>BOOKING_END,beforeBookingStart=date<BOOKING_START,isPast=date<today,stored=blockedDates.get(key);const manualStatus=manualCalendarStatus(key);let status;if(beforeBookingStart||afterBookingEnd||isPast)status="past";else if(stored==="booked"||manualStatus==="booked")status="booked";else if(stored==="unavailable"||manualStatus==="unavailable")status="unavailable";else status="available";const el=document.createElement(status==="available"?"a":"div");el.className=`day ${status}`;el.innerHTML=`<div class="num">${day}</div><div class="status">${status==="available"?"Disponible":status==="booked"?"Réservé":status==="unavailable"?"Indisponible":"Passé"}</div>`;if(status==="available"){el.href=`./reserve.html?date=${encodeURIComponent(key)}`;el.setAttribute("aria-label",`${day} ${MONTHS[month]} ${year}, disponible`)}grid.appendChild(el)}}
$("prevMonth").addEventListener("click",()=>{const candidate=new Date(viewDate.getFullYear(),viewDate.getMonth()-1,1);if(!sameOrBeforeMonth(candidate,new Date(BOOKING_START.getFullYear(),BOOKING_START.getMonth()-1,1))){viewDate=candidate;renderCalendar()}});$("nextMonth").addEventListener("click",()=>{const candidate=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,1);const endMonth=new Date(BOOKING_END.getFullYear(),BOOKING_END.getMonth(),1);if(sameOrBeforeMonth(candidate,endMonth)){viewDate=candidate;renderCalendar()}});
async function loadCalendar(){$("calendarError").classList.remove("show");try{const{data,error}=await db.rpc("get_calendar_blocks");if(error)throw error;blockedDates=new Map((data||[]).map(row=>[row.event_date,row.display_status]));renderCalendar()}catch(error){console.error("Calendar load failed",error);blockedDates=new Map();$("calendarGrid").innerHTML="";$("calendarError").classList.add("show");$("prevMonth").disabled=true;$("nextMonth").disabled=true}}
renderPizzas();loadCalendar();document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")loadCalendar()});window.addEventListener("pageshow",event=>{if(event.persisted)loadCalendar()});const siteHeader=document.querySelector(".site-header");if(siteHeader){siteHeader.style.position="sticky";siteHeader.style.top="0";siteHeader.style.zIndex="40";}
const rafaContactScript=document.createElement('script');rafaContactScript.src='./assets/contact.js?v=2';rafaContactScript.defer=true;document.body.appendChild(rafaContactScript);
const rafaStructuredData=document.createElement('script');rafaStructuredData.type='application/ld+json';rafaStructuredData.textContent=JSON.stringify({'@context':'https://schema.org','@type':'Organization','name':'Rafa Pizza','url':'https://rafapizza.ca/','description':'Service de pizza à domicile préparée sur place devant vos invités.','email':'lapizzaderafa@gmail.com'});document.head.appendChild(rafaStructuredData);
