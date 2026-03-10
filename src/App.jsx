import { useState, useEffect } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const C = {
  olive:"#45543B", oliveL:"#45543B", terra:"#9D6D58", clay:"#A27D67",
  cream:"#F5F3EF", warm:"#EFEBE7", charcoal:"#332D28", muted:"#766960",
  white:"#FFFFFF", neutral:"#DED7CF",
};
const FONT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const FONT_BODY    = "'Source Sans Pro', 'Helvetica Neue', sans-serif";

// ─── Questions & categories ───────────────────────────────────────────────────
const QUESTIONS = [
  { id:1,  text:"In ons team houden mensen soms bewust informatie achter." },
  { id:2,  text:"Niet iedereen spreekt zich uit omdat men twijfelt hoe anderen zullen reageren." },
  { id:3,  text:"In ons team wordt verantwoordelijkheid regelmatig doorgeschoven." },
  { id:4,  text:"Als iets blijft liggen is het vaak onduidelijk wie het eigenlijk moet oppakken." },
  { id:5,  text:"Initiatief komt meestal van een paar mensen terwijl anderen afwachten." },
  { id:6,  text:"We werken regelmatig langs elkaar heen zonder dat iemand dat echt benoemt." },
  { id:7,  text:"Er wordt soms meer over elkaar gesproken dan met elkaar." },
  { id:8,  text:"Niet iedereen in het team weet precies waar we samen naartoe werken." },
  { id:9,  text:"Besluiten worden genomen maar daarna niet altijd echt gedragen." },
  { id:10, text:"We praten soms langer over problemen dan dat we ze oplossen." },
  { id:11, text:"Goede ideeën blijven regelmatig hangen in overleg." },
  { id:12, text:"Het voelt soms alsof het team harder zou kunnen gaan dan nu gebeurt." },
];
const CATEGORIES = {
  Vertrouwen:[1,2], Eigenaarschap:[3,4,5], Samenwerking:[6,7], Richting:[8,9], Tempo:[10,11,12],
};

// ─── Storage & API ────────────────────────────────────────────────────────────
function getSessionId() {
  let id = sessionStorage.getItem("tes_sid");
  if (!id) { id = Math.random().toString(36).slice(2,10); sessionStorage.setItem("tes_sid", id); }
  return id;
}
function generateTeamCode() {
  return "TEAM-" + Math.floor(1000 + Math.random() * 9000);
}
function generateOwnerToken() {
  return Math.random().toString(36).slice(2,10) + Math.random().toString(36).slice(2,10);
}

// API calls naar Vercel serverless functions
async function apiCreateTeam(teamData) {
  const res = await fetch("/api/teams", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify(teamData),
  });
  if (!res.ok) throw new Error("Aanmaken team mislukt");
  return res.json();
}
async function apiGetTeam(teamCode) {
  try {
    const res = await fetch("/api/teams?code=" + teamCode);
    if (!res.ok) return null;
    return res.json();
  } catch(e) { return null; }
}
async function apiSaveEntry(teamCode, sessionId, scores, email) {
  const res = await fetch("/api/entries", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ teamCode, sessionId, scores, email }),
  });
  if (!res.ok) throw new Error("Opslaan resultaat mislukt");
  return res.json();
}
async function apiGetEntries(teamCode) {
  try {
    const res = await fetch("/api/entries?code=" + teamCode);
    if (!res.ok) return [];
    return res.json();
  } catch(e) { return []; }
}
async function apiValidateOwner(teamCode, ownerToken) {
  try {
    const res = await fetch("/api/owner?code=" + teamCode + "&token=" + ownerToken);
    if (!res.ok) return false;
    const data = await res.json();
    return data.valid === true;
  } catch(e) { return false; }
}
async function apiSaveEmail(teamCode, sessionId, name, email, wantsTeamAnalysis) {
  const res = await fetch("/api/subscribe", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ teamCode, sessionId, name, email, wantsTeamAnalysis }),
  });
  if (!res.ok) throw new Error("Opslaan email mislukt");
  return res.json();
}

// ─── Score calculations ───────────────────────────────────────────────────────
function calcCategoryScores(answers) {
  const result = {};
  for (const [cat, qIds] of Object.entries(CATEGORIES)) {
    const vals = qIds.map(id => answers[id] || 3);
    result[cat] = parseFloat((vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(2));
  }
  return result;
}
function classifyScore(score) {
  if (score >= 4) return "strength";
  if (score >= 3) return "neutral";
  return "leak";
}
function calcAvgScores(entries) {
  const cats = Object.keys(CATEGORIES);
  const result = {};
  cats.forEach(cat => {
    result[cat] = parseFloat((entries.reduce((acc,e) => acc+(e.scores[cat]||0), 0) / entries.length).toFixed(2));
  });
  return result;
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────
async function fetchAIAnalysis(categoryScores, memberCount, isTeam) {
  memberCount = memberCount || 1;
  isTeam = isTeam || false;
  const lines = Object.entries(categoryScores)
    .map(function(e) {
      const cat = e[0]; const sc = e[1];
      const label = classifyScore(sc)==="leak"?"energielek":classifyScore(sc)==="strength"?"kracht":"neutraal";
      return cat + ": " + sc + "/5 (" + label + ")";
    }).join("\n");
  const context = isTeam
    ? "Dit zijn de GEMIDDELDE scores van " + memberCount + " teamleden."
    : "Dit zijn de scores van één persoon over zijn of haar beleving van het team.";
  const perspective = isTeam
    ? "Schrijf vanuit TEAM-perspectief. Spreek het team als geheel aan."
    : "Schrijf vanuit individueel perspectief. Spreek de invuller direct aan.";
  const prompt = "Je bent een scherpe, eerlijke teamcoach. " + context + "\n\nScores op de Team Energie Spiegel (1-5, 1-2=energielek, 4-5=kracht):\n" + lines + "\n\n" + perspective + "\n\nSchrijf in het Nederlands:\n1. Diagnose (max 4 zinnen)\n2. Wat dit betekent\n3. Wat er gebeurt als er niets verandert\n4. 3 gespreksvragen (genummerd)\n\nToon: eerlijk, scherp, herkenbaar.\n\nAntwoord ALLEEN in JSON (geen markdown backticks):\n{\"diagnose\":\"...\",\"betekenis\":\"...\",\"geenVerandering\":\"...\",\"gespreksvragen\":[\"...\",\"...\",\"...\"]}";

  try {
    const res = await fetch("/api/analyze", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ categoryScores, memberCount, isTeam }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  } catch(e) {
    return {
      diagnose:"Op basis van de antwoorden zien we een team dat hard werkt, maar waar een aantal dynamieken energie kosten.",
      betekenis:"Dit patroon is herkenbaar in veel teams die in een groeifase zitten of onder druk werken.",
      geenVerandering:"Als dit patroon aanhoudt, is de kans groot dat stille frustraties groter worden.",
      gespreksvragen:["Welk onderwerp vermijden we al te lang?","Wie voelt zich het minst gehoord?","Wat zou er veranderen als we écht transparant zouden zijn?"],
    };
  }
}

// ─── Shared UI components ─────────────────────────────────────────────────────
function SectionLabel(props) {
  return <p style={{fontFamily:FONT_BODY,fontSize:11,letterSpacing:"0.12em",textTransform:"uppercase",color:props.color||C.muted,marginBottom:10,marginTop:0}}>{props.children}</p>;
}
function Heading(props) {
  var size = props.size||1;
  var sizes = {1:"clamp(1.9rem,5vw,2.8rem)",2:"clamp(1.3rem,3.5vw,1.9rem)",3:"clamp(1.05rem,2.5vw,1.3rem)"};
  return <h1 style={{fontFamily:FONT_DISPLAY,fontSize:sizes[size],color:props.color||C.charcoal,fontWeight:400,lineHeight:1.25,marginBottom:size===1?18:12,marginTop:0}}>{props.children}</h1>;
}
function Btn(props) {
  var variant = props.variant||"primary";
  var base = {fontFamily:FONT_BODY,fontSize:15,fontWeight:600,padding:"12px 26px",borderRadius:50,border:"none",cursor:props.disabled?"not-allowed":"pointer",transition:"all 0.2s",display:"inline-flex",alignItems:"center",gap:8,opacity:props.disabled?0.45:1};
  var variants = {
    primary:{background:C.olive,color:C.white},
    secondary:{background:C.warm,color:C.charcoal},
    ghost:{background:"transparent",color:C.olive,border:"1.5px solid "+C.olive},
    white:{background:C.white,color:C.charcoal},
    green:{background:"#25D366",color:C.white},
  };
  var style = Object.assign({}, base, variants[variant]||variants.primary, props.style||{});
  return <button onClick={props.disabled?undefined:props.onClick} style={style}>{props.children}</button>;
}
function Card(props) {
  var style = Object.assign({background:C.white,borderRadius:16,border:"1px solid "+C.warm,padding:"22px 26px",boxShadow:"0 2px 20px rgba(44,44,42,0.05)",marginBottom:14}, props.style||{});
  return <div style={style}>{props.children}</div>;
}
function FormInput(props) {
  var [focused, setFocused] = useState(false);
  return <div style={{marginBottom:16}}>
    {props.label && <label style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,display:"block",marginBottom:5}}>{props.label}</label>}
    <input type={props.type||"text"} placeholder={props.placeholder} value={props.value} onChange={function(e){props.onChange(e.target.value);}}
      onFocus={function(){setFocused(true);}} onBlur={function(){setFocused(false);}}
      style={{width:"100%",padding:"11px 15px",borderRadius:10,border:"1.5px solid "+(focused?C.olive:C.warm),fontFamily:FONT_BODY,fontSize:15,color:C.charcoal,background:C.white,outline:"none",boxSizing:"border-box",transition:"border-color 0.2s"}}/>
    {props.hint && <p style={{fontFamily:FONT_BODY,fontSize:12,color:C.muted,marginTop:4,marginBottom:0,lineHeight:1.4}}>{props.hint}</p>}
  </div>;
}
function FaceIcon(props) {
  var type = props.type; var size = props.size||28;
  var cfg = {strength:{color:C.olive,bg:"#E8EDE3"},neutral:{color:C.muted,bg:"#F0EDE6"},leak:{color:C.terra,bg:"#FBF0EA"}};
  var color = cfg[type].color; var bg = cfg[type].bg; var r = size/2;
  var mouth = {
    strength:"M"+(r*.38)+" "+(r*1.28)+"Q"+r+" "+(r*1.62)+" "+(r*1.62)+" "+(r*1.28),
    neutral:"M"+(r*.38)+" "+(r*1.38)+"L"+(r*1.62)+" "+(r*1.38),
    leak:"M"+(r*.38)+" "+(r*1.52)+"Q"+r+" "+(r*1.18)+" "+(r*1.62)+" "+(r*1.52),
  };
  return <svg width={size} height={size} viewBox={"0 0 "+size+" "+size}>
    <circle cx={r} cy={r} r={r} fill={bg}/>
    <circle cx={r-r*.35} cy={r*.72} r={r*.1} fill={color}/>
    <circle cx={r+r*.35} cy={r*.72} r={r*.1} fill={color}/>
    <path d={mouth[type]} stroke={color} strokeWidth={r*.13} strokeLinecap="round" fill="none"/>
  </svg>;
}
function ScorePill(props) {
  var type = classifyScore(props.score);
  var cfg = {leak:{bg:"#FBF0EA",text:C.terra,lbl:"Energielek"},neutral:{bg:"#F5F2EC",text:C.muted,lbl:"Neutraal"},strength:{bg:"#E8EDE3",text:C.olive,lbl:"Kracht"}};
  var c = cfg[type];
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 15px",borderRadius:12,background:c.bg,marginBottom:8}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}><FaceIcon type={type} size={26}/><span style={{fontFamily:FONT_BODY,fontSize:15,color:C.charcoal,fontWeight:500}}>{props.label}</span></div>
    <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontFamily:FONT_BODY,fontSize:12,color:c.text,fontWeight:600}}>{c.lbl}</span><span style={{fontFamily:FONT_BODY,fontSize:14,color:c.text,fontWeight:700}}>{props.score.toFixed(1)}</span></div>
  </div>;
}
function RadarViz(props) {
  var chartData = Object.entries(props.data).map(function(e){return {subject:e[0],A:e[1],fullMark:5};});
  return <ResponsiveContainer width="100%" height={290}>
    <RadarChart data={chartData} margin={{top:14,right:38,bottom:14,left:38}}>
      <PolarGrid stroke={C.warm}/>
      <PolarAngleAxis dataKey="subject" tick={{fontFamily:FONT_BODY,fontSize:12,fill:C.charcoal}}/>
      <Radar dataKey="A" stroke={C.terra} strokeWidth={2} fill={C.terra} fillOpacity={0.2} dot={{fill:C.terra,r:4}}/>
      <Tooltip formatter={function(v){return [v+"/5","Score"];}} contentStyle={{fontFamily:FONT_BODY,fontSize:13,background:C.white,border:"1px solid "+C.warm,borderRadius:8}}/>
    </RadarChart>
  </ResponsiveContainer>;
}
function LoadingDots() {
  return <div style={{display:"flex",justifyContent:"center",gap:6,padding:"20px 0"}}>
    {[0,1,2].map(function(i){return <div key={i} style={{width:8,height:8,borderRadius:"50%",background:C.olive,animation:"pulse 1.2s "+(i*.2)+"s ease-in-out infinite"}}/>;})}</div>;
}
function AnalysisBlock(props) {
  var a = props.analysis; var isTeam = props.isTeam;
  return <div>
    <div style={{marginBottom:18}}>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.05rem",fontWeight:600,color:C.terra,marginBottom:5,marginTop:0}}>{isTeam?"Teamdiagnose":"Diagnose"}</p>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.charcoal,lineHeight:1.7,margin:0}}>{a.diagnose}</p>
    </div>
    <div style={{marginBottom:18}}>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.05rem",fontWeight:600,color:C.charcoal,marginBottom:5,marginTop:0}}>{isTeam?"Wat dit als team betekent":"Wat dit betekent"}</p>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.charcoal,lineHeight:1.7,margin:0}}>{a.betekenis}</p>
    </div>
    <div style={{marginBottom:18,background:"#FBF0EA",borderRadius:12,padding:"13px 17px"}}>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.05rem",fontWeight:600,color:C.terra,marginBottom:5,marginTop:0}}>Als er niets verandert</p>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.charcoal,lineHeight:1.7,margin:0}}>{a.geenVerandering}</p>
    </div>
    {props.cta&&<div style={{margin:"18px 0"}}>{props.cta}</div>}
    <div>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.05rem",fontWeight:600,color:C.olive,marginBottom:10,marginTop:0}}>{isTeam?"Start het teamgesprek":"Start het gesprek"}</p>
      {(a.gespreksvragen||[]).map(function(v,i){return <div key={i} style={{display:"flex",gap:10,marginBottom:10}}>
        <span style={{fontFamily:FONT_BODY,fontSize:13,color:C.olive,fontWeight:700,minWidth:18}}>{i+1}.</span>
        <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.charcoal,lineHeight:1.6,margin:0}}>{v}</p>
      </div>;})}</div>
  </div>;
}
function EmailCapture(props) {
  var [name, setName] = useState("");
  var [email, setEmail] = useState("");
  var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && name.trim().length > 0;
  if (props.submitted) return <div style={{display:"flex",alignItems:"center",gap:10,padding:"13px 17px",background:"#E8EDE3",borderRadius:12}}>
    <span style={{fontSize:16}}>✓</span>
    <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.olive,margin:0,fontWeight:600}}>{props.submittedMsg||"Genoteerd — we sturen je de resultaten zodra ze beschikbaar zijn."}</p>
  </div>;
  return <div>
    {props.label && <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.charcoal,lineHeight:1.6,marginBottom:14,marginTop:0}}>{props.label}</p>}
    <FormInput placeholder="Jouw naam" value={name} onChange={setName}/>
    <FormInput type="email" placeholder="jouw@email.nl" value={email} onChange={setEmail} hint={props.hint||"Je ontvangt geen spam. Alleen jouw resultaten."}/>
    <Btn onClick={function(){props.onSubmit(name,email);}} disabled={!valid}>{props.buttonLabel||"Verstuur"}</Btn>
  </div>;
}
function ProgressBar(props) {
  var pct = (props.current/props.total)*100;
  return <div style={{marginBottom:26}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
      <span style={{fontFamily:FONT_BODY,fontSize:12,color:C.muted,letterSpacing:"0.08em",textTransform:"uppercase"}}>Vraag {props.current} van {props.total}</span>
      <span style={{fontFamily:FONT_BODY,fontSize:12,color:C.muted}}>{Math.round(pct)}%</span>
    </div>
    <div style={{height:3,background:C.warm,borderRadius:2,overflow:"hidden"}}>
      <div style={{height:"100%",width:pct+"%",background:C.olive,borderRadius:2,transition:"width 0.4s ease"}}/>
    </div>
  </div>;
}
function SliderQ(props) {
  var pct = ((props.value-1)/4)*100;
  return <div>
    <p style={{fontFamily:FONT_DISPLAY,fontSize:"clamp(1.1rem,3vw,1.4rem)",color:C.charcoal,lineHeight:1.55,marginBottom:30,fontWeight:400,marginTop:0}}>{props.question.text}</p>
    <div style={{marginBottom:12}}>
      <input type="range" min={1} max={5} step={1} value={props.value} onChange={function(e){props.onChange(parseInt(e.target.value));}}
        style={{width:"100%",WebkitAppearance:"none",appearance:"none",height:4,background:"linear-gradient(to right,"+C.olive+" "+pct+"%,"+C.warm+" "+pct+"%)",borderRadius:2,outline:"none",cursor:"pointer"}}/>
    </div>
    <div style={{display:"flex",justifyContent:"space-between"}}>
      {[1,2,3,4,5].map(function(n){return <div key={n} style={{textAlign:"center",flex:1}}>
        <div style={{width:30,height:30,borderRadius:"50%",margin:"0 auto 4px",display:"flex",alignItems:"center",justifyContent:"center",background:props.value===n?C.olive:C.warm,color:props.value===n?C.white:C.muted,fontFamily:FONT_BODY,fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.2s"}} onClick={function(){props.onChange(n);}}>{n}</div>
        <span style={{fontFamily:FONT_BODY,fontSize:9,color:C.muted,display:"block",lineHeight:1.3}}>{n===1?"Helemaal\nniet":n===3?"Deels":n===5?"Zeer\nherkenbaar":""}</span>
      </div>;})}
    </div>
    <style>{`input[type='range']::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:${C.olive};border:3px solid ${C.white};box-shadow:0 2px 8px rgba(69,84,59,0.3);cursor:pointer}input[type='range']::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:${C.olive};border:3px solid ${C.white};cursor:pointer}`}</style>
  </div>;
}
function SocialProof() {
  var [count, setCount] = useState(null);
  useEffect(function(){
    fetch("/api/stats").then(function(r){ return r.json(); }).then(function(d){ setCount(d.total||0); }).catch(function(){ setCount(0); });
  },[]);
  if(!count||count===0) return null;
  return <div style={{display:"flex",alignItems:"center",gap:10,background:C.warm,borderRadius:12,padding:"9px 15px",marginBottom:18,alignSelf:"flex-start",width:"fit-content"}}>
    <div style={{display:"flex"}}>{["#8A9E6A","#5C6B3A","#45543B"].slice(0,Math.min(count,3)).map(function(bg,i){return <div key={i} style={{width:24,height:24,borderRadius:"50%",background:bg,border:"2px solid "+C.cream,marginLeft:i>0?-7:0}}/>;})}</div>
    <span style={{fontFamily:FONT_BODY,fontSize:14,color:C.charcoal}}><strong>{count}</strong> {count===1?"persoon deed":"mensen deden"} al de spiegel</span>
  </div>;
}

// ─── TEAM CODE PAGE ───────────────────────────────────────────────────────────
function TeamCodePage(props) {
  var [teamCode, setTeamCode] = useState("");
  var [showInput, setShowInput] = useState(false);
  var inputCode = teamCode.trim().toUpperCase();
  var isValid = /^TEAM-\d{4}$/.test(inputCode);

  return <div style={{maxWidth:560,margin:"0 auto",padding:"clamp(28px,6vw,72px) 24px"}}>
    {/* Logo */}
    <div style={{background:C.olive,margin:"0 -24px",padding:"22px 24px",marginBottom:48}}>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:34,color:"#F5F3EF",letterSpacing:"0.08em",fontWeight:400,textTransform:"uppercase",margin:"0 0 4px"}}>Erik van Dongen</p>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:"rgba(245,243,239,0.75)",letterSpacing:"0.03em",margin:"0 0 2px"}}>Van inzicht naar beweging</p>
      <p style={{fontFamily:FONT_BODY,fontSize:12,color:"rgba(245,243,239,0.5)",letterSpacing:"0.04em",margin:0}}>erikvandongen.eu</p>
    </div>

    <SectionLabel>Team Energie Spiegel</SectionLabel>
    <Heading size={2}>Doe je mee als onderdeel van een team?</Heading>
    <p style={{fontFamily:FONT_BODY,fontSize:16,color:C.muted,lineHeight:1.7,marginBottom:40,marginTop:0}}>Als je een teamcode hebt ontvangen, vul die dan hieronder in. Zo worden jouw antwoorden gekoppeld aan jullie team.</p>

    {!showInput
      ? <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Btn onClick={function(){setShowInput(true);}} style={{width:"100%",justifyContent:"center",fontSize:16,padding:"16px 24px"}}>
            Ja, ik heb een teamcode
          </Btn>
          <Btn variant="ghost" onClick={function(){props.onStart(null);}} style={{width:"100%",justifyContent:"center",fontSize:16,padding:"16px 24px",border:"1.5px solid "+C.warm}}>
            Nee, ik doe het individueel →
          </Btn>
        </div>
      : <div>
          <div style={{background:C.white,border:"1.5px solid "+(isValid?C.olive:C.warm),borderRadius:14,padding:"20px 24px",marginBottom:16}}>
            <p style={{fontFamily:FONT_BODY,fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",color:C.muted,marginBottom:10,marginTop:0}}>Jouw teamcode</p>
            <input type="text" placeholder="TEAM-0000" value={teamCode} onChange={function(e){
              var v = e.target.value.toUpperCase();
              if(!v.startsWith("TEAM-")) v = "TEAM-";
              if(v.length > 9) v = v.slice(0,9);
              setTeamCode(v);
            }} autoFocus
              style={{width:"100%",boxSizing:"border-box",padding:"12px 16px",borderRadius:8,border:"1.5px solid "+C.warm,fontFamily:FONT_BODY,fontSize:20,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:C.charcoal,background:C.cream,outline:"none"}}/>
            {isValid&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:10}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:C.olive}}/>
              <span style={{fontFamily:FONT_BODY,fontSize:13,color:C.olive,fontWeight:600}}>Teamcode herkend</span>
            </div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Btn onClick={function(){if(isValid) props.onStart(inputCode);}} style={{width:"100%",justifyContent:"center",fontSize:16,padding:"16px 24px",opacity:isValid?1:0.5}}>
              Start met teamcode →
            </Btn>
            <button onClick={function(){setShowInput(false); setTeamCode("");}} style={{background:"none",border:"none",cursor:"pointer",fontFamily:FONT_BODY,fontSize:14,color:C.muted,textDecoration:"underline",textUnderlineOffset:3,padding:"8px 0"}}>
              ← Toch individueel doen
            </button>
          </div>
        </div>
    }
  </div>;
}

// ─── START PAGE ───────────────────────────────────────────────────────────────
function StartPage(props) {
  var inviteContext = props.inviteContext;
  var [teamCode, setTeamCode] = useState((inviteContext&&inviteContext.code)||"TEAM-");
  var [showField, setShowField] = useState(!!(inviteContext&&inviteContext.code));
  var inputCode = teamCode.trim().toUpperCase();
  var isValid = /^TEAM-\d{4}$/.test(inputCode);

  return <div style={{maxWidth:680,margin:"0 auto",padding:"clamp(28px,6vw,72px) 24px"}}>
    {/* Logo */}
    <div style={{background:C.olive,margin:"0 -24px",padding:"22px 24px",marginBottom:40}}>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:34,color:"#F5F3EF",letterSpacing:"0.08em",fontWeight:400,textTransform:"uppercase",margin:"0 0 4px"}}>Erik van Dongen</p>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:"rgba(245,243,239,0.75)",letterSpacing:"0.03em",margin:"0 0 2px"}}>Van inzicht naar beweging</p>
      <p style={{fontFamily:FONT_BODY,fontSize:12,color:"rgba(245,243,239,0.5)",letterSpacing:"0.04em",margin:0}}>erikvandongen.eu</p>
    </div>

    {/* Invite banner */}
    {inviteContext&&inviteContext.code&&<div style={{background:C.olive,borderRadius:16,padding:"20px 24px",marginBottom:28}}>
      <p style={{fontFamily:FONT_BODY,fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",color:"#b8c9a3",marginBottom:5,marginTop:0}}>Je bent uitgenodigd</p>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.35rem",color:C.white,marginBottom:3,marginTop:0}}>Team Energie Spiegel</p>
      <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.12)",borderRadius:8,padding:"7px 14px",marginBottom:8}}>
        <span style={{fontFamily:FONT_BODY,fontSize:13,color:C.white}}>Teamcode:</span>
        <strong style={{fontFamily:FONT_BODY,fontSize:15,letterSpacing:"0.1em",color:C.white}}>{inviteContext.code}</strong>
      </div>
      <p style={{fontFamily:FONT_BODY,fontSize:13,color:"rgba(200,212,168,0.85)",marginTop:4,marginBottom:0}}>✓ Jouw teamcode is automatisch ingevuld. Klik hieronder om direct te starten.</p>
    </div>}

    <SectionLabel>Team Energie Spiegel</SectionLabel>
    <Heading size={1}>Waar zit de energie in jouw team en waar lekt die weg?</Heading>
    <p style={{fontFamily:FONT_BODY,fontSize:17,color:C.muted,marginBottom:32,lineHeight:1.7,marginTop:0}}>In 12 vragen krijg je een helder beeld van wat jullie team drijft en wat het vertraagt. Concreet, anoniem en direct bruikbaar als gespreksstarter.</p>

    <div style={{background:C.warm,borderRadius:16,padding:"22px 26px",marginBottom:32}}>
      <p style={{fontFamily:FONT_BODY,fontSize:15,color:C.charcoal,lineHeight:1.8,marginBottom:12,marginTop:0}}>Teams werken hard. Er worden plannen gemaakt, doelen gesteld en overleggen gepland. En toch voelt het soms alsof er iets blijft hangen.</p>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.05rem",color:C.charcoal,marginBottom:14,fontStyle:"italic",marginTop:0}}>Met deze korte spiegel ontdek je:</p>
      {["Waar energie in je team weglekt","Waar juist kracht zit","Waar de volgende stap voor jullie team ligt"].map(function(item,i){return <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:7}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:C.terra,marginTop:7,flexShrink:0}}/>
        <span style={{fontFamily:FONT_BODY,fontSize:15,color:C.charcoal}}>{item}</span>
      </div>;})}
    </div>

    <div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap",marginBottom:22}}>
      <Btn onClick={function(){props.onStart(null);}}>Start de Team Energie Spiegel</Btn>
      <span style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted}}>⏱ 3 minuten · 12 vragen</span>
    </div>
    <SocialProof/>
    <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,lineHeight:1.6,marginTop:4}}>Geen registratie nodig · Direct starten · Anoniem</p>

    {props.onDemo&&<div style={{marginTop:36,paddingTop:24,borderTop:"1px solid "+C.warm}}>
      <p style={{fontFamily:FONT_BODY,fontSize:12,letterSpacing:"0.08em",textTransform:"uppercase",color:C.muted,marginBottom:8,marginTop:0}}>Voor teamaanmakers</p>
      <button onClick={props.onDemo} style={{background:"none",border:"none",padding:0,cursor:"pointer",fontFamily:FONT_BODY,fontSize:14,color:C.olive,textDecoration:"underline",textUnderlineOffset:3}}>
        Bekijk een voorbeeldweergave van het beheerdersdashboard →
      </button>
    </div>}
  </div>;
}

// ─── QUESTIONS PAGE ───────────────────────────────────────────────────────────
function QuestionsPage(props) {
  var [current, setCurrent] = useState(0);
  var [answers, setAnswers] = useState({});
  var [value, setValue] = useState(3);
  var q = QUESTIONS[current];
  useEffect(function(){ setValue(answers[q.id]||3); },[current]);

  function handleNext() {
    var updated = Object.assign({}, answers);
    updated[q.id] = value;
    setAnswers(updated);
    if(current<QUESTIONS.length-1){ setCurrent(function(c){return c+1;}); }
    else { sessionStorage.setItem("tes_completed","true"); props.onComplete(updated); }
  }
  function handlePrev() { if(current>0) setCurrent(function(c){return c-1;}); }

  return <div style={{maxWidth:640,margin:"0 auto",padding:"clamp(22px,5vw,56px) 24px"}}>
    <ProgressBar current={current+1} total={12}/>
    <div style={{minHeight:290,display:"flex",flexDirection:"column",justifyContent:"center"}}>
      <SliderQ question={q} value={value} onChange={setValue}/>
    </div>
    <div style={{display:"flex",justifyContent:"space-between",marginTop:32,alignItems:"center"}}>
      <Btn variant="ghost" onClick={handlePrev} style={{opacity:current===0?0.3:1}}>← Vorige</Btn>
      <Btn onClick={handleNext}>{current===QUESTIONS.length-1?"Bekijk resultaat →":"Volgende →"}</Btn>
    </div>
  </div>;
}

// ─── EMAIL DROPDOWN ──────────────────────────────────────────────────────────
function EmailDropdown(props) {
  var [open, setOpen] = useState(false);
  var [name, setName] = useState("");
  var [email, setEmail] = useState("");
  var [error, setError] = useState("");

  function handleSubmit() {
    if(!name.trim()){ setError("Vul je naam in."); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ setError("Vul een geldig e-mailadres in."); return; }
    props.onSubmit(name.trim(), email.trim());
  }

  return <div style={{marginBottom:16}}>
    <button onClick={function(){setOpen(function(o){return !o;});}} style={{display:"flex",alignItems:"center",gap:10,background:open?C.warm:C.olive,border:"none",borderRadius:open?"16px 16px 0 0":50,padding:"14px 22px",cursor:"pointer",fontFamily:FONT_BODY,fontSize:15,fontWeight:600,color:open?C.charcoal:C.white,width:"100%",justifyContent:"space-between",transition:"all 0.2s"}}>
      <span>Ontvang de analyse per e-mail</span>
      <span style={{fontSize:16,transform:open?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>↓</span>
    </button>
    {open&&<div style={{background:C.warm,borderRadius:"0 0 16px 16px",padding:"20px 20px 16px",border:"1.5px solid "+C.neutral,borderTop:"none",marginTop:-2}}>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:14,marginTop:0}}>
        {props.canReceiveTeamAnalysis
          ? "Laat je gegevens achter en ontvang jouw individuele analyse én de teamanalyse zodra iedereen klaar is."
          : "Laat je gegevens achter en ontvang jouw individuele analyse. Volledig vrijblijvend."}
      </p>
      <FormInput label="Jouw naam" placeholder="Erik van Dongen" value={name} onChange={setName}/>
      <FormInput label="Jouw e-mailadres" type="email" placeholder="jouw@email.nl" value={email} onChange={setEmail} hint={props.canReceiveTeamAnalysis ? "Je ontvangt jouw analyse én de teamanalyse. Jouw antwoorden blijven anoniem." : "Alleen jouw individuele analyse. Geen spam."}/>
      {error&&<p style={{fontFamily:FONT_BODY,fontSize:13,color:C.terra,marginBottom:10,marginTop:0}}>{error}</p>}
      <Btn onClick={handleSubmit}>Stuur mij mijn resultaten</Btn>
    </div>}
  </div>;
}

// ─── ANALYSIS PAGE ────────────────────────────────────────────────────────────
function AnalysisPage(props) {
  var answers = props.answers;
  var prefilledCode = props.prefilledCode;
  var [analysis, setAnalysis] = useState(null);
  var [loading, setLoading] = useState(true);
  var [emailSubmitted, setEmailSubmitted] = useState(false);
  var catScores = calcCategoryScores(answers);
  var [meta, setMeta] = useState(null);
  var canReceiveTeamAnalysis = meta&&meta.shareWithAll;

  useEffect(function(){
    fetchAIAnalysis(catScores, 1, false).then(function(a){ setAnalysis(a); setLoading(false); });
    if(prefilledCode) apiGetTeam(prefilledCode).then(function(m){ if(m) setMeta(m); });
  },[]);

  return <div style={{maxWidth:640,margin:"0 auto",padding:"clamp(22px,5vw,56px) 24px"}}>
    <SectionLabel>Jouw individuele resultaat</SectionLabel>
    <Heading size={2}>Jouw teampatroon in beeld</Heading>

    {/* Context note for team members */}
    {prefilledCode&&meta&&<div style={{background:C.warm,borderRadius:12,padding:"13px 17px",marginBottom:16,display:"flex",alignItems:"flex-start",gap:10}}>
      <div style={{width:7,height:7,borderRadius:"50%",background:C.olive,flexShrink:0,marginTop:5}}/>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.charcoal,margin:0,lineHeight:1.6}}>
        Dit is jouw <strong>individuele analyse</strong> — gebaseerd op jouw eigen antwoorden.
        Jouw antwoorden zijn <strong>anoniem</strong> en worden samengevoegd met die van je teamgenoten voor het teamgemiddelde.
      </p>
    </div>}

    <Card>
      <SectionLabel>Energie per dimensie</SectionLabel>
      <RadarViz data={catScores}/>
    </Card>

    <Card>
      <SectionLabel>Scores per categorie</SectionLabel>
      {Object.entries(catScores).map(function(e){return <ScorePill key={e[0]} label={e[0]} score={e[1]}/>;})}</Card>

    <Card style={{background:C.warm,border:"none"}}>
      <SectionLabel>Analyse · individueel</SectionLabel>
      {loading ? <><p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,margin:0}}>Analyse wordt gegenereerd...</p><LoadingDots/></> : analysis&&<AnalysisBlock analysis={analysis} isTeam={false} cta={
        !emailSubmitted
          ? <EmailDropdown canReceiveTeamAnalysis={canReceiveTeamAnalysis} onSubmit={function(name,email){
              apiSaveEmail(prefilledCode||"", getSessionId(), name, email, canReceiveTeamAnalysis).finally(function(){ setEmailSubmitted(true); });
            }}/>
          : <div style={{display:"flex",alignItems:"center",gap:10,padding:"13px 17px",background:"#E8EDE3",borderRadius:12}}>
              <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.olive,fontWeight:600,margin:0}}>Genoteerd ✓ je ontvangt je resultaten per e-mail.</p>
            </div>
      }/>}
    </Card>

    <Card>
      <SectionLabel>Reflectievragen voor je team</SectionLabel>
      {["Waar wachten wij in dit team eigenlijk op elkaar?","Welke verantwoordelijkheid is nu eigenlijk van niemand?","Welk gesprek stellen we al te lang uit?"].map(function(q,i){return <div key={i} style={{padding:"10px 0",borderBottom:i<2?"1px solid "+C.warm:"none"}}>
        <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.05rem",color:C.charcoal,lineHeight:1.5,margin:0,fontStyle:"italic"}}>{q}</p>
      </div>;})}
    </Card>



    {/* CTA */}
    <Card style={{background:C.olive,border:"none"}}>
      <div style={{display:"inline-block",background:"rgba(255,255,255,0.12)",borderRadius:20,padding:"3px 13px",marginBottom:16}}>
        <span style={{fontFamily:FONT_BODY,fontSize:11,color:"#c0d4a8",letterSpacing:"0.1em",textTransform:"uppercase"}}>Van diagnose naar beweging</span>
      </div>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"clamp(1.3rem,3.5vw,1.75rem)",color:C.white,marginBottom:16,marginTop:0,lineHeight:1.3}}>Je weet nu waar energie lekt in jullie team.</p>
      <p style={{fontFamily:FONT_BODY,fontSize:15,color:"#b8c9a3",marginBottom:12,lineHeight:1.75,marginTop:0}}>In bijna ieder team zijn de intenties goed. Toch ontstaan er irritaties die steeds terugkomen. Niet omdat mensen onprofessioneel zijn, maar omdat verschillen in tempo, stijl en prioriteit onbewust botsen.</p>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.15rem",color:C.white,marginBottom:12,marginTop:0,fontWeight:400,fontStyle:"italic"}}>En precies daar zit de kans.</p>
      <p style={{fontFamily:FONT_BODY,fontSize:15,color:"#b8c9a3",marginBottom:28,lineHeight:1.75,marginTop:0}}>In een vrijblijvend gesprek kijk ik met je mee naar de uitkomsten en verkennen we hoe wat nu wrijving geeft, kan uitgroeien tot de kracht van jullie team.</p>
      <Btn variant="white" onClick={function(){window.open("https://erikvandongen.eu/inzicht-in-teamdynamiek","_blank");}} style={{fontSize:15,padding:"14px 28px"}}>Plan een vrijblijvend intakegesprek</Btn>
      <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:5,alignItems:"flex-start"}}>
        <p style={{fontFamily:FONT_BODY,fontSize:13,color:"#b8c9a3",margin:0}}>📞 +31 (0)6 22 56 51 28</p>
        <p style={{fontFamily:FONT_BODY,fontSize:13,color:"#b8c9a3",margin:0}}>✉ erik@erikvandongen.eu</p>
      </div>
    </Card>

    <p style={{fontFamily:FONT_BODY,fontSize:12,color:C.neutral,textAlign:"center",marginTop:22,marginBottom:80,lineHeight:1.6}}>De analyse wordt ondersteund door AI en gebaseerd op jouw antwoorden. De uitkomst is bedoeld als reflectie en gesprekstarter.</p>

    {/* Floating CTA */}
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:200,padding:"16px 24px",background:"linear-gradient(to top, rgba(245,240,232,1) 60%, rgba(245,240,232,0))",pointerEvents:"none"}}>
      <div style={{maxWidth:640,margin:"0 auto",pointerEvents:"all"}}>
        {prefilledCode
          ? <div style={{background:C.olive,borderRadius:16,padding:"18px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,boxShadow:"0 4px 24px rgba(69,84,59,0.25)",flexWrap:"wrap"}}>
              <div>
                <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.1rem",color:C.white,margin:"0 0 2px",lineHeight:1.3}}>Klaar met invullen?</p>
                <p style={{fontFamily:FONT_BODY,fontSize:13,color:"#b8c9a3",margin:0}}>Voeg jouw antwoorden toe aan het team.</p>
              </div>
              <Btn variant="white" onClick={props.onDone} style={{flexShrink:0,fontSize:15,whiteSpace:"nowrap"}}>Resultaten indienen →</Btn>
            </div>
          : <div style={{background:C.olive,borderRadius:16,padding:"18px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,boxShadow:"0 4px 24px rgba(69,84,59,0.25)",flexWrap:"wrap"}}>
              <div>
                <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.1rem",color:C.white,margin:"0 0 2px",lineHeight:1.3}}>Laat je team ook de spiegel invullen</p>
                <p style={{fontFamily:FONT_BODY,fontSize:13,color:"#b8c9a3",margin:0}}>Zie waar jullie beleving overeenkomt — en waar niet.</p>
              </div>
              <Btn variant="white" onClick={props.onDone} style={{flexShrink:0,fontSize:15,whiteSpace:"nowrap"}}>Vergelijk met je team →</Btn>
            </div>
        }
      </div>
    </div>
    <style>{`@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1)}}`}</style>
  </div>;
}

// ─── TEAM PAGE ────────────────────────────────────────────────────────────────
function TeamPage(props) {
  var answers = props.answers;
  var prefilledCode = props.prefilledCode;
  var catScores = calcCategoryScores(answers);

  var [step, setStep] = useState(prefilledCode ? "view" : "intro");
  var [teamCode, setTeamCode] = useState(prefilledCode||"");
  var [teamData, setTeamData] = useState([]);

  // Create form
  var [ownerName, setOwnerName] = useState("");
  var [ownerEmail, setOwnerEmail] = useState("");
  var [companyName, setCompanyName] = useState("");
  var [teamName, setTeamName] = useState("");
  var [memberCount, setMemberCount] = useState("");
  var [deadlineDays, setDeadlineDays] = useState("7");
  var [shareWithAll, setShareWithAll] = useState(null);
  var [formError, setFormError] = useState("");

  // Join
  var [joinCode, setJoinCode] = useState("TEAM-");

  // Team analysis
  var [teamAnalysis, setTeamAnalysis] = useState(null);
  var [teamAnalysisLoading, setTeamAnalysisLoading] = useState(false);
  var [teamAnalysisLoaded, setTeamAnalysisLoaded] = useState(false);
  var [teamEmailSubmitted, setTeamEmailSubmitted] = useState(false);
  // Store generated token + meta directly so share step doesn't depend on async state
  var [createdToken, setCreatedToken] = useState(null);
  var [createdMeta, setCreatedMeta] = useState(null);

  var [meta, setMeta] = useState(null);

  useEffect(function(){
    if(prefilledCode){
      apiSaveEntry(prefilledCode, getSessionId(), catScores, null).then(function(){
        return apiGetEntries(prefilledCode);
      }).then(function(entries){ setTeamData(entries); });
      apiGetTeam(prefilledCode).then(function(m){ if(m) setMeta(m); });
    }
  },[]);

  useEffect(function(){
    if(teamCode && !meta){
      apiGetTeam(teamCode).then(function(m){ if(m) setMeta(m); });
    }
  },[teamCode]);

  function avg() { return teamData.length ? calcAvgScores(teamData) : catScores; }

  var completed = teamData.length;
  var target = (meta&&meta.memberCount)||0;
  var progressPct = target ? Math.min((completed/target)*100,100) : 0;
  var deadlineDate = meta ? new Date(meta.createdAt+meta.deadlineDays*86400000).toLocaleDateString("nl-NL",{day:"numeric",month:"long"}) : "";

  var inviteLink = "https://spiegel.erikvandongen.eu?team=" + teamCode;
  var shareMsg = meta
    ? meta.ownerName+" nodigt je uit voor de Team Energie Spiegel van team "+meta.teamName+".\n\nOpen deze link — de teamcode wordt automatisch ingevuld:\n"+inviteLink+"\n\nOf gebruik code "+teamCode+" op erikvandongen.eu/spiegel"
    : "Doe de Team Energie Spiegel met teamcode "+teamCode+": "+inviteLink;

  async function handleCreate() {
    if(!ownerName.trim()){ setFormError("Vul jouw naam in."); return; }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)){ setFormError("Vul een geldig e-mailadres in."); return; }
    if(!teamName.trim()){ setFormError("Vul een teamnaam in."); return; }
    if(!memberCount||parseInt(memberCount)<2){ setFormError("Vul het aantal teamleden in (minimaal 2)."); return; }
    if(shareWithAll===null){ setFormError("Kies wie de teamanalyse mag ontvangen."); return; }
    setFormError("Bezig met aanmaken...");
    var code = generateTeamCode();
    var token = generateOwnerToken();
    var m = {ownerName:ownerName.trim(),ownerEmail:ownerEmail.trim(),teamName:teamName.trim(),memberCount:parseInt(memberCount),deadlineDays:parseInt(deadlineDays)||7,shareWithAll:shareWithAll,ownerToken:token,createdAt:Date.now()};
    try {
      await apiCreateTeam({teamCode:code,teamName:m.teamName,ownerName:m.ownerName,ownerEmail:m.ownerEmail,companyName:companyName.trim(),memberCount:m.memberCount,deadlineDays:m.deadlineDays,shareWithAll:m.shareWithAll,ownerToken:token});
      await apiSaveEntry(code, getSessionId(), catScores, ownerEmail.trim());
      var entries = await apiGetEntries(code);
      setFormError("");
      setCreatedToken(token);
      setCreatedMeta(m);
      setMeta(m);
      setTeamCode(code);
      setTeamData(entries);
      setStep("share");
    } catch(e) {
      setFormError("Er ging iets mis bij het aanmaken. Probeer opnieuw.");
    }
  }
  async function handleJoin() {
    var code = joinCode.trim().toUpperCase();
    if(!/^TEAM-\d{4}$/.test(code)) return;
    try {
      await apiSaveEntry(code, getSessionId(), catScores, null);
      var entries = await apiGetEntries(code);
      var teamMeta = await apiGetTeam(code);
      setTeamCode(code);
      setTeamData(entries);
      if(teamMeta) setMeta(teamMeta);
      setStep("view");
    } catch(e) {
      console.error("Join error:", e);
    }
  }
  async function handleTeamAnalysis() {
    setTeamAnalysisLoading(true);
    var result = await fetchAIAnalysis(avg(), teamData.length, true);
    setTeamAnalysis(result);
    setTeamAnalysisLoading(false);
    setTeamAnalysisLoaded(true);
  }

  return <div style={{maxWidth:640,margin:"0 auto",padding:"clamp(22px,5vw,56px) 24px"}}>
    <button onClick={props.onBack} style={{background:"none",border:"none",cursor:"pointer",fontFamily:FONT_BODY,fontSize:14,color:C.muted,marginBottom:24,padding:0,display:"flex",alignItems:"center",gap:6}}>← Terug naar jouw resultaat</button>

    {/* INTRO */}
    {step==="intro"&&<>
      <SectionLabel>Teamvergelijking</SectionLabel>
      <Heading size={2}>Vergelijk met je team</Heading>
      <p style={{fontFamily:FONT_BODY,fontSize:15,color:C.muted,lineHeight:1.7,marginBottom:26,marginTop:0}}>Laat teamleden dezelfde spiegel invullen. Zo zie je waar jullie beleving overeenkomt — en waar percepties uiteen lopen.</p>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <Btn onClick={function(){setStep("create");}}>Maak een team aan en nodig teamleden uit</Btn>
        <Btn variant="ghost" onClick={function(){setStep("join");}}>Ik heb al een teamcode</Btn>
      </div>
    </>}

    {/* CREATE */}
    {step==="create"&&<>
      <SectionLabel>Nieuw team aanmaken</SectionLabel>
      <Heading size={2}>Stel jouw team in</Heading>

      {/* Steps indicator */}
      <div style={{display:"flex",gap:6,marginBottom:24}}>
        {["Jouw gegevens","Teaminstellingen","Wie ontvangt wat"].map(function(lbl,i){return <div key={i} style={{flex:1}}>
          <div style={{height:3,borderRadius:2,background:C.olive,marginBottom:4}}/>
          <span style={{fontFamily:FONT_BODY,fontSize:10,color:C.muted,letterSpacing:"0.04em"}}>{lbl}</span>
        </div>;})}
      </div>

      <Card>
        <SectionLabel>Jouw gegevens</SectionLabel>
        <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,lineHeight:1.5,marginBottom:14,marginTop:0}}>Hierop ontvang je de teamresultaten zodra de deadline is bereikt of iedereen heeft ingevuld.</p>
        <FormInput label="Jouw naam" placeholder="Erik van Dongen" value={ownerName} onChange={setOwnerName}/>
        <FormInput label="Bedrijfsnaam" placeholder="Bijv. Acme B.V." value={companyName} onChange={setCompanyName}/>
        <FormInput label="Jouw e-mailadres" type="email" placeholder="erik@erikvandongen.eu" value={ownerEmail} onChange={setOwnerEmail} hint="Je ontvangt hier de teamanalyse."/>
      </Card>

      <Card>
        <SectionLabel>Teaminstellingen</SectionLabel>
        <FormInput label="Teamnaam" placeholder="Bijv. MT Commercie" value={teamName} onChange={setTeamName}/>
        <FormInput label="Aantal teamleden dat je uitnodigt" placeholder="Bijv. 6" value={memberCount} onChange={setMemberCount} hint="Zodra iedereen klaar is ontvang je automatisch de teamanalyse."/>
        <FormInput label="Stuur mij de resultaten na ... dagen (ook als niet iedereen heeft ingevuld)" placeholder="7" value={deadlineDays} onChange={setDeadlineDays} hint={"Je ontvangt de analyse sowieso na "+deadlineDays+" dag"+(deadlineDays==="1"?"":"en")+", ongeacht hoeveel mensen hebben ingevuld."}/>
      </Card>

      <Card>
        <SectionLabel>Wie ontvangt de teamanalyse?</SectionLabel>
        <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.charcoal,lineHeight:1.6,marginBottom:14,marginTop:0}}>De teamanalyse is gebaseerd op het gemiddelde van alle ingevulde spiegels. Kies wie deze mag ontvangen.</p>
        {[
          {val:false,title:"Alleen naar mij",desc:"Jij ontvangt de teamanalyse. Teamleden zien alleen hun eigen individuele resultaten. Je kunt dit later alsnog openbaar maken via jouw beheerlink."},
          {val:true,title:"Iedereen mag de teamanalyse ontvangen",desc:"Alle deelnemers die hun e-mailadres hebben achtergelaten ontvangen de gezamenlijke teamanalyse. Individuele antwoorden blijven altijd anoniem. Je kunt dit later ook nog uitschakelen via jouw beheerlink."},
        ].map(function(opt){return <div key={String(opt.val)} onClick={function(){setShareWithAll(opt.val);}} style={{padding:"13px 17px",borderRadius:12,border:"2px solid "+(shareWithAll===opt.val?C.olive:C.warm),cursor:"pointer",background:shareWithAll===opt.val?"#E8EDE3":C.white,transition:"all 0.2s",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid "+(shareWithAll===opt.val?C.olive:C.muted),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {shareWithAll===opt.val&&<div style={{width:8,height:8,borderRadius:"50%",background:C.olive}}/>}
            </div>
            <strong style={{fontFamily:FONT_BODY,fontSize:14,color:C.charcoal}}>{opt.title}</strong>
          </div>
          <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,lineHeight:1.5,margin:"0 0 0 28px"}}>{opt.desc}</p>
        </div>;})}
      </Card>

      {formError&&<p style={{fontFamily:FONT_BODY,fontSize:14,color:C.terra,marginBottom:14}}>{formError}</p>}
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <Btn onClick={handleCreate}>Maak team aan →</Btn>
        <Btn variant="ghost" onClick={function(){setStep("intro");}}>Terug</Btn>
      </div>
    </>}

    {/* SHARE — uses createdMeta/createdToken directly (not async meta state) */}
    {step==="share"&&createdMeta&&<>
      <SectionLabel>Team aangemaakt</SectionLabel>
      <Heading size={2}>Nodig je teamleden uit</Heading>

      {/* ── Beheerlink voor aanmaker ── */}
      <Card style={{background:"#E8EDE3",border:"2px solid "+C.olive}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:C.olive}}/>
          <SectionLabel color={C.olive}>Jouw persoonlijke beheerlink</SectionLabel>
        </div>
        <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.charcoal,lineHeight:1.6,marginBottom:12,marginTop:0}}>
          Sla deze link op — hiermee bekijk je op elk moment de tussentijdse resultaten. Je hoeft de spiegel <strong>niet</strong> opnieuw in te vullen. <strong>We hebben deze link ook naar {createdMeta.ownerEmail} gestuurd</strong>, zodat je hem altijd terug kunt vinden in je inbox.
        </p>
        <div style={{background:C.white,borderRadius:10,padding:"10px 14px",marginBottom:12,fontFamily:FONT_BODY,fontSize:12,color:C.charcoal,wordBreak:"break-all",lineHeight:1.6,border:"1px solid "+C.warm}}>
          {"https://spiegel.erikvandongen.eu?team="+teamCode+"&owner="+createdToken}
        </div>
        <Btn variant="primary" onClick={function(){
          var link = "https://spiegel.erikvandongen.eu?team="+teamCode+"&owner="+createdToken;
          try {
            navigator.clipboard.writeText(link).then(function(){ alert("Beheerlink gekopieerd naar klembord!"); });
          } catch(e) { alert("Kopieer handmatig: "+link); }
        }}>📋 Kopieer beheerlink</Btn>
        <p style={{fontFamily:FONT_BODY,fontSize:12,color:C.muted,marginTop:10,marginBottom:0}}>⚠ Deze link is alleen voor jou — deel hem niet met je teamleden.</p>
      </Card>

      <Card style={{background:"#E8EDE3",border:"none"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div>
            <p style={{fontFamily:FONT_BODY,fontSize:11,color:C.olive,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3,marginTop:0}}>Team</p>
            <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.4rem",color:C.charcoal,marginBottom:2,marginTop:0}}>{createdMeta.teamName}</p>
            <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,margin:0}}>{createdMeta.memberCount} teamleden uitgenodigd</p>
          </div>
          <div style={{textAlign:"right"}}>
            <p style={{fontFamily:FONT_BODY,fontSize:11,color:C.olive,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3,marginTop:0}}>Teamcode</p>
            <p style={{fontFamily:FONT_BODY,fontSize:26,fontWeight:700,letterSpacing:"0.15em",color:C.charcoal,margin:0}}>{teamCode}</p>
          </div>
        </div>
      </Card>

      <Card>
        <SectionLabel>Uitnodigingslink voor teamleden</SectionLabel>
        <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:12,marginTop:0}}>Stuur deze link naar je teamleden. De teamcode wordt automatisch ingevuld — ze hoeven alleen nog maar op start te klikken.</p>
        <div style={{background:C.warm,borderRadius:10,padding:"11px 15px",marginBottom:14,fontFamily:FONT_BODY,fontSize:13,color:C.charcoal,wordBreak:"break-all",lineHeight:1.5}}>{inviteLink}</div>
        <div style={{background:C.cream,borderRadius:10,padding:"11px 15px",marginBottom:18,fontFamily:FONT_BODY,fontSize:13,color:C.charcoal,lineHeight:1.6,whiteSpace:"pre-line"}}>{shareMsg}</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Btn variant="secondary" onClick={function(){window.open("mailto:?subject=Doe de Team Energie Spiegel - "+createdMeta.teamName+"&body="+encodeURIComponent(shareMsg));}}>✉ Deel via e-mail</Btn>
          <Btn variant="green" onClick={function(){window.open("https://wa.me/?text="+encodeURIComponent(shareMsg));}}>✓ Deel via WhatsApp</Btn>
        </div>
      </Card>

      <Card>
        <SectionLabel>Wat gebeurt er nu?</SectionLabel>
        {[
          {n:"1",t:"Teamleden vullen de spiegel in",d:"Via de uitnodigingslink. Hun antwoorden zijn volledig anoniem."},
          {n:"2",t:"Automatische analyse na "+createdMeta.deadlineDays+" dagen",d:"Je ontvangt de teamanalyse op "+createdMeta.ownerEmail+" — ook als niet iedereen heeft ingevuld."+(createdMeta.shareWithAll?" Alle deelnemers die hun e-mailadres hebben achtergelaten ontvangen de teamanalyse ook.":"")},
          {n:"3",t:"Bespreek de uitkomst met je team",d:"De analyse is een gespreksstarter. Gebruik hem om het gesprek te openen dat er al te lang niet is gevoerd."},
        ].map(function(item,i){return <div key={i} style={{display:"flex",gap:14,marginBottom:i<2?16:0}}>
          <div style={{width:26,height:26,borderRadius:"50%",background:C.olive,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontFamily:FONT_BODY,fontSize:12,fontWeight:700,color:C.white}}>{item.n}</span>
          </div>
          <div><p style={{fontFamily:FONT_BODY,fontSize:14,fontWeight:600,color:C.charcoal,marginBottom:2,marginTop:0}}>{item.t}</p><p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,lineHeight:1.5,marginTop:0,marginBottom:0}}>{item.d}</p></div>
        </div>;})}
      </Card>
      <Btn onClick={function(){setStep("view");}}>Bekijk huidige teamresultaten →</Btn>
    </>}

    {/* JOIN */}
    {step==="join"&&<>
      <SectionLabel>Team aansluiten</SectionLabel>
      <Heading size={2}>Vul de teamcode in</Heading>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:18,marginTop:0}}>Heb je een teamcode ontvangen van je collega? Vul hem hieronder in om jouw resultaten toe te voegen aan het team.</p>
      <input type="text" placeholder="TEAM-0000" value={joinCode} onChange={function(e){
              var v = e.target.value.toUpperCase();
              if(!v.startsWith("TEAM-")) v = "TEAM-";
              if(v.length > 9) v = v.slice(0,9);
              setJoinCode(v);
            }}
        style={{width:"100%",padding:"13px 17px",borderRadius:12,border:"1.5px solid "+C.warm,fontFamily:FONT_BODY,fontSize:17,color:C.charcoal,background:C.white,outline:"none",boxSizing:"border-box",marginBottom:14,textTransform:"uppercase",letterSpacing:"0.12em"}}/>
      <div style={{display:"flex",gap:10}}>
        <Btn onClick={handleJoin} disabled={!/^TEAM-\d{4}$/.test(joinCode)}>Voeg mijn resultaten toe</Btn>
        <Btn variant="ghost" onClick={function(){setStep("intro");}}>Terug</Btn>
      </div>
    </>}

    {/* VIEW */}
    {step==="view"&&<>
      <SectionLabel>Teamresultaten</SectionLabel>
      <Heading size={2}>{(meta&&meta.teamName)||"Teamoverzicht"}</Heading>

      {/* Progress card */}
      {meta&&<Card style={{background:C.warm,border:"none"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <p style={{fontFamily:FONT_BODY,fontSize:11,color:C.muted,marginBottom:3,marginTop:0,textTransform:"uppercase",letterSpacing:"0.06em"}}>Voortgang</p>
            <p style={{fontFamily:FONT_BODY,fontSize:22,fontWeight:700,color:C.charcoal,marginTop:0,marginBottom:0}}>{completed} <span style={{fontSize:14,fontWeight:400,color:C.muted}}>/ {target} teamleden</span></p>
          </div>
          <div style={{textAlign:"right"}}>
            <p style={{fontFamily:FONT_BODY,fontSize:11,color:C.muted,marginBottom:3,marginTop:0,textTransform:"uppercase",letterSpacing:"0.06em"}}>Deadline</p>
            <p style={{fontFamily:FONT_BODY,fontSize:14,fontWeight:600,color:C.charcoal,marginTop:0,marginBottom:0}}>{deadlineDate}</p>
          </div>
        </div>
        <div style={{height:6,background:"rgba(69,84,59,0.2)",borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:progressPct+"%",background:C.olive,borderRadius:3,transition:"width 0.5s ease"}}/>
        </div>
        {completed>=target&&target>0&&<p style={{fontFamily:FONT_BODY,fontSize:13,color:C.olive,fontWeight:600,marginTop:8,marginBottom:0}}>✓ Iedereen heeft de spiegel ingevuld!</p>}
        {completed<target&&<p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,marginTop:8,marginBottom:0}}>Nog {target-completed} {target-completed===1?"teamlid":"teamleden"} te gaan.</p>}
      </Card>}

      <Card>
        <SectionLabel>{meta&&!meta.shareWithAll?"Jouw scores":"Gemiddelde teamscores"}{meta&&meta.shareWithAll&&completed>1?" ("+completed+" deelnemers)":""}</SectionLabel>
        <RadarViz data={avg()}/>
      </Card>

      <Card>
        <SectionLabel>{meta&&!meta.shareWithAll?"Jouw resultaat per categorie":"Per categorie (teamgemiddelde)"}</SectionLabel>
        {Object.entries(avg()).map(function(e){return <ScorePill key={e[0]} label={e[0]} score={e[1]}/>;})}</Card>

      {/* Team AI analysis */}
      <Card style={{background:C.warm,border:"none"}}>
        <SectionLabel>Team AI-analyse</SectionLabel>
        {!teamAnalysisLoaded&&!teamAnalysisLoading&&<>
          <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:14,marginTop:0}}>Genereer een teamanalyse op basis van het gemiddelde van <strong>{completed} deelnemer{completed!==1?"s":""}</strong>. Individuele antwoorden blijven anoniem.</p>
          <Btn onClick={handleTeamAnalysis}>Genereer teamanalyse</Btn>
        </>}
        {teamAnalysisLoading&&<><p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,margin:0}}>Teamanalyse wordt gegenereerd...</p><LoadingDots/></>}
        {teamAnalysisLoaded&&teamAnalysis&&<AnalysisBlock analysis={teamAnalysis} isTeam={true}/>}
      </Card>

      {/* Email for team results */}
      {meta&&!meta.shareWithAll&&<Card style={{background:C.warm,border:"none"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
        <span style={{fontSize:18,flexShrink:0}}>🔒</span>
        <div>
          <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.05rem",color:C.charcoal,margin:"0 0 6px",fontWeight:600}}>Teamresultaten nog niet gedeeld</p>
          <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.6,margin:0}}>De teamaanmaker heeft er nog voor gekozen de teamresultaten niet te delen. Je ontvangt een bericht zodra de analyse beschikbaar is.</p>
        </div>
      </div>
    </Card>}
    {meta&&meta.shareWithAll&&<Card>
        <SectionLabel>Ontvang de teamanalyse per e-mail</SectionLabel>
        <EmailCapture
          label={"De teamaanmaker heeft ingesteld dat iedereen de teamanalyse mag ontvangen. Laat je e-mailadres achter — je ontvangt de analyse zodra ze beschikbaar is."}
          hint="Alleen de teamanalyse. Geen spam."
          buttonLabel="Stuur mij de teamanalyse"
          onSubmit={function(name,email){ apiSaveEmail(teamCode, getSessionId(), name, email, true).finally(function(){ setTeamEmailSubmitted(true); }); }}
          submitted={teamEmailSubmitted}
          submittedMsg="Genoteerd ✓ — je ontvangt de teamanalyse zodra die beschikbaar is."
        />
      </Card>}

      {/* Share reminder */}
      {meta&&completed<target&&<Card>
        <SectionLabel>Nog niet iedereen ingevuld?</SectionLabel>
        <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.5,marginBottom:14,marginTop:0}}>Stuur een reminder naar de teamleden die nog niet hebben ingevuld.</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Btn variant="secondary" onClick={function(){window.open("mailto:?subject=Reminder: "+meta.teamName+" Team Energie Spiegel&body="+encodeURIComponent(shareMsg));}}>✉ Stuur reminder</Btn>
          <Btn variant="green" onClick={function(){window.open("https://wa.me/?text="+encodeURIComponent(shareMsg));}}>✓ WhatsApp</Btn>
        </div>
      </Card>}
    </>}

    <style>{`@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1)}}`}</style>
  </div>;
}

// ─── DEMO DATA ────────────────────────────────────────────────────────────────
var DEMO_CODE = "TEAM-DEMO";
var DEMO_TOKEN = "demo-owner-token";
var DEMO_META = {
  ownerName:"Erik van Dongen", ownerEmail:"erik@erikvandongen.eu",
  teamName:"MT Commercie", memberCount:6, deadlineDays:7,
  shareWithAll:false, ownerToken:DEMO_TOKEN,
  createdAt: Date.now() - 3*86400000,
};
var DEMO_ENTRIES = [
  {scores:{Vertrouwen:4.0,Eigenaarschap:3.7,Samenwerking:4.5,Richting:3.0,Tempo:4.2},sid:"s1",email:null,ts:Date.now()-2*86400000},
  {scores:{Vertrouwen:3.5,Eigenaarschap:4.0,Samenwerking:3.5,Richting:3.5,Tempo:3.8},sid:"s2",email:null,ts:Date.now()-1.5*86400000},
  {scores:{Vertrouwen:4.5,Eigenaarschap:3.3,Samenwerking:4.0,Richting:2.5,Tempo:4.5},sid:"s3",email:null,ts:Date.now()-1*86400000},
  {scores:{Vertrouwen:2.5,Eigenaarschap:3.0,Samenwerking:3.5,Richting:3.0,Tempo:3.0},sid:"s4",email:"anna@bedrijf.nl",ts:Date.now()-0.5*86400000},
];

// ─── OWNER DASHBOARD ─────────────────────────────────────────────────────────
function OwnerDashboard(props) {
  var isDemo = !!props.isDemo;
  var teamCode = isDemo ? DEMO_CODE : props.teamCode;
  var [meta, setMeta] = useState(isDemo ? DEMO_META : null);
  var [teamData, setTeamData] = useState(isDemo ? DEMO_ENTRIES : []);
  var [teamAnalysis, setTeamAnalysis] = useState(null);
  var [teamAnalysisLoading, setTeamAnalysisLoading] = useState(false);
  var [teamAnalysisLoaded, setTeamAnalysisLoaded] = useState(false);
  var [loading, setLoading] = useState(!isDemo);

  useEffect(function(){
    if(isDemo) return;
    function loadData() {
      apiGetTeam(teamCode).then(function(m){ if(m) setMeta(m); });
      apiGetEntries(teamCode).then(function(entries){ setTeamData(entries); setLoading(false); });
    }
    loadData();
    var iv = setInterval(loadData, 8000);
    return function(){ clearInterval(iv); };
  },[]);

  if(loading) return <div style={{maxWidth:560,margin:"80px auto",padding:"0 24px",textAlign:"center"}}><LoadingDots/></div>;
  if(!meta) return <div style={{maxWidth:560,margin:"80px auto",padding:"0 24px",textAlign:"center"}}>
    <Heading size={3} color={C.muted}>Teamcode niet gevonden. Controleer de link.</Heading>
  </div>;

  var completed = teamData.length;
  var target = meta.memberCount;
  var progressPct = target ? Math.min((completed/target)*100,100) : 0;
  var deadlineDate = new Date(meta.createdAt+meta.deadlineDays*86400000).toLocaleDateString("nl-NL",{day:"numeric",month:"long",year:"numeric"});
  var avg = completed ? calcAvgScores(teamData) : null;
  var inviteLink = "https://spiegel.erikvandongen.eu?team="+teamCode;

  return <div style={{maxWidth:640,margin:"0 auto",padding:"clamp(22px,5vw,56px) 24px"}}>
    {isDemo&&<div style={{background:C.terra,borderRadius:14,padding:"14px 20px",marginBottom:24,display:"flex",alignItems:"flex-start",gap:12}}>
      <span style={{fontSize:18,flexShrink:0}}>👀</span>
      <div>
        <p style={{fontFamily:FONT_BODY,fontSize:14,fontWeight:700,color:C.white,marginBottom:3,marginTop:0}}>Dit is een voorbeeldweergave</p>
        <p style={{fontFamily:FONT_BODY,fontSize:13,color:"rgba(255,255,255,0.85)",marginBottom:0,marginTop:0,lineHeight:1.5}}>Je ziet hoe het dashboard eruitziet als teamaanmaker — met 4 van 6 ingevulde resultaten. Alle data is fictief.</p>
      </div>
    </div>}
    <div style={{marginBottom:28}}>
      <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#E8EDE3",borderRadius:8,padding:"4px 12px",marginBottom:14}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:C.olive}}/>
        <span style={{fontFamily:FONT_BODY,fontSize:11,color:C.olive,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>Beheerdersdashboard</span>
      </div>
      <Heading size={2}>{meta.teamName}</Heading>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,margin:0}}>Aangemaakt door {meta.ownerName} · resultaten naar {meta.shareWithAll?"iedereen":"alleen jou"}</p>
    </div>

    {/* Progress */}
    <Card style={{background:C.warm,border:"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <p style={{fontFamily:FONT_BODY,fontSize:11,color:C.muted,marginBottom:3,marginTop:0,textTransform:"uppercase",letterSpacing:"0.06em"}}>Voortgang</p>
          <p style={{fontFamily:FONT_BODY,fontSize:26,fontWeight:700,color:C.charcoal,marginTop:0,marginBottom:0}}>{completed} <span style={{fontSize:14,fontWeight:400,color:C.muted}}>/ {target} teamleden</span></p>
        </div>
        <div style={{textAlign:"right"}}>
          <p style={{fontFamily:FONT_BODY,fontSize:11,color:C.muted,marginBottom:3,marginTop:0,textTransform:"uppercase",letterSpacing:"0.06em"}}>Deadline</p>
          <p style={{fontFamily:FONT_BODY,fontSize:14,fontWeight:600,color:C.charcoal,marginTop:0,marginBottom:0}}>{deadlineDate}</p>
        </div>
      </div>
      <div style={{height:8,background:"rgba(69,84,59,0.2)",borderRadius:4,overflow:"hidden",marginBottom:8}}>
        <div style={{height:"100%",width:progressPct+"%",background:C.olive,borderRadius:4,transition:"width 0.5s ease"}}/>
      </div>
      {completed>=target&&target>0
        ? <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.olive,fontWeight:600,margin:0}}>✓ Iedereen heeft de spiegel ingevuld!</p>
        : <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,margin:0}}>Nog {target-completed} {target-completed===1?"teamlid":"teamleden"} te gaan. Pagina ververst automatisch.</p>}
    </Card>

    {/* Share toggle */}
    <Card>
      <SectionLabel>Teamresultaten delen met deelnemers</SectionLabel>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:14,marginTop:0}}>
        {meta.shareWithAll
          ? "Deelnemers kunnen de teamresultaten momenteel inzien. Je kunt dit uitschakelen."
          : "Deelnemers zien nu alleen hun eigen resultaten. Schakel in om de teamresultaten ook met hen te delen."}
      </p>
      <Btn variant={meta.shareWithAll?"ghost":"primary"} onClick={async function(){
        try {
          await fetch("/api/teams", {
            method:"PATCH",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({teamCode, shareWithAll:!meta.shareWithAll})
          });
          setMeta(Object.assign({},meta,{shareWithAll:!meta.shareWithAll}));
        } catch(e){ console.error(e); }
      }}>
        {meta.shareWithAll ? "🔒 Resultaten verbergen voor deelnemers" : "🔓 Resultaten zichtbaar maken voor deelnemers"}
      </Btn>
    </Card>

    {/* Results or placeholder */}
    {avg ? <>
      <Card>
        <SectionLabel>Gemiddelde teamscores ({completed} deelnemer{completed!==1?"s":""})</SectionLabel>
        <RadarViz data={avg}/>
      </Card>
      <Card>
        <SectionLabel>Per categorie</SectionLabel>
        {Object.entries(avg).map(function(e){return <ScorePill key={e[0]} label={e[0]} score={e[1]}/>;})}</Card>
      <Card style={{background:C.warm,border:"none"}}>
        <SectionLabel>Tussentijdse teamanalyse</SectionLabel>
        {!teamAnalysisLoaded&&!teamAnalysisLoading&&<>
          <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:14,marginTop:0}}>Genereer een AI-analyse op basis van de {completed} resultaten die nu beschikbaar zijn.</p>
          <Btn onClick={function(){
            setTeamAnalysisLoading(true);
            fetchAIAnalysis(avg, completed, true).then(function(r){ setTeamAnalysis(r); setTeamAnalysisLoading(false); setTeamAnalysisLoaded(true); });
          }}>Genereer tussentijdse analyse</Btn>
        </>}
        {teamAnalysisLoading&&<><p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,margin:0}}>Analyse wordt gegenereerd...</p><LoadingDots/></>}
        {teamAnalysisLoaded&&teamAnalysis&&<AnalysisBlock analysis={teamAnalysis} isTeam={true}/>}
      </Card>
    </> : <Card>
      <p style={{fontFamily:FONT_BODY,fontSize:15,color:C.muted,lineHeight:1.6,margin:0,textAlign:"center",padding:"16px 0"}}>Nog geen resultaten — stuur de uitnodigingslink naar je team.</p>
    </Card>}

    {/* Invite reminder */}
    <Card>
      <SectionLabel>Uitnodigingslink voor teamleden</SectionLabel>
      <div style={{background:C.warm,borderRadius:10,padding:"10px 14px",marginBottom:14,fontFamily:FONT_BODY,fontSize:13,color:C.charcoal,wordBreak:"break-all"}}>{inviteLink}</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <Btn variant="secondary" onClick={function(){window.open("mailto:?subject=Reminder Team Energie Spiegel - "+meta.teamName+"&body="+encodeURIComponent("Reminder: vul de Team Energie Spiegel in voor team "+meta.teamName+".\n\n"+inviteLink));}}>✉ Stuur reminder</Btn>
        <Btn variant="green" onClick={function(){window.open("https://wa.me/?text="+encodeURIComponent("Reminder voor team "+meta.teamName+": "+inviteLink));}}>✓ WhatsApp</Btn>
      </div>
    </Card>
    <style>{`@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1)}}`}</style>
  </div>;
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App() {
  var [urlParams] = useState(function(){
    try {
      var p = new URLSearchParams(window.location.search);
      return { team: p.get("team")||null, owner: p.get("owner")||null };
    } catch(e){ return {team:null,owner:null}; }
  });

  var [ownerView, setOwnerView] = useState(false);
  var [ownerChecked, setOwnerChecked] = useState(false);

  useEffect(function(){
    if(urlParams.team && urlParams.owner){
      apiValidateOwner(urlParams.team, urlParams.owner).then(function(valid){
        setOwnerView(valid);
        setOwnerChecked(true);
      });
    } else {
      setOwnerChecked(true);
    }
  }, []);

  var [page, setPage] = useState("start");
  var [answers, setAnswers] = useState({});
  var [prefilledCode, setPrefilledCode] = useState(urlParams.team && !urlParams.owner ? urlParams.team : null);
  var [demoMode, setDemoMode] = useState(false);

  function handleReset(){ setDemoMode(false); setPage("start"); setAnswers({}); setPrefilledCode(urlParams.team&&!urlParams.owner?urlParams.team:null); }

  var showingDashboard = ownerView || demoMode;

  if(!ownerChecked) return <div style={{minHeight:"100vh",background:C.cream,display:"flex",alignItems:"center",justifyContent:"center"}}><LoadingDots/></div>;

  return <div style={{minHeight:"100vh",background:C.cream,fontFamily:FONT_BODY}}>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Source+Sans+Pro:wght@400;600&display=swap" rel="stylesheet"/>
    <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(245,240,232,0.93)",backdropFilter:"blur(8px)",borderBottom:"1px solid "+C.warm,padding:"10px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:24,height:24,background:C.olive,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{display:"flex",gap:2,alignItems:"flex-end",height:12}}>{[6,9,12,9,6].map(function(h,i){return <div key={i} style={{width:2,height:h,background:C.cream,borderRadius:1}}/>;})}</div>
        </div>
        <span style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted}}>Team Energie Spiegel</span>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        {demoMode&&<div style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(181,98,42,0.1)",borderRadius:20,padding:"4px 11px"}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:C.terra}}/>
          <span style={{fontFamily:FONT_BODY,fontSize:11,color:C.terra,fontWeight:600,letterSpacing:"0.05em"}}>Voorbeeldweergave</span>
        </div>}
        {(showingDashboard||page!=="start"&&page!=="teamcode")&&<button onClick={handleReset} style={{background:"none",border:"1px solid "+C.warm,borderRadius:20,padding:"6px 14px",cursor:"pointer",fontFamily:FONT_BODY,fontSize:13,color:C.muted}}>← Terug naar home</button>}
      </div>
    </div>
    {showingDashboard
      ? <OwnerDashboard teamCode={urlParams.team} isDemo={demoMode}/>
      : <>
          {page==="start"    &&(!ownerView&&urlParams.team
            ? <StartPage onStart={function(code){setPrefilledCode(code);setPage("questions");}} inviteContext={{code:urlParams.team}} onDemo={function(){setDemoMode(true);}}/>
            : <StartPage onStart={function(code){setPrefilledCode(code);setPage("teamcode");}} inviteContext={null} onDemo={function(){setDemoMode(true);}}/>
          )}
          {page==="teamcode"  &&<TeamCodePage onStart={function(code){setPrefilledCode(code);setPage("questions");}}/>}
          {page==="questions"&&<QuestionsPage onComplete={function(a){setAnswers(a);setPage("analysis");}}/>}
          {page==="analysis" &&<AnalysisPage answers={answers} prefilledCode={prefilledCode} onDone={function(){setPage("team");}}/>}
          {page==="team"     &&<TeamPage answers={answers} prefilledCode={prefilledCode} onBack={function(){setPage("analysis");}}/>}
        </>
    }
  </div>;
}
