const SUPABASE_URL = "https://lhshvpbxquzvzepdspqk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Rc41dK2cfyAutYs9VCfCDA_uewExROv";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let selectedSeats = [];

function configured(){ return !SUPABASE_URL.startsWith("YOUR_") && !SUPABASE_ANON_KEY.startsWith("YOUR_"); }
function esc(v){ return String(v ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.style.display="block";setTimeout(()=>t.style.display="none",3500);}
function fmt(d){return new Date(d).toLocaleString([], {dateStyle:"medium",timeStyle:"short"});}
function setNav(){document.getElementById("authLink").textContent=currentUser?"Logout":"Login";document.getElementById("authLink").onclick=currentUser?logout:null;}
async function loadUser(){const {data}=await sb.auth.getUser();currentUser=data.user;setNav();}
function needConfig(){if(!configured()){render(`<div class="form-card"><h2>Setup required</h2><p>Open <b>app.js</b> and replace <code>YOUR_SUPABASE_URL</code> and <code>YOUR_SUPABASE_ANON_KEY</code> with your Supabase project values.</p><p>Then run this folder with Live Server or another local web server.</p></div>`);return true}return false;}
function render(html){document.getElementById("app").innerHTML=html;}

async function login(){
 if(needConfig())return;
 render(`<div class="form-card"><h2>Login</h2><div id="err"></div><label>Email</label><input id="email" type="email"><label>Password</label><input id="password" type="password"><button class="btn" onclick="doLogin()">Login</button><p>Don't have an account? <a href="#signup">Sign up</a></p></div>`);
}
async function doLogin(){
 const email=emailEl().value.trim(), password=document.getElementById("password").value;
 const {error}=await sb.auth.signInWithPassword({email,password});
 if(error){document.getElementById("err").innerHTML=`<div class="error">${esc(error.message)}</div>`;return}
 location.hash="#events";
}
function emailEl(){return document.getElementById("email")}
async function signup(){
 if(needConfig())return;
 render(`<div class="form-card"><h2>Create account</h2><div id="err"></div><label>Email</label><input id="email" type="email"><label>Password</label><input id="password" type="password"><button class="btn" onclick="doSignup()">Sign up</button><p>Already registered? <a href="#login">Login</a></p></div>`);
}
async function doSignup(){
 const email=emailEl().value.trim(), password=document.getElementById("password").value;
 if(password.length<6){document.getElementById("err").innerHTML='<div class="error">Password must be at least 6 characters.</div>';return}
 const {error}=await sb.auth.signUp({email,password});
 if(error){document.getElementById("err").innerHTML=`<div class="error">${esc(error.message)}</div>`;return}
 render(`<div class="form-card"><div class="success">Account created. Check your email if confirmation is enabled in Supabase.</div><a href="#login">Go to login</a></div>`);
}
async function logout(){await sb.auth.signOut();currentUser=null;location.hash="#events";}

async function eventsPage(){
 if(needConfig())return;
 const {data,error}=await sb.from("events").select("*").gt("starts_at",new Date().toISOString()).order("starts_at");
 if(error){render(`<div class="error">${esc(error.message)}</div>`);return}
 render(`<section class="hero"><h1>Upcoming events</h1><p class="muted">Choose an event and reserve up to 4 seats.</p></section>${data?.length?`<div class="grid">${data.map(e=>`<article class="card"><h3>${esc(e.title)}</h3><p>${esc(e.description)}</p><div class="event-meta"><b>Venue:</b> ${esc(e.venue)}<br><b>When:</b> ${fmt(e.starts_at)}<br><b>Price:</b> ₹${Number(e.price).toFixed(2)}<br><b>Seats:</b> ${e.rows*e.cols}</div><br><a class="btn" href="#event/${e.id}">View seats</a></article>`).join("")}</div>`:'<div class="empty">No upcoming events yet.</div>'}`);
}
async function createPage(){
 if(!currentUser){location.hash="#login";return}
 render(`<div class="form-card"><h2>Create event</h2><div id="err"></div><label>Title</label><input id="title"><label>Description</label><textarea id="description"></textarea><label>Venue</label><input id="venue"><label>Date & time</label><input id="starts" type="datetime-local"><label>Ticket price</label><input id="price" type="number" min="0" step="0.01" value="0"><div class="row"><div><label>Rows (1–20)</label><input id="rows" type="number" min="1" max="20" value="5"></div><div><label>Columns (1–20)</label><input id="cols" type="number" min="1" max="20" value="10"></div></div><button class="btn" onclick="createNewEvent()">Create event</button></div>`);
}
async function createNewEvent(){
 const title=document.getElementById("title").value.trim(), description=document.getElementById("description").value.trim(), venue=document.getElementById("venue").value.trim(), starts=document.getElementById("starts").value, price=Number(document.getElementById("price").value), rows=Number(document.getElementById("rows").value), cols=Number(document.getElementById("cols").value);
 const err=document.getElementById("err");
 if(!title||!venue||!starts){err.innerHTML='<div class="error">Title, venue, and date/time are required.</div>';return}
 if(new Date(starts)<=new Date()){err.innerHTML='<div class="error">Event date and time must be in the future.</div>';return}
 if(price<0||!Number.isFinite(price)){err.innerHTML='<div class="error">Price must be 0 or more.</div>';return}
 if(rows<1||rows>20||cols<1||cols>20){err.innerHTML='<div class="error">Rows and columns must be between 1 and 20.</div>';return}
 const {data,error}=await sb.rpc("create_event_with_seats",{p_title:title,p_description:description,p_venue:venue,p_starts_at:new Date(starts).toISOString(),p_price:price,p_rows:rows,p_cols:cols});
 if(error){err.innerHTML=`<div class="error">${esc(error.message)}</div>`;return}
 location.hash="#event/"+data;
}
async function eventPage(id){
 if(needConfig())return;
 const {data:e,error:ee}=await sb.from("events").select("*").eq("id",id).single();
 if(ee){render(`<div class="error">${esc(ee.message)}</div>`);return}
 const {data:seats,error}=await sb.from("seats").select("*").eq("event_id",id).order("label");
 if(error){render(`<div class="error">${esc(error.message)}</div>`);return}
 const {data:booked}=await sb.from("bookings").select("seat_id").eq("event_id",id).eq("status","booked");
 const bookedIds=new Set((booked||[]).map(x=>x.seat_id)); selectedSeats=[];
 render(`<section class="panel"><h2>${esc(e.title)}</h2><p>${esc(e.description)}</p><p class="event-meta"><b>${esc(e.venue)}</b><br>${fmt(e.starts_at)} · ₹${Number(e.price).toFixed(2)} per seat</p><div class="legend"><span><i class="dot available"></i>Available</span><span><i class="dot bookeddot"></i>Booked</span><span><i class="dot selecteddot"></i>Selected</span></div><div class="seat-map" style="grid-template-columns:repeat(${e.cols},minmax(42px,1fr))">${seats.map(s=>`<button class="seat ${bookedIds.has(s.id)?"booked":""}" ${bookedIds.has(s.id)?"disabled":""} data-id="${s.id}" data-label="${esc(s.label)}" onclick="toggleSeat(this)">${esc(s.label)}</button>`).join("")}</div><p>Selected: <b id="selectedCount">0</b>/4</p><div id="bookErr"></div><button class="btn" onclick="bookSeats('${id}')">Confirm booking</button></section>`);
}
function toggleSeat(btn){if(!currentUser){location.hash="#login";return}const id=btn.dataset.id;if(btn.classList.contains("selected")){btn.classList.remove("selected");selectedSeats=selectedSeats.filter(x=>x.id!==id)}else{if(selectedSeats.length>=4){toast("You can select a maximum of 4 seats.");return}btn.classList.add("selected");selectedSeats.push({id,label:btn.dataset.label})}document.getElementById("selectedCount").textContent=selectedSeats.length}
async function bookSeats(eventId){
 if(!currentUser){location.hash="#login";return}
 if(selectedSeats.length<1){document.getElementById("bookErr").innerHTML='<div class="error">Select at least one seat.</div>';return}
 const {data,error}=await sb.rpc("book_seats",{p_event_id:eventId,p_seat_ids:selectedSeats.map(x=>x.id)});
 if(error){document.getElementById("bookErr").innerHTML=`<div class="error">${esc(error.message)}</div>`;await eventPage(eventId);return}
 toast("Booking confirmed!");
 location.hash="#bookings";
}
async function bookingsPage(){
 if(!currentUser){location.hash="#login";return}
 const {data,error}=await sb.from("bookings").select("id,seat_id,event_id,status,created_at,events(title,venue,starts_at),seats(label)").order("created_at",{ascending:false});
 if(error){render(`<div class="error">${esc(error.message)}</div>`);return}
 render(`<section class="hero"><h2>My Bookings</h2></section>${data?.length?data.map(b=>`<div class="card" style="margin-bottom:12px"><h3>${esc(b.events.title)}</h3><p>${esc(b.events.venue)} · ${fmt(b.events.starts_at)}</p><p>Seat <b>${esc(b.seats.label)}</b> · <span>${esc(b.status)}</span></p>${b.status==="booked"&&new Date(b.events.starts_at)>new Date()?`<button class="btn danger" onclick="cancelBooking('${b.id}')">Cancel</button>`:""}</div>`).join(""):'<div class="empty">You have no bookings.</div>'}`);
}
async function cancelBooking(id){const {error}=await sb.rpc("cancel_booking",{p_booking_id:id});if(error){toast(error.message);return}toast("Booking cancelled.");bookingsPage();}
async function dashboard(id){
 if(!currentUser){location.hash="#login";return}
 const {data:e,error:ee}=await sb.from("events").select("*").eq("id",id).eq("owner_id",currentUser.id).single();
 if(ee){render(`<div class="error">You can only view dashboards for events you created.</div>`);return}
 const {data:b,error}=await sb.from("bookings").select("id,status,created_at,user_id,seats(label)").eq("event_id",id).eq("status","booked").order("created_at",{ascending:false});
 if(error){render(`<div class="error">${esc(error.message)}</div>`);return}
 const sold=b?.length||0, revenue=sold*Number(e.price);
 render(`<section class="hero"><h2>Organizer dashboard</h2><h3>${esc(e.title)}</h3><div class="stats"><div class="stat"><b>${sold}</b>Seats sold</div><div class="stat"><b>₹${revenue.toFixed(2)}</b>Revenue</div></div></section><section class="panel"><h3>Attendees</h3>${b?.length?b.map(x=>`<div class="attendee">Seat <b>${esc(x.seats.label)}</b><br><span class="muted">User: ${esc(x.user_id)}</span></div>`).join(""):'<p class="muted">No attendees yet.</p>'}</section>`);
}
async function router(){
 await loadUser();
 const h=location.hash.slice(1)||"events";
 if(h==="login")return login(); if(h==="signup")return signup(); if(h==="events")return eventsPage(); if(h==="create")return createPage(); if(h==="bookings")return bookingsPage();
 if(h.startsWith("event/"))return eventPage(h.split("/")[1]); if(h.startsWith("dashboard/"))return dashboard(h.split("/")[1]);
 eventsPage();
}
window.addEventListener("hashchange",router);
router();
