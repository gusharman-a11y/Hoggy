const fs=require("fs");
global.window={};require("../conferences.js");
let ex=[...window.HOGGY_CONFERENCES];
for(const f of fs.readdirSync("data/shards")){if(f==="exp-asia.json")continue;try{ex.push(...JSON.parse(fs.readFileSync("data/shards/"+f,"utf8")))}catch(e){}}
const C={Yokohama:[35.44,139.64],Kobe:[34.69,135.20],Osaka:[34.69,135.50],Tokyo:[35.68,139.69],Xiamen:[24.48,118.09],Beijing:[39.90,116.41],Tianjin:[39.34,117.36],Seoul:[37.57,126.98],Taipei:[25.03,121.57],"Hong Kong":[22.32,114.17],Jaipur:[26.91,75.79],Hyderabad:[17.39,78.49],Kochi:[9.93,76.27],Bengaluru:[12.97,77.59],"New Delhi":[28.61,77.21],Mumbai:[19.08,72.88],Chennai:[13.08,80.27],Ahmedabad:[23.02,72.57],Singapore:[1.35,103.82],"Kuala Lumpur":[3.14,101.69],Bangkok:[13.76,100.50],Hanoi:[21.03,105.85],"Ho Chi Minh City":[10.82,106.63],Manila:[14.60,120.98],Jakarta:[-6.21,106.85],Karachi:[24.86,67.01],Lahore:[31.55,74.34],Dhaka:[23.81,90.41],Colombo:[6.93,79.86]};
const CN={JP:"Japan",CN:"China",KR:"South Korea",TW:"Taiwan",HK:"Hong Kong",IN:"India",SG:"Singapore",MY:"Malaysia",TH:"Thailand",VN:"Vietnam",PH:"Philippines",ID:"Indonesia",PK:"Pakistan",BD:"Bangladesh",LK:"Sri Lanka"};
const iso=d=>d.toISOString().slice(0,10);
const out=[],drops=[];const ids=new Set();
for(const line of fs.readFileSync("data/work/exp-asia-src.txt","utf8").split("\n")){
 if(!line.trim())continue;const [code,name,org,spec,city,cc,md,span,url,yrs]=line.split("|");
 const years=yrs==="A"?[2027,2028]:[+("20"+yrs)];
 for(const y of years){
  const dup=ex.find(r=>r.countryCode===cc&&(r.start||"").slice(0,4)==y&&((r.organiser||"").toLowerCase()===org.toLowerCase()||(r.id||"").toLowerCase().split("-").includes(code.toLowerCase())||(r.name||"").toLowerCase().split(/\W+/).includes(code.toLowerCase())));
  if(dup){drops.push(code+" "+y+" ~ "+dup.id);continue}
  let d=new Date(`${y}-${md}T00:00:00Z`);const w=d.getUTCDay();if(w===6)d.setUTCDate(d.getUTCDate()+2);if(w===0)d.setUTCDate(d.getUTCDate()+1);
  const e=new Date(d);e.setUTCDate(e.getUTCDate()+ +span-1);
  const [lat,lng]=C[city];if(!lat&&!lng)throw city;
  const id=(code.toLowerCase()+"-"+city.toLowerCase().replace(/\s+/g,"-")+"-"+y+"-expected").replace(/[^a-z0-9-]/g,"");
  if(ids.has(id))throw id;ids.add(id);
  out.push({id,name:`${name} ${y}`,organiser:org,specialty:spec,city,country:CN[cc],countryCode:cc,region:"Asia-Pacific",lat,lng,start:iso(d),end:iso(e),format:"In-person",cpdHours:0,cpdBody:"",priceFrom:0,attendees:0,url,blurb:`${name} organised by ${org}, expected in ${city} (host city is the usual venue and may rotate). Dates expected; not yet announced.`,datesConfirmed:false,sourceUrl:url});
 }}
fs.writeFileSync("data/shards/exp-asia.json",JSON.stringify(out,null,1));
console.log(out.length,"rows; dropped",drops.length);console.log(drops.join("\n"));
