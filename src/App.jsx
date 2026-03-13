import React, { useState, useEffect } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const C = {
  olive:"#45543B", oliveL:"#45543B", terra:"#9D6D58", clay:"#A27D67",
  cream:"#F5F3EF", warm:"#EFEBE7", charcoal:"#332D28", muted:"#766960",
  white:"#FFFFFF", neutral:"#DED7CF",
};
const FONT_DISPLAY = "'Cormorant Garamond', Georgia, serif";
const FEEDBACK_MODE = true; // zet op false om feedback uit te schakelen
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
async function apiSaveEmail(teamCode, sessionId, name, email, wantsTeamAnalysis, analysis) {
  const res = await fetch("/api/subscribe", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ teamCode, sessionId, name, email, wantsTeamAnalysis, analysis }),
  });
  if (!res.ok) throw new Error("Opslaan email mislukt");
  return res.json();
}

// ─── Score calculations ───────────────────────────────────────────────────────
function calcCategoryScores(answers) {
  const result = {};
  for (const [cat, qIds] of Object.entries(CATEGORIES)) {
    // Alle vragen zijn negatief geformuleerd: score 1 = goed, score 5 = slecht
    // Inverteer naar: score 5 = kracht, score 1 = energielek
    const vals = qIds.map(id => 6 - (answers[id] || 3));
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
  const prompt = "Je bent een scherpe, eerlijke teamcoach. " + context + "\n\nScores op de Team Energie Spiegel (1-5, waarbij 4-5=kracht/positief en 1-2=energielek/probleem):\n" + lines + "\n\n" + perspective + "\n\nSchrijf in het Nederlands:\n1. Diagnose (max 4 zinnen)\n2. Wat dit betekent\n3. Wat er gebeurt als er niets verandert\n4. 3 gespreksvragen (genummerd)\n\nToon: eerlijk, scherp, herkenbaar.\n\nAntwoord ALLEEN in JSON (geen markdown backticks):\n{\"diagnose\":\"...\",\"betekenis\":\"...\",\"geenVerandering\":\"...\",\"gespreksvragen\":[\"...\",\"...\",\"...\"]}";

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


// ─── FEEDBACK COMPONENTS ──────────────────────────────────────────────────────
function FeedbackButton(props) {
  var page = props.page;
  var [open, setOpen] = useState(false);
  var [comment, setComment] = useState("");
  var [naam, setNaam] = useState("");
  var [sent, setSent] = useState(false);

  if (!FEEDBACK_MODE) return null;

  async function handleSend() {
    if (!comment.trim()) return;
    try {
      await fetch("/api/feedback", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ sessionId: getSessionId(), page, comment, naam: naam.trim()||null })
      });
      setSent(true);
      setTimeout(function(){ setOpen(false); setSent(false); setComment(""); setNaam(""); }, 1500);
    } catch(e) { console.error(e); }
  }

  return <>
    <div style={{position:"fixed",bottom:24,right:24,zIndex:1000}}>
      {open && <div style={{background:C.white,borderRadius:16,boxShadow:"0 8px 40px rgba(44,44,42,0.15)",padding:"20px",width:290,marginBottom:12,border:"1px solid "+C.warm}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p style={{fontFamily:FONT_BODY,fontSize:13,fontWeight:600,color:C.charcoal,margin:0}}>Feedback — {page}</p>
          <button onClick={function(){setOpen(false);setComment("");setNaam("");}} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:18,padding:0,lineHeight:1}}>×</button>
        </div>
        {sent ? <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.olive,margin:0,textAlign:"center",padding:"8px 0"}}>✓ Verstuurd, dankjewel!</p> : <>
          <input
            value={naam} onChange={function(e){setNaam(e.target.value);}}
            placeholder="Jouw naam (optioneel)"
            style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid "+C.warm,fontFamily:FONT_BODY,fontSize:13,color:C.charcoal,boxSizing:"border-box",outline:"none",marginBottom:8}}
          />
          <textarea
            value={comment} onChange={function(e){setComment(e.target.value);}}
            placeholder="Wat valt je op op deze pagina?"
            style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+C.warm,fontFamily:FONT_BODY,fontSize:13,color:C.charcoal,resize:"vertical",minHeight:80,boxSizing:"border-box",outline:"none"}}
          />
          <button onClick={handleSend} disabled={!comment.trim()} style={{marginTop:10,width:"100%",background:C.olive,color:C.white,border:"none",borderRadius:50,padding:"10px",fontFamily:FONT_BODY,fontSize:13,fontWeight:600,cursor:comment.trim()?"pointer":"not-allowed",opacity:comment.trim()?1:0.5}}>
            Verstuur feedback
          </button>
        </>}
      </div>}
      <button onClick={function(){setOpen(function(o){return !o;});}} style={{background:C.olive,color:C.white,border:"none",borderRadius:50,padding:"10px 18px",fontFamily:FONT_BODY,fontSize:13,fontWeight:600,cursor:"pointer",boxShadow:"0 4px 16px rgba(69,84,59,0.3)",display:"flex",alignItems:"center",gap:8}}>
        💬 Feedback
      </button>
    </div>
  </>;
}

function FeedbackEndScreen(props) {
  var onDone = props.onDone;
  var [rating, setRating] = useState(0);
  var [comment, setComment] = useState("");
  var [wouldUse, setWouldUse] = useState(null);
  var [sent, setSent] = useState(false);
  var [loading, setLoading] = useState(false);

  if (!FEEDBACK_MODE) { onDone(); return null; }

  async function handleSubmit() {
    setLoading(true);
    try {
      await fetch("/api/feedback", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ sessionId: getSessionId(), page: "einde", rating, comment, wouldUse })
      });
      setSent(true);
      setTimeout(onDone, 2000);
    } catch(e) { console.error(e); setLoading(false); }
  }

  return <div style={{maxWidth:560,margin:"0 auto",padding:"clamp(22px,5vw,56px) 24px"}}>
    <div style={{background:C.olive,borderRadius:16,padding:"28px 32px",marginBottom:24,textAlign:"center"}}>
      <p style={{fontFamily:FONT_BODY,fontSize:11,color:"#c0d4a8",letterSpacing:"0.1em",textTransform:"uppercase",margin:"0 0 8px"}}>MVP Test</p>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"clamp(1.4rem,4vw,2rem)",color:C.white,margin:0,lineHeight:1.3}}>Wat vind je er tot nu toe van?</p>
    </div>
    {sent ? <Card style={{textAlign:"center",padding:"40px"}}>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.5rem",color:C.olive,margin:"0 0 8px"}}>Dankjewel! 🙏</p>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,margin:0}}>Je feedback is opgeslagen. Je gaat nu naar de resultaten.</p>
    </Card> : <>
      <Card>
        <SectionLabel>Hoe was je ervaring?</SectionLabel>
        <div style={{display:"flex",gap:8,marginBottom:4}}>
          {[1,2,3,4,5].map(function(s){
            return <button key={s} onClick={function(){setRating(s);}} style={{fontSize:28,background:"none",border:"none",cursor:"pointer",opacity:s<=rating?1:0.3,transition:"opacity 0.15s",padding:"4px"}}>⭐</button>;
          })}
        </div>
      </Card>
      <Card>
        <SectionLabel>Wat miste je of werkte niet goed?</SectionLabel>
        <textarea value={comment} onChange={function(e){setComment(e.target.value);}}
          placeholder="Optioneel — elke opmerking helpt"
          style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1.5px solid "+C.warm,fontFamily:FONT_BODY,fontSize:14,color:C.charcoal,resize:"vertical",minHeight:90,boxSizing:"border-box",outline:"none"}}
        />
      </Card>
      <Card>
        <SectionLabel>Zou je dit inzetten met jouw team?</SectionLabel>
        <div style={{display:"flex",gap:10}}>
          {["Ja","Misschien","Nee"].map(function(opt){
            return <button key={opt} onClick={function(){setWouldUse(opt);}} style={{flex:1,padding:"10px",borderRadius:10,border:"2px solid "+(wouldUse===opt?C.olive:C.warm),background:wouldUse===opt?"#E8EDE3":C.white,fontFamily:FONT_BODY,fontSize:14,fontWeight:wouldUse===opt?600:400,color:wouldUse===opt?C.olive:C.charcoal,cursor:"pointer",transition:"all 0.15s"}}>{opt}</button>;
          })}
        </div>
      </Card>
      <div style={{display:"flex",gap:10}}>
        <Btn variant="ghost" onClick={onDone} style={{flex:1,justifyContent:"center"}}>Overslaan</Btn>
        <Btn onClick={handleSubmit} disabled={loading||(!rating&&!comment&&!wouldUse)} style={{flex:2,justifyContent:"center"}}>
          {loading?"Opslaan...":"Verstuur feedback"}
        </Btn>
      </div>
    </>}
  </div>;
}

// ─── EXPORT HELPERS ───────────────────────────────────────────────────────────
function exportTeamCSV(meta, entries, avg, analysis) {
  const cats = ['Vertrouwen', 'Eigenaarschap', 'Samenwerking', 'Richting', 'Tempo'];
  const rows = [];
  rows.push(['Team Energie Spiegel — Export']);
  rows.push(['Team', meta.teamName]);
  rows.push(['Aanmaker', meta.ownerName]);
  rows.push(['E-mail aanmaker', meta.ownerEmail]);
  rows.push(['Aangemaakt', new Date(meta.createdAt).toLocaleDateString('nl-NL')]);
  rows.push(['Deelnemers ingevuld', entries.length]);
  rows.push([]);
  rows.push(['TEAMGEMIDDELDEN (anoniem)']);
  rows.push(['Categorie', 'Score', 'Status']);
  cats.forEach(cat => {
    const sc = avg[cat];
    const status = sc >= 4 ? 'Kracht' : sc >= 3 ? 'Neutraal' : 'Energielek';
    rows.push([cat, sc.toFixed(2), status]);
  });
  rows.push([]);
  rows.push(['DEELNEMERS']);
  rows.push(['#', 'Naam', 'E-mail', 'Datum ingevuld']);
  entries.forEach((e, i) => {
    rows.push([i+1, e.name || '—', e.email || '—', new Date(e.ts).toLocaleDateString('nl-NL')]);
  });
  if (analysis) {
    rows.push([]);
    rows.push(['AI TEAMANALYSE']);
    rows.push(['Diagnose', analysis.diagnose]);
    rows.push(['Betekenis', analysis.betekenis]);
    rows.push(['Als er niets verandert', analysis.geenVerandering]);
    rows.push(['Gespreksvragen']);
    (analysis.gespreksvragen || []).forEach((v, i) => rows.push([i+1, v]));
  }
  const csv = rows.map(r => r.map(c => '"' + String(c||'').replace(/"/g,'""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'team-energie-spiegel-' + meta.teamName.toLowerCase().replace(/\s+/g,'-') + '.csv';
  a.click(); URL.revokeObjectURL(url);
}

function exportTeamPDF(meta, entries, avg, analysis) {
  const cats = ['Vertrouwen', 'Eigenaarschap', 'Samenwerking', 'Richting', 'Tempo'];
  const scoreRows = cats.map(cat => {
    const sc = avg[cat];
    const status = sc >= 4 ? 'Kracht' : sc >= 3 ? 'Neutraal' : 'Energielek';
    const color = sc >= 4 ? '#45543B' : sc >= 3 ? '#766960' : '#9D6D58';
    return `<tr><td style="padding:8px 12px;border-bottom:1px solid #EFEBE7;">${cat}</td><td style="padding:8px 12px;border-bottom:1px solid #EFEBE7;font-weight:700;">${sc.toFixed(2)}/5</td><td style="padding:8px 12px;border-bottom:1px solid #EFEBE7;color:${color};font-weight:600;">${status}</td></tr>`;
  }).join('');
  const memberRows = entries.map((e, i) =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #EFEBE7;">${i+1}</td><td style="padding:6px 12px;border-bottom:1px solid #EFEBE7;">${e.name||'—'}</td><td style="padding:6px 12px;border-bottom:1px solid #EFEBE7;">${e.email||'—'}</td><td style="padding:6px 12px;border-bottom:1px solid #EFEBE7;">${new Date(e.ts).toLocaleDateString('nl-NL')}</td></tr>`
  ).join('');
  const analysisHtml = analysis ? `
    <div style="margin-top:28px;">
      <h2 style="font-family:Georgia,serif;color:#45543B;font-size:18px;margin-bottom:16px;">AI Teamanalyse</h2>
      <div style="background:#F5F3EF;border-radius:8px;padding:16px;margin-bottom:12px;">
        <strong style="color:#9D6D58;">Diagnose</strong>
        <p style="margin:6px 0 0;">${analysis.diagnose}</p>
      </div>
      <div style="background:#F5F3EF;border-radius:8px;padding:16px;margin-bottom:12px;">
        <strong>Wat dit betekent</strong>
        <p style="margin:6px 0 0;">${analysis.betekenis}</p>
      </div>
      <div style="background:#F5F3EF;border-radius:8px;padding:16px;margin-bottom:12px;">
        <strong>Als er niets verandert</strong>
        <p style="margin:6px 0 0;">${analysis.geenVerandering}</p>
      </div>
      <div style="background:#F5F3EF;border-radius:8px;padding:16px;">
        <strong style="color:#45543B;">Gespreksvragen</strong>
        <ol style="margin:8px 0 0;padding-left:20px;">${(analysis.gespreksvragen||[]).map(v=>`<li style="margin-bottom:6px;">${v}</li>`).join('')}</ol>
      </div>
    </div>` : '';
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Team Energie Spiegel — ${meta.teamName}</title>
  <style>body{font-family:'Helvetica Neue',sans-serif;color:#332D28;max-width:800px;margin:0 auto;padding:40px;}table{width:100%;border-collapse:collapse;}@media print{body{padding:20px;}}</style>
  </head><body>
  <div style="background:#45543B;padding:28px 32px;border-radius:12px;margin-bottom:28px;">
    <p style="color:#EFEBE7;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 6px;">Team Energie Spiegel</p>
    <h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;color:#F5F3EF;margin:0;">${meta.teamName}</h1>
  </div>
  <table style="margin-bottom:8px;"><tr><td style="color:#766960;font-size:13px;padding:3px 0;width:160px;">Aanmaker</td><td style="font-size:14px;">${meta.ownerName}</td></tr>
  <tr><td style="color:#766960;font-size:13px;padding:3px 0;">E-mail</td><td style="font-size:14px;">${meta.ownerEmail}</td></tr>
  <tr><td style="color:#766960;font-size:13px;padding:3px 0;">Deelnemers</td><td style="font-size:14px;">${entries.length} ingevuld</td></tr>
  <tr><td style="color:#766960;font-size:13px;padding:3px 0;">Datum export</td><td style="font-size:14px;">${new Date().toLocaleDateString('nl-NL')}</td></tr></table>
  <h2 style="font-family:Georgia,serif;color:#45543B;font-size:18px;margin:28px 0 12px;">Teamgemiddelden (anoniem)</h2>
  <table><thead><tr style="background:#EFEBE7;"><th style="padding:8px 12px;text-align:left;">Categorie</th><th style="padding:8px 12px;text-align:left;">Score</th><th style="padding:8px 12px;text-align:left;">Status</th></tr></thead><tbody>${scoreRows}</tbody></table>
  <h2 style="font-family:Georgia,serif;color:#45543B;font-size:18px;margin:28px 0 12px;">Deelnemers</h2>
  <table><thead><tr style="background:#EFEBE7;"><th style="padding:6px 12px;text-align:left;">#</th><th style="padding:6px 12px;text-align:left;">Naam</th><th style="padding:6px 12px;text-align:left;">E-mail</th><th style="padding:6px 12px;text-align:left;">Datum</th></tr></thead><tbody>${memberRows}</tbody></table>
  ${analysisHtml}
  <p style="font-size:11px;color:#9E9688;margin-top:40px;text-align:center;">Team Energie Spiegel · erikvandongen.eu · <a href="https://erikvandongen.eu/privacy" target="_blank" rel="noopener noreferrer" style="color:#9E9688;textDecoration:underline;">Privacyverklaring</a></p>
  <script>window.onload=function(){window.print();}</script>
  </body></html>`;
  const w = window.open('','_blank');
  w.document.write(html); w.document.close();
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
  return <div style={style} onClick={props.onClick}>{props.children}</div>;
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
    <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontFamily:FONT_BODY,fontSize:12,color:c.text,fontWeight:600}}>{c.lbl}</span><span style={{fontFamily:FONT_BODY,fontSize:14,color:c.text,fontWeight:700}}>{props.score.toFixed(1)}<span style={{fontSize:11,fontWeight:400,opacity:0.7}}> /5</span></span></div>
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
    <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.olive,margin:0,fontWeight:600}}>{props.submittedMsg||"Genoteerd, we sturen je de resultaten zodra ze beschikbaar zijn."}</p>
  </div>;
  return <div>
    {props.label && <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.charcoal,lineHeight:1.6,marginBottom:14,marginTop:0}}>{props.label}</p>}
    <FormInput placeholder="Jouw naam" value={name} onChange={setName}/>
    <FormInput type="email" placeholder="jouw@email.nl" value={email} onChange={setEmail} hint={props.hint||"Je ontvangt geen spam. Alleen jouw resultaten."} subHint="Door je e-mail achter te laten ga je akkoord met de privacyverklaring."/>
    <Btn onClick={function(){props.onSubmit(name,email);}} disabled={!valid}>{props.buttonLabel||"Verstuur"}</Btn>
  </div>;
}
function ProgressBar(props) {
  var pct = (props.current / props.total) * 100;
  var cats = ['Vertrouwen','Eigenaarschap','Samenwerking','Richting','Tempo'];
  var q = QUESTIONS[props.current - 1];
  var cat = q ? q.category : '';
  return <div style={{marginBottom:28}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
      <span style={{fontFamily:FONT_BODY,fontSize:12,color:C.olive,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase'}}>{cat}</span>
      <span style={{fontFamily:FONT_BODY,fontSize:12,color:C.muted}}>{props.current} / {props.total}</span>
    </div>
    <div style={{height:5,background:'rgba(69,84,59,0.15)',borderRadius:3,overflow:'hidden'}}>
      <div style={{height:'100%',width:pct+'%',background:C.olive,borderRadius:3,transition:'width 0.35s ease'}}/>
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
        <span style={{fontFamily:FONT_BODY,fontSize:12,color:C.muted,display:"block",lineHeight:1.3}}>{n===1?"Helemaal\nniet":n===3?"Deels":n===5?"Zeer\nherkenbaar":""}</span>
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

// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("TeamPage crash:", error, info); }
  render() {
    if (this.state.hasError) {
      return <div style={{maxWidth:560,margin:"80px auto",padding:"0 24px",textAlign:"center"}}>
        <p style={{fontFamily:"sans-serif",fontSize:14,color:"#766960"}}>Er ging iets mis bij het laden van de teampagina.</p>
        <p style={{fontFamily:"monospace",fontSize:11,color:"#c00",marginTop:8}}>{String(this.state.error)}</p>
        <button onClick={function(){window.location.reload();}} style={{marginTop:16,padding:"10px 20px",background:"#45543B",color:"#fff",border:"none",borderRadius:20,cursor:"pointer",fontFamily:"sans-serif"}}>Pagina herladen</button>
      </div>;
    }
    return this.props.children;
  }
}

// ─── TEAM CODE PAGE ───────────────────────────────────────────────────────────
function TeamCodePage(props) {
  var [digits, setDigits] = useState("");
  var [showInput, setShowInput] = useState(false);
  var [checking, setChecking] = useState(false);
  var [codeStatus, setCodeStatus] = useState(null); // null | "found" | "notfound"
  var inputCode = ("TEAM-" + digits).trim().toUpperCase();
  var isFormatValid = /^TEAM-\d{4}$/.test(inputCode);

  function checkCode() {
    if (!isFormatValid) return;
    setChecking(true);
    setCodeStatus(null);
    fetch("/api/teams?code=" + inputCode)
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d && d.teamCode) {
          setCodeStatus("found");
        } else {
          setCodeStatus("notfound");
        }
      })
      .catch(function() { setCodeStatus("notfound"); })
      .finally(function() { setChecking(false); });
  }

  return <div style={{maxWidth:560,margin:"0 auto",padding:"clamp(28px,6vw,72px) 24px"}}>
    {/* Logo */}
    <div style={{background:C.olive,margin:"0 -24px",padding:"22px 24px",marginBottom:48,borderRadius:"0 0 20px 20px"}}>
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
          <Btn variant="ghost" onClick={function(){props.onStart(null);}} style={{width:"100%",justifyContent:"center",fontSize:16,padding:"16px 24px",border:"1.5px solid "+C.muted,color:C.charcoal}}>
            Nee, ik heb geen teamcode →
          </Btn>
        </div>
      : <div>
          <div style={{background:C.white,border:"1.5px solid "+(codeStatus==="found"?C.olive:codeStatus==="notfound"?"#c0392b":C.warm),borderRadius:14,padding:"20px 24px",marginBottom:16}}>
            <p style={{fontFamily:FONT_BODY,fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",color:C.muted,marginBottom:10,marginTop:0}}>Jouw teamcode</p>
            <div style={{display:"flex",alignItems:"center",gap:0,borderRadius:8,border:"1.5px solid "+C.warm,background:C.cream,overflow:"hidden"}}>
              <span style={{fontFamily:FONT_BODY,fontSize:20,fontWeight:700,letterSpacing:"0.15em",color:C.muted,padding:"12px 0 12px 16px",userSelect:"none",whiteSpace:"nowrap"}}>TEAM-</span>
              <input type="text" placeholder="0000" value={digits} onChange={function(e){
                var v = e.target.value.replace(/[^0-9]/g,"").slice(0,4);
                setDigits(v);
                setCodeStatus(null);
              }} autoFocus maxLength={4} inputMode="numeric"
                style={{flex:1,border:"none",padding:"12px 16px 12px 4px",fontFamily:FONT_BODY,fontSize:20,fontWeight:700,letterSpacing:"0.15em",color:C.charcoal,background:"transparent",outline:"none",width:"80px"}}/>
            </div>
            {codeStatus==="found"&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:10}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:C.olive}}/>
              <span style={{fontFamily:FONT_BODY,fontSize:13,color:C.olive,fontWeight:600}}>Teamcode herkend ✓</span>
            </div>}
            {codeStatus==="notfound"&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:10}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:"#c0392b"}}/>
              <span style={{fontFamily:FONT_BODY,fontSize:13,color:"#c0392b",fontWeight:600}}>Teamcode niet herkend — controleer de code en probeer opnieuw.</span>
            </div>}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {codeStatus==="found"
              ? <Btn onClick={function(){props.onStart(inputCode);}} style={{width:"100%",justifyContent:"center",fontSize:16,padding:"16px 24px"}}>
                  Start met teamcode →
                </Btn>
              : <Btn onClick={checkCode} disabled={!isFormatValid||checking} style={{width:"100%",justifyContent:"center",fontSize:16,padding:"16px 24px",opacity:isFormatValid?1:0.5}}>
                  {checking ? "Controleren..." : "Controleer teamcode"}
                </Btn>
            }
            <button onClick={function(){setShowInput(false); setDigits(""); setCodeStatus(null);}} style={{background:"none",border:"none",cursor:"pointer",fontFamily:FONT_BODY,fontSize:14,color:C.muted,textDecoration:"underline",textUnderlineOffset:3,padding:"8px 0"}}>
              ← Toch zonder teamcode doorgaan
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
    <div style={{background:C.olive,margin:"0 -24px",padding:"22px 24px",marginBottom:40,borderRadius:"0 0 20px 20px"}}>
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
    <p style={{fontFamily:FONT_BODY,fontSize:17,color:C.muted,marginBottom:32,lineHeight:1.7,marginTop:0}}>Je team werkt hard. De intenties zijn goed. En toch loopt samenwerking niet altijd soepel. Kleine verschillen in tempo, verwachting en eigenaarschap hopen zich op, ongemerkt. Maar er zit ook kracht in je team die je misschien nog niet volledig benut. Deze spiegel laat zien waar energie weglekt én waar die juist stroomt, zodat je weet waar je op kunt bouwen en wat aandacht verdient.</p>

    <div style={{background:C.warm,borderRadius:16,padding:"22px 26px",marginBottom:32}}>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.05rem",color:C.charcoal,marginBottom:18,fontStyle:"italic",marginTop:0}}>In drie stappen van inzicht naar gesprek:</p>
      {[
        ["Doe de individuele scan","Beantwoord 12 vragen vanuit jouw beleving van het team. Je ziet direct waar energie weglekt, waar kracht zit en waar de volgende stap voor jullie ligt."],
        ["Betrek je team (optioneel)","Nodig teamleden uit dezelfde scan in te vullen. Anoniem en laagdrempelig. Jullie antwoorden worden samengevoegd tot een eerlijk teamgemiddelde."],
        ["Ga het gesprek aan","Je ontvangt een concrete teamanalyse met een gespreksstarter. Geen rapport dat in een la verdwijnt, maar een startpunt voor een echt gesprek."]
      ].map(function(item,i){return <div key={i} style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:i<2?18:0}}>
        <div style={{width:26,height:26,borderRadius:"50%",background:C.olive,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}>
          <span style={{fontFamily:FONT_BODY,fontSize:13,fontWeight:700,color:C.white}}>{i+1}</span>
        </div>
        <div>
          <p style={{fontFamily:FONT_BODY,fontSize:15,fontWeight:600,color:C.charcoal,margin:"0 0 3px"}}>{item[0]}</p>
          <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,margin:0,lineHeight:1.6}}>{item[1]}</p>
        </div>
      </div>;})}
    </div>

    <div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap",marginBottom:22}}>
      <Btn onClick={function(){props.onStart(props.inviteContext&&props.inviteContext.code?props.inviteContext.code:null);}}>Start de Team Energie Spiegel</Btn>
      <span style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted}}>⏱ 3 minuten · 12 vragen</span>
    </div>
    <SocialProof/>
    <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,lineHeight:1.6,marginTop:4}}>Geen registratie nodig · Resultaten direct zichtbaar · Anoniem</p>

    {props.onDemo&&<div style={{marginTop:36,paddingTop:24,borderTop:"1px solid "+C.warm}}>
      <div style={{background:C.white,border:"1.5px solid "+C.warm,borderRadius:16,padding:"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
        <div>
          <p style={{fontFamily:FONT_BODY,fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",color:C.muted,marginBottom:6,marginTop:0}}>Maak je een team aan?</p>
          <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.15rem",color:C.charcoal,margin:"0 0 4px",lineHeight:1.3}}>Benieuwd hoe het dashboard eruitziet?</p>
          <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,margin:0,lineHeight:1.5}}>Bekijk een werkende voorbeeldweergave met echte data.</p>
        </div>
        <Btn variant="primary" onClick={props.onDemo} style={{whiteSpace:"nowrap",fontSize:14,padding:"11px 22px"}}>
          Bekijk voorbeelddashboard →
        </Btn>
      </div>
    </div>}
  </div>;
}

// ─── QUESTIONS PAGE ───────────────────────────────────────────────────────────

// ─── WELCOME TEAM SCREEN ──────────────────────────────────────────────────────
function WelcomeTeamScreen(props) {
  var meta = props.meta;
  var onStart = props.onStart;
  return <div style={{maxWidth:560,margin:"0 auto",padding:"clamp(28px,6vw,72px) 24px"}}>
    <div style={{background:C.olive,borderRadius:20,padding:"32px 28px",marginBottom:24,textAlign:"center"}}>
      <p style={{fontFamily:FONT_BODY,fontSize:11,color:"#c0d4a8",letterSpacing:"0.1em",textTransform:"uppercase",margin:"0 0 10px"}}>Uitnodiging</p>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"clamp(1.5rem,5vw,2.2rem)",color:C.white,margin:"0 0 8px",lineHeight:1.2,fontWeight:400}}>{meta.teamName}</p>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:"#b8c9a3",margin:0}}>Uitgenodigd door {meta.ownerName}</p>
    </div>
    <Card>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.25rem",color:C.charcoal,margin:"0 0 12px",lineHeight:1.4,fontWeight:400}}>Je bent uitgenodigd om de Team Energie Spiegel in te vullen.</p>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.7,margin:"0 0 20px"}}>
        Je antwoorden zijn volledig <strong style={{color:C.charcoal}}>anoniem</strong>{props.meta&&props.meta.shareWithAll
          ? " en alleen het teamgemiddelde is zichtbaar voor anderen."
          : " en alleen voor jou zichtbaar. Het teamgemiddelde is niet gedeeld door de aanmaker."
        } Het duurt ongeveer 3 minuten.
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:0}}>
        {["3 minuten","Jouw antwoorden zijn anoniem","Je ziet je eigen score direct","Bijdrage aan het teamgemiddelde"].map(function(item,i){
          return <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<3?"1px solid "+C.warm:"none"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:C.olive,flexShrink:0}}/>
            <span style={{fontFamily:FONT_BODY,fontSize:14,color:C.charcoal}}>{item}</span>
          </div>;
        })}
      </div>
    </Card>
    <Btn onClick={onStart} style={{width:"100%",justifyContent:"center",fontSize:16,padding:"16px 24px"}}>Start de spiegel →</Btn>
    <style>{`@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1)}}`}</style>
  </div>;
}

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
      <FormInput label="Jouw e-mailadres" type="email" placeholder="jouw@email.nl" value={email} onChange={setEmail} hint={props.canReceiveTeamAnalysis ? "Je ontvangt jouw analyse én de teamanalyse. Jouw antwoorden blijven anoniem." : "Alleen jouw individuele analyse. Geen spam."} subHint="Door je e-mail achter te laten ga je akkoord met de privacyverklaring."/>
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
    fetchAIAnalysis(catScores, 1, false).then(function(a){ setAnalysis(a); setLoading(false); if(props.onAnalysisReady) props.onAnalysisReady(a); });
    if(prefilledCode) apiGetTeam(prefilledCode).then(function(m){ if(m) setMeta(m); });
  },[]);

  return <div style={{maxWidth:640,margin:"0 auto",padding:"clamp(22px,5vw,56px) 24px"}}>
    <SectionLabel>Jouw individuele resultaat</SectionLabel>
    <Heading size={2}>Jouw teampatroon in beeld</Heading>

    {/* Context note for team members */}
    {prefilledCode&&meta&&<div style={{background:C.warm,borderRadius:12,padding:"13px 17px",marginBottom:16,display:"flex",alignItems:"flex-start",gap:10}}>
      <div style={{width:7,height:7,borderRadius:"50%",background:C.olive,flexShrink:0,marginTop:5}}/>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.charcoal,margin:0,lineHeight:1.6}}>
        Dit is jouw <strong>individuele analyse</strong>, gebaseerd op jouw eigen antwoorden.
        Jouw antwoorden zijn <strong>anoniem</strong> en worden samengevoegd met die van je teamgenoten voor het teamgemiddelde, zodra jij hieronder op 'Resultaten indienen' hebt geklikt.
      </p>
    </div>}

    <Card>
      <SectionLabel>Energie per dimensie</SectionLabel>
      <RadarViz data={catScores}/>
    </Card>

    <Card>
      <SectionLabel>Scores per categorie</SectionLabel>
      {Object.entries(catScores).map(function(e){return <ScorePill key={e[0]} label={e[0]} score={e[1]}/>;})
      }
      {!prefilledCode&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginTop:20,paddingTop:16,borderTop:"1px solid "+C.warm}}>
        <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,margin:0,lineHeight:1.5}}>Wil je weten hoe je team dit ervaart?</p>
        <Btn variant="primary" onClick={props.onDone} style={{fontSize:13,padding:"9px 20px",whiteSpace:"nowrap"}}>Maak een team aan →</Btn>
      </div>}
    </Card>

    <Card style={{background:C.warm,border:"none"}}>
      <SectionLabel>Analyse · individueel</SectionLabel>
      {loading ? <><p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,margin:0}}>Analyse wordt gegenereerd...</p><LoadingDots/></> : analysis&&<AnalysisBlock analysis={analysis} isTeam={false} cta={
        !emailSubmitted
          ? <EmailDropdown canReceiveTeamAnalysis={canReceiveTeamAnalysis} onSubmit={function(name,email){
              apiSaveEmail(prefilledCode||"", getSessionId(), name, email, canReceiveTeamAnalysis, analysis).finally(function(){ setEmailSubmitted(true); });
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
      <p style={{fontFamily:FONT_BODY,fontSize:15,color:"#b8c9a3",marginBottom:12,lineHeight:1.75,marginTop:0}}>In mijn Team-dynamiek traject help ik teams deze patronen zichtbaar te maken en om te zetten naar betere samenwerking, duidelijker eigenaarschap en meer energie in het team.</p>
      <p style={{fontFamily:FONT_BODY,fontSize:15,color:"#b8c9a3",marginBottom:28,lineHeight:1.75,marginTop:0}}>Wil je eerst zien hoe dit traject eruitziet? Download hieronder de Team-dynamiek trajectbeschrijving of plan een vrijblijvend intakegesprek om samen naar jullie uitkomst te kijken.</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:12,marginTop:4}}>
        <Btn variant="ghost" onClick={function(){window.open("https://erikvandongen.eu/inzicht-in-teamdynamiek","_blank");}} style={{fontSize:14,padding:"11px 24px",border:"1.5px solid rgba(255,255,255,0.5)",color:C.white,background:"transparent"}}>Meer over het Team-dynamiek traject</Btn>
        <Btn variant="white" onClick={function(){window.open("https://erikvandongen.eu/kennismaken","_blank");}} style={{fontSize:14,padding:"12px 24px"}}>Plan een vrijblijvend intakegesprek</Btn>
      </div>
    </Card>

    <p style={{fontFamily:FONT_BODY,fontSize:12,color:C.neutral,textAlign:"center",marginTop:22,marginBottom:80,lineHeight:1.6}}>De analyse wordt ondersteund door AI en gebaseerd op jouw antwoorden. De uitkomst is bedoeld als reflectie en gesprekstarter.</p>

    {/* Floating CTA */}
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:200,padding:"12px 16px",background:"linear-gradient(to top, rgba(245,240,232,1) 60%, rgba(245,240,232,0))",pointerEvents:"none"}}>
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
                <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.1rem",color:C.white,margin:"0 0 4px",lineHeight:1.3}}>Wil je weten hoe je team dit ervaart?</p>
                <p style={{fontFamily:FONT_BODY,fontSize:13,color:"#b8c9a3",margin:0}}>Maak een team aan en nodig je collega's uit, gratis en anoniem.</p>
              </div>
              <Btn variant="white" onClick={props.onDone} style={{flexShrink:0,fontSize:15,whiteSpace:"nowrap"}}>Maak een team aan →</Btn>
            </div>
        }
      </div>
    </div>
    <style>{`@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1)}}`}</style>
  </div>;
}

// ─── TEAM PAGE ────────────────────────────────────────────────────────────────
function TeamPage(props) {
  var answers = props.answers || {};
  var prefilledCode = props.prefilledCode;
  var catScores = calcCategoryScores(answers);

  var [step, setStep] = useState(prefilledCode ? "loading" : "intro");
  var [teamCode, setTeamCode] = useState(prefilledCode||"");
  var [teamData, setTeamData] = useState([]);

  // Create form
  var [ownerName, setOwnerName] = useState("");
  var [ownerEmail, setOwnerEmail] = useState("");
  var [companyName, setCompanyName] = useState("");
  var [teamName, setTeamName] = useState("");
  var [memberCount, setMemberCount] = useState("");
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
      apiSaveEntry(prefilledCode, getSessionId(), catScores, null)
        .catch(function(){})
        .then(function(){
          return Promise.all([
            apiGetEntries(prefilledCode).catch(function(){ return []; }),
            apiGetTeam(prefilledCode).catch(function(){ return null; })
          ]);
        })
        .then(function(results){
          var entries = results[0] || [];
          var teamMeta = results[1];
          setTeamData(entries);
          if(teamMeta) setMeta(teamMeta);
          setStep("view");
        })
        .catch(function(){
          setStep("view");
        });
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

  var inviteLink = "https://spiegel.erikvandongen.eu?team=" + teamCode;
  var shareMsg = meta
    ? meta.ownerName+" nodigt je uit voor de Team Energie Spiegel van team "+meta.teamName+".\n\nOpen deze link, de teamcode wordt automatisch ingevuld:\n"+inviteLink+"\n\nOf gebruik code "+teamCode+" op spiegel.erikvandongen.eu"
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
    var m = {ownerName:ownerName.trim(),ownerEmail:ownerEmail.trim(),teamName:teamName.trim(),memberCount:parseInt(memberCount),shareWithAll:shareWithAll,ownerToken:token,createdAt:Date.now()};
    try {
      await apiCreateTeam({teamCode:code,teamName:m.teamName,ownerName:m.ownerName,ownerEmail:m.ownerEmail,companyName:companyName.trim(),memberCount:m.memberCount,shareWithAll:m.shareWithAll,ownerToken:token});
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
      <p style={{fontFamily:FONT_BODY,fontSize:15,color:C.muted,lineHeight:1.7,marginBottom:26,marginTop:0}}>Laat teamleden dezelfde spiegel invullen. Zo zie je waar jullie beleving overeenkomt en waar percepties uiteen lopen.</p>
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
        <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,lineHeight:1.5,marginBottom:14,marginTop:0}}>Hierop ontvang je de teamresultaten zodra iedereen heeft ingevuld.</p>
        <FormInput label="Jouw naam" placeholder="Erik van Dongen" value={ownerName} onChange={setOwnerName}/>
        <FormInput label="Bedrijfsnaam" placeholder="Bijv. Acme B.V." value={companyName} onChange={setCompanyName}/>
        <FormInput label="Jouw e-mailadres" type="email" placeholder="erik@erikvandongen.eu" value={ownerEmail} onChange={setOwnerEmail} hint="Je ontvangt hier de teamanalyse en je beheerlink." subHint="Door je e-mail achter te laten ga je akkoord met de privacyverklaring."/>
      </Card>

      <Card>
        <SectionLabel>Teaminstellingen</SectionLabel>
        <FormInput label="Teamnaam" placeholder="Bijv. MT Commercie" value={teamName} onChange={setTeamName}/>
        <FormInput label="Aantal teamleden (inclusief jezelf)" placeholder="Bijv. 6" value={memberCount} onChange={setMemberCount} hint="Jouw eigen analyse telt mee als 1. Nodig je 5 collega's uit? Vul dan 6 in."/>
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
          Sla deze link op, hiermee bekijk je op elk moment de tussentijdse resultaten. Je hoeft de spiegel <strong>niet</strong> opnieuw in te vullen. <strong>We hebben deze link ook naar {createdMeta.ownerEmail} gestuurd</strong>, zodat je hem altijd terug kunt vinden in je inbox.
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
        <p style={{fontFamily:FONT_BODY,fontSize:12,color:C.muted,marginTop:10,marginBottom:0}}>⚠ Deze link is alleen voor jou, deel hem niet met je teamleden.</p>
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
        <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:12,marginTop:0}}>Stuur deze link naar je teamleden. De teamcode wordt automatisch ingevuld, ze hoeven alleen nog maar op start te klikken.</p>
        <div style={{background:C.warm,borderRadius:10,padding:"11px 15px",marginBottom:14,fontFamily:FONT_BODY,fontSize:13,color:C.charcoal,wordBreak:"break-all",lineHeight:1.5}}>{inviteLink}</div>
        <div style={{background:C.cream,borderRadius:10,padding:"11px 15px",marginBottom:18,fontFamily:FONT_BODY,fontSize:13,color:C.charcoal,lineHeight:1.6,whiteSpace:"pre-line"}}>{shareMsg}</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Btn variant="secondary" onClick={function(){window.open("mailto:?subject=Doe de Team Energie Spiegel - "+createdMeta.teamName+"&body="+encodeURIComponent(shareMsg));}}>✉ Deel via e-mail</Btn>
          <Btn variant="secondary" onClick={function(){window.open("https://wa.me/?text="+encodeURIComponent(shareMsg));}}>↗ Deel via WhatsApp</Btn>
        </div>
      </Card>

      <Card>
        <SectionLabel>Wat gebeurt er nu?</SectionLabel>
        {[
          {n:"1",t:"Teamleden vullen de spiegel in",d:"Via de uitnodigingslink. Hun antwoorden zijn volledig anoniem."},
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
    {step==="loading"&&<Card style={{textAlign:"center",padding:"32px"}}><LoadingDots/><p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,marginTop:16}}>Resultaten worden opgeslagen...</p></Card>}
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

        </div>
        <div style={{height:6,background:"rgba(69,84,59,0.2)",borderRadius:3,overflow:"hidden"}}>
          <div style={{height:"100%",width:progressPct+"%",background:C.olive,borderRadius:3,transition:"width 0.5s ease"}}/>
        </div>
        {completed>=target&&target>0&&<p style={{fontFamily:FONT_BODY,fontSize:13,color:C.olive,fontWeight:600,marginTop:8,marginBottom:0}}>✓ Iedereen heeft de spiegel ingevuld!</p>}
        {completed<target&&<p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,marginTop:8,marginBottom:0}}>Nog {target-completed} {target-completed===1?"teamlid":"teamleden"} te gaan.</p>}
      </Card>}

      <Card>
        <SectionLabel>{meta&&!meta.shareWithAll?"Jouw eigen scores":"Gemiddelde teamscores"}{meta&&meta.shareWithAll&&completed>1?" ("+completed+" deelnemers)":""}</SectionLabel>
        <RadarViz data={avg()}/>
      </Card>

      <Card>
        <SectionLabel>{meta&&!meta.shareWithAll?"Jouw scores per categorie":"Teamgemiddelde per categorie"}</SectionLabel>
        {Object.entries(avg()).map(function(e){return <ScorePill key={e[0]} label={e[0]} score={e[1]}/>;})}</Card>

      {/* Team analyse — alleen tonen als shareWithAll of als owner */}
      {(meta&&meta.shareWithAll||props.isOwner)&&<Card style={{background:C.warm,border:"none"}}>
        <SectionLabel>Teamanalyse</SectionLabel>
        {!teamAnalysisLoaded&&!teamAnalysisLoading&&<>
          <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:14,marginTop:0}}>Genereer een teamanalyse op basis van het gemiddelde van <strong>{completed} deelnemer{completed!==1?"s":""}</strong>. Individuele antwoorden blijven anoniem.</p>
          <Btn onClick={handleTeamAnalysis}>Genereer teamanalyse</Btn>
        </>}
        {teamAnalysisLoading&&<><p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,margin:0}}>Teamanalyse wordt gegenereerd...</p><LoadingDots/></>}
        {teamAnalysisLoaded&&teamAnalysis&&<AnalysisBlock analysis={teamAnalysis} isTeam={true}/>}
      </Card>}

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
          label={"De teamaanmaker heeft ingesteld dat iedereen de teamanalyse mag ontvangen. Laat je e-mailadres achter, je ontvangt de analyse zodra ze beschikbaar is."}
          hint="Alleen de teamanalyse. Geen spam."
          buttonLabel="Stuur mij de teamanalyse"
          onSubmit={function(name,email){ apiSaveEmail(teamCode, getSessionId(), name, email, true, props.personalAnalysis||null).finally(function(){ setTeamEmailSubmitted(true); }); }}
          submitted={teamEmailSubmitted}
          submittedMsg="Genoteerd ✓, je ontvangt de teamanalyse zodra die beschikbaar is."
        />
      </Card>}

      {/* Share reminder — alleen voor owner/beheerder */}
      {(props.isOwner||props.isDemo)&&meta&&completed<target&&<Card>
        <SectionLabel>Nog niet iedereen ingevuld?</SectionLabel>
        <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.5,marginBottom:14,marginTop:0}}>Stuur alle teamleden een herinnering om de test in te vullen.</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Btn variant="secondary" onClick={function(){window.open("mailto:?subject=Reminder: "+meta.teamName+" Team Energie Spiegel&body="+encodeURIComponent(shareMsg));}}>✉ Stuur reminder</Btn>
          <Btn variant="secondary" onClick={function(){window.open("https://wa.me/?text="+encodeURIComponent(shareMsg));}}>↗ WhatsApp</Btn>
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
  teamName:"MT Commercie", memberCount:6,
  shareWithAll:false, ownerToken:DEMO_TOKEN,
  createdAt: Date.now() - 3*86400000,
};
var DEMO_ENTRIES = [
  {scores:{Vertrouwen:4.2,Eigenaarschap:3.1,Samenwerking:2.0,Richting:1.8,Tempo:4.4},sid:"s1",email:null,ts:Date.now()-2*86400000},
  {scores:{Vertrouwen:4.5,Eigenaarschap:3.4,Samenwerking:2.5,Richting:2.0,Tempo:4.0},sid:"s2",email:null,ts:Date.now()-1.5*86400000},
  {scores:{Vertrouwen:3.8,Eigenaarschap:3.0,Samenwerking:1.8,Richting:1.5,Tempo:4.2},sid:"s3",email:null,ts:Date.now()-1*86400000},
  {scores:{Vertrouwen:4.0,Eigenaarschap:3.3,Samenwerking:2.2,Richting:2.2,Tempo:3.8},sid:"s4",email:"anna@bedrijf.nl",ts:Date.now()-0.5*86400000},
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
    if(isDemo) {
      // Auto-genereer analyse voor demo
      fetchAIAnalysis(
        {Vertrouwen:4.125,Eigenaarschap:3.2,Samenwerking:2.125,Richting:1.875,Tempo:4.1},
        4, true
      ).then(function(result){ setTeamAnalysis(result); setTeamAnalysisLoaded(true); });
      return;
    }
    function loadData() {
      apiGetTeam(teamCode).then(function(m){
        if(m) {
          setMeta(m);
          if(m.analysis && !teamAnalysisLoaded) { setTeamAnalysis(m.analysis); setTeamAnalysisLoaded(true); }
        }
      });
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
  var avg = completed ? calcAvgScores(teamData) : null;
  var inviteLink = "https://spiegel.erikvandongen.eu?team="+teamCode;
  var shareMsg = "Hoi! Wil je de Team Energie Spiegel invullen voor "+meta.teamName+"?\n\n"+inviteLink;

  async function handleSaveTeamAnalysis(analysis) {
    try {
      await fetch("/api/teams", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({teamCode, analysis}) });
    } catch(e){ console.error(e); }
  }

  return <div style={{maxWidth:640,margin:"0 auto",padding:"clamp(22px,5vw,56px) 24px"}}>
    {isDemo&&<div style={{background:C.terra,borderRadius:14,padding:"14px 20px",marginBottom:24,display:"flex",alignItems:"flex-start",gap:12}}>
            <div>
        <p style={{fontFamily:FONT_BODY,fontSize:14,fontWeight:700,color:C.white,marginBottom:3,marginTop:0}}>Dit is een voorbeeldweergave</p>
        <p style={{fontFamily:FONT_BODY,fontSize:13,color:"rgba(255,255,255,0.85)",marginBottom:0,marginTop:0,lineHeight:1.5}}>Je ziet hoe het dashboard eruitziet als teamaanmaker, met 4 van 6 ingevulde resultaten. Alle data is fictief.</p>
      </div>
    </div>}
    <div style={{marginBottom:28}}>
      <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#E8EDE3",borderRadius:8,padding:"4px 12px",marginBottom:14}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:C.olive}}/>
        <span style={{fontFamily:FONT_BODY,fontSize:11,color:C.olive,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>Beheerdersdashboard</span>
      </div>
      <Heading size={2}>{meta.teamName}</Heading>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,margin:0}}>Aangemaakt door {meta.ownerName} · {meta.ownerEmail}</p>
    </div>

    <Card style={{background:C.warm,border:"none"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <p style={{fontFamily:FONT_BODY,fontSize:11,color:C.muted,marginBottom:3,marginTop:0,textTransform:"uppercase",letterSpacing:"0.06em"}}>Voortgang</p>
          <p style={{fontFamily:FONT_BODY,fontSize:26,fontWeight:700,color:C.charcoal,marginTop:0,marginBottom:0}}>{completed} <span style={{fontSize:14,fontWeight:400,color:C.muted}}>/ {target} teamleden</span></p>
        </div>

      </div>
      <div style={{height:8,background:"rgba(69,84,59,0.2)",borderRadius:4,overflow:"hidden",marginBottom:8}}>
        <div style={{height:"100%",width:progressPct+"%",background:C.olive,borderRadius:4,transition:"width 0.5s ease"}}/>
      </div>
      {completed>=target&&target>0
        ? <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.olive,fontWeight:600,margin:0}}>✓ Iedereen heeft de spiegel ingevuld!</p>
        : <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,margin:0}}>Nog {target-completed} {target-completed===1?"teamlid":"teamleden"} te gaan. Pagina ververst automatisch.</p>}
    </Card>

    {completed>0&&<Card>
      <SectionLabel>Deelnemers ({completed})</SectionLabel>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontFamily:FONT_BODY,fontSize:13,minWidth:420}}>
          <thead><tr style={{borderBottom:"2px solid "+C.warm}}>
            <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>#</th>
            <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>Naam</th>
            <th style={{textAlign:"right",padding:"6px 10px",color:C.muted,fontWeight:600}}>Ingevuld op</th>
          </tr></thead>
          <tbody>{teamData.map(function(e,i){
            return <tr key={e.sid} style={{borderBottom:"1px solid "+C.warm}}>
              <td style={{padding:"8px 10px",color:C.muted}}>{i+1}</td>
              <td style={{padding:"8px 10px",color:C.charcoal,fontWeight:e.name?600:400}}>{e.name||<span style={{color:C.muted,fontStyle:"italic"}}>Anoniem</span>}</td>
              <td style={{padding:"8px 10px",color:C.muted,textAlign:"right"}}>{new Date(e.ts).toLocaleDateString("nl-NL",{day:"numeric",month:"short",year:"numeric"})}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </Card>}

    <Card>
      <SectionLabel>Teamresultaten delen met deelnemers</SectionLabel>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:14,marginTop:0}}>
        {meta.shareWithAll ? "Deelnemers kunnen de teamresultaten momenteel inzien. Je kunt dit uitschakelen." : "Deelnemers zien nu alleen hun eigen resultaten. Schakel in om de teamresultaten ook met hen te delen."}
      </p>
      <Btn variant={meta.shareWithAll?"ghost":"primary"} onClick={async function(){
        try {
          await fetch("/api/teams",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({teamCode,shareWithAll:!meta.shareWithAll})});
          setMeta(Object.assign({},meta,{shareWithAll:!meta.shareWithAll}));
        } catch(e){ console.error(e); }
      }}>{meta.shareWithAll ? "🔒 Resultaten verbergen voor deelnemers" : "🔓 Resultaten zichtbaar maken voor deelnemers"}</Btn>
    </Card>

    {avg ? <>
      <Card>
        <SectionLabel>Gemiddelde teamscores ({completed} deelnemer{completed!==1?"s":""})</SectionLabel>
        <RadarViz data={avg}/>
      </Card>
      <Card>
        <SectionLabel>Per categorie</SectionLabel>
        {Object.entries(avg).map(function(e){return <ScorePill key={e[0]} label={e[0]} score={e[1]}/>;})}</Card>
      <Card style={{background:C.warm,border:"none"}}>
        <SectionLabel>Teamanalyse</SectionLabel>
        {!teamAnalysisLoaded&&!teamAnalysisLoading&&<>
          <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:14,marginTop:0}}>Genereer een AI-analyse op basis van de {completed} resultaten die nu beschikbaar zijn.</p>
          <Btn onClick={function(){
            setTeamAnalysisLoading(true);
            fetchAIAnalysis(avg, completed, true).then(function(r){ setTeamAnalysis(r); setTeamAnalysisLoading(false); setTeamAnalysisLoaded(true); handleSaveTeamAnalysis(r); });
          }}>Genereer teamanalyse</Btn>
        </>}
        {teamAnalysisLoading&&<><p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,margin:0}}>Teamanalyse wordt gegenereerd...</p><LoadingDots/></>}
        {teamAnalysisLoaded&&teamAnalysis&&<>
          <AnalysisBlock analysis={teamAnalysis} isTeam={true}/>
        </>}
      </Card>
      <Card>
        <SectionLabel>Exporteren</SectionLabel>
        <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:14,marginTop:0}}>Download de teamresultaten inclusief deelnemersoverzicht{teamAnalysis?" en AI-analyse":""} als CSV of PDF.</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Btn variant="secondary" onClick={function(){ exportTeamCSV(meta, teamData, avg, teamAnalysis); }}>↓ Download CSV</Btn>
          <Btn variant="secondary" onClick={function(){ exportTeamPDF(meta, teamData, avg, teamAnalysis); }}>↓ Download PDF</Btn>
        </div>
      </Card>
    </> : <Card>
      <p style={{fontFamily:FONT_BODY,fontSize:15,color:C.muted,lineHeight:1.6,margin:0,textAlign:"center",padding:"16px 0"}}>Nog geen resultaten, stuur de uitnodigingslink naar je team.</p>
    </Card>}

    <Card>
      <SectionLabel>Uitnodigingslink voor teamleden</SectionLabel>
      <div style={{background:C.warm,borderRadius:10,padding:"10px 14px",marginBottom:14,fontFamily:FONT_BODY,fontSize:13,color:C.charcoal,wordBreak:"break-all"}}>{inviteLink}</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <Btn variant="secondary" onClick={function(){window.open("mailto:?subject=Reminder Team Energie Spiegel - "+meta.teamName+"&body="+encodeURIComponent("Reminder: vul de Team Energie Spiegel in voor team "+meta.teamName+".\n\n"+inviteLink));}}>✉ Stuur reminder</Btn>
        <Btn variant="secondary" onClick={function(){window.open("https://wa.me/?text="+encodeURIComponent("Reminder voor team "+meta.teamName+": "+inviteLink));}}>↗ WhatsApp</Btn>
      </div>
    </Card>
    <Card style={{background:C.olive,border:"none"}}>
      <div style={{display:"inline-block",background:"rgba(255,255,255,0.12)",borderRadius:20,padding:"3px 13px",marginBottom:16}}>
        <span style={{fontFamily:FONT_BODY,fontSize:11,color:"#c0d4a8",letterSpacing:"0.1em",textTransform:"uppercase"}}>Van diagnose naar beweging</span>
      </div>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"clamp(1.3rem,3.5vw,1.75rem)",color:C.white,marginBottom:16,marginTop:0,lineHeight:1.3}}>Je weet nu waar energie lekt in jullie team.</p>
      <p style={{fontFamily:FONT_BODY,fontSize:15,color:"#b8c9a3",marginBottom:12,lineHeight:1.75,marginTop:0}}>In bijna ieder team zijn de intenties goed. Toch ontstaan er irritaties die steeds terugkomen. Niet omdat mensen onprofessioneel zijn, maar omdat verschillen in tempo, stijl en prioriteit onbewust botsen.</p>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.15rem",color:C.white,marginBottom:12,marginTop:0,fontWeight:400,fontStyle:"italic"}}>En precies daar zit de kans.</p>
      <p style={{fontFamily:FONT_BODY,fontSize:15,color:"#b8c9a3",marginBottom:12,lineHeight:1.75,marginTop:0}}>In mijn Team-dynamiek traject help ik teams deze patronen zichtbaar te maken en om te zetten naar betere samenwerking, duidelijker eigenaarschap en meer energie in het team.</p>
      <p style={{fontFamily:FONT_BODY,fontSize:15,color:"#b8c9a3",marginBottom:28,lineHeight:1.75,marginTop:0}}>Wil je eerst zien hoe dit traject eruitziet? Download hieronder de Team-dynamiek trajectbeschrijving of plan een vrijblijvend intakegesprek om samen naar jullie uitkomst te kijken.</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:12,marginTop:4}}>
        <Btn variant="ghost" onClick={function(){window.open("https://erikvandongen.eu/inzicht-in-teamdynamiek","_blank");}} style={{fontSize:14,padding:"11px 24px",border:"1.5px solid rgba(255,255,255,0.5)",color:C.white,background:"transparent"}}>Meer over het Team-dynamiek traject</Btn>
        <Btn variant="white" onClick={function(){window.open("https://erikvandongen.eu/kennismaken","_blank");}} style={{fontSize:14,padding:"12px 24px"}}>Plan een vrijblijvend intakegesprek</Btn>
      </div>
    </Card>
    <style>{`@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1)}}`}</style>
  </div>;
}


// ─── ADMIN DASHBOARD ──────────────────────────────────────────────────────────
function AdminAnalysisBtn(props) {
  var [loading, setLoading] = useState(false);
  async function handleGenerate() {
    setLoading(true);
    try {
      var a = await fetchAIAnalysis(props.avg, props.team.entries.length, true);
      await fetch("/api/teams",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({teamCode:props.team.teamCode,analysis:a})});
      props.onDone(a);
    } finally { setLoading(false); }
  }
  return <div>
    <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,lineHeight:1.6,marginBottom:14,marginTop:0}}>Er is nog geen teamanalyse gegenereerd voor dit team.</p>
    {loading ? <><p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,margin:0}}>Analyse wordt gegenereerd...</p><LoadingDots/></> : <Btn onClick={handleGenerate}>Genereer teamanalyse</Btn>}
  </div>;
}

function AdminDashboard() {
  var [password, setPassword] = useState("");
  var [authed, setAuthed] = useState(false);
  var [error, setError] = useState(null);
  var [loading, setLoading] = useState(false);
  var [data, setData] = useState(null);
  var [selectedTeam, setSelectedTeam] = useState(null);
  var [selectedTester, setSelectedTester] = useState(null);

  function calcAvg(entries) {
    if (!entries.length) return null;
    const cats = ['Vertrouwen', 'Eigenaarschap', 'Samenwerking', 'Richting', 'Tempo'];
    const result = {};
    cats.forEach(cat => {
      result[cat] = parseFloat((entries.reduce((acc, e) => acc + (e.scores[cat] || 0), 0) / entries.length).toFixed(2));
    });
    return result;
  }

  async function handleLogin() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ password })
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Ongeldig wachtwoord"); setLoading(false); return; }
      setData(json); setAuthed(true); setLoading(false);
    } catch(e) { setError("Verbindingsfout"); setLoading(false); }
  }

  if (!authed) return <div style={{minHeight:"100vh",background:C.cream,display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{background:C.white,borderRadius:16,padding:"40px 36px",boxShadow:"0 4px 40px rgba(44,44,42,0.1)",width:"100%",maxWidth:380}}>
      <div style={{textAlign:"center",marginBottom:28}}>
        <div style={{width:40,height:40,background:C.olive,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px"}}>
          <div style={{display:"flex",gap:2,alignItems:"flex-end",height:20}}>{[8,12,16,12,8].map(function(h,i){return <div key={i} style={{width:3,height:h,background:C.cream,borderRadius:1}}/>;})}</div>
        </div>
        <p style={{fontFamily:FONT_BODY,fontSize:11,color:C.muted,letterSpacing:"0.1em",textTransform:"uppercase",margin:"0 0 6px"}}>Team Energie Spiegel</p>
        <h1 style={{fontFamily:FONT_DISPLAY,fontSize:"1.6rem",color:C.charcoal,margin:0,fontWeight:400}}>Admin</h1>
      </div>
      <FormInput label="Wachtwoord" type="password" placeholder="••••••••" value={password} onChange={setPassword}/>
      {error&&<p style={{fontFamily:FONT_BODY,fontSize:13,color:C.terra,margin:"-8px 0 12px"}}>{error}</p>}
      <Btn onClick={handleLogin} disabled={loading||!password} style={{width:"100%",justifyContent:"center"}}>
        {loading ? "Laden..." : "Inloggen"}
      </Btn>
    </div>
  </div>;

  if (selectedTester) {
    var tr = selectedTester;
    var naam = tr.anonymous || !tr.name ? "Anoniem" : tr.name;
    return <div style={{maxWidth:800,margin:"0 auto",padding:"clamp(22px,5vw,48px) 24px"}}>
      <button onClick={function(){setSelectedTester(null);}} style={{background:"none",border:"none",cursor:"pointer",fontFamily:FONT_BODY,fontSize:14,color:C.muted,marginBottom:20,padding:0}}>← Terug naar overzicht</button>
      <div style={{marginBottom:24}}>
        <SectionLabel>Testersfeedback</SectionLabel>
        <Heading size={2}>{naam}</Heading>
        <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,margin:"4px 0 0"}}>{new Date(tr.created_at).toLocaleDateString("nl-NL")} · {tr.team_getest==="ja"?"Heeft team getest":"Alleen scan ingevuld"}</p>
      </div>
      {[
        ["Eerste indruk",""],
        ["Wat was je eerste reactie?", tr.eerste_reactie],
        ["Voor welk type team?", tr.doelgroep],
        ["Ervaring",""],
        ["Invul ervaring", tr.invul_ervaring ? tr.invul_ervaring+"/5"+(tr.invul_toelichting?" — "+tr.invul_toelichting:"") : null],
        ["Aantal vragen", tr.aantal_vragen+(tr.aantal_vragen_opmerking?" — "+tr.aantal_vragen_opmerking:"")],
        ["12 vragen betrouwbaar?", tr.aantal_vragen_betrouwbaar+(tr.aantal_vragen_advies?" — "+tr.aantal_vragen_advies:"")],
        ["Blokkade", tr.blokkade],
        ["Sterkste onderdeel", tr.sterkste],
        ["Analyse",""],
        ["Persoonlijke analyse lengte", tr.analyse_lengte],
        ["Persoonlijke analyse taal", tr.analyse_taal],
        ["Opmerkingen analyse", tr.analyse_opmerking],
        ["Teamanalyse lengte", tr.team_analyse_lengte],
        ["Teamanalyse taal", tr.team_analyse_taal],
        ["Team aanmaken", tr.team_aanmaken ? tr.team_aanmaken+"/5"+(tr.team_aanmaken_toelichting?" — "+tr.team_aanmaken_toelichting:"") : null],
        ["Waarde",""],
        ["Inzetten voor eigen team", tr.inzetten_keuze+(tr.inzetten?" — "+tr.inzetten:"")],
        ["Verbeteringen",""],
        ["Wat mist", tr.mist],
        ["Overig", tr.overig],
      ].map(function(row, i) {
        if (!row[1]) {
          if (row[0] && !row[1] && row[1]!=="") return null;
          // sectieheader
          return <p key={i} style={{fontFamily:FONT_BODY,fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",color:C.muted,margin:"24px 0 8px"}}>{row[0]}</p>;
        }
        return <Card key={i} style={{marginBottom:8,padding:"14px 18px"}}>
          <p style={{fontFamily:FONT_BODY,fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:"0.06em",margin:"0 0 4px"}}>{row[0]}</p>
          <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.charcoal,margin:0,lineHeight:1.6}}>{row[1]}</p>
        </Card>;
      })}
    </div>;
  }

  if (selectedTeam) {
    const t = selectedTeam;
    const avg = calcAvg(t.entries);
    return <div style={{maxWidth:700,margin:"0 auto",padding:"clamp(22px,5vw,48px) 24px"}}>
      <button onClick={function(){setSelectedTeam(null);}} style={{background:"none",border:"none",cursor:"pointer",fontFamily:FONT_BODY,fontSize:14,color:C.muted,marginBottom:20,padding:0}}>← Terug naar overzicht</button>
      <div style={{marginBottom:24}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#E8EDE3",borderRadius:8,padding:"4px 12px",marginBottom:12}}>
          <span style={{fontFamily:FONT_BODY,fontSize:11,color:C.olive,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>Team detail</span>
        </div>
        <Heading size={2}>{t.teamName}</Heading>
        <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,margin:0}}>{t.ownerName} · {t.ownerEmail} · Aangemaakt {new Date(t.createdAt).toLocaleDateString("nl-NL")}</p>
      </div>

      <Card style={{background:C.warm,border:"none"}}>
        <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
          {[["Verwacht",t.memberCount],["Ingevuld",t.entries.length],].map(function(item){
            return <div key={item[0]}>
              <p style={{fontFamily:FONT_BODY,fontSize:11,color:C.muted,margin:"0 0 2px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{item[0]}</p>
              <p style={{fontFamily:FONT_BODY,fontSize:20,fontWeight:700,color:C.charcoal,margin:0}}>{item[1]}</p>
            </div>;
          })}
        </div>
      </Card>

      {avg&&<><Card>
        <SectionLabel>Gemiddelde scores</SectionLabel>
        <RadarViz data={avg}/>
      </Card>
      <Card>
        <SectionLabel>Per categorie</SectionLabel>
        {Object.entries(avg).map(function(e){return <ScorePill key={e[0]} label={e[0]} score={e[1]}/>;})}</Card></>}

      <Card style={{background:C.warm,border:"none"}}>
        <SectionLabel>Teamanalyse</SectionLabel>
        {t.analysis
          ? <><p style={{fontFamily:FONT_BODY,fontSize:12,color:C.muted,margin:"0 0 12px"}}>{t.analysisAt ? "Gegenereerd op "+new Date(t.analysisAt).toLocaleDateString("nl-NL") : ""}</p>
              <AnalysisBlock analysis={t.analysis} isTeam={true}/>
              <Btn variant="ghost" style={{marginTop:12}} onClick={async function(){
                if(!avg||!window.confirm("Nieuwe analyse genereren?")) return;
                const a = await fetchAIAnalysis(avg, t.entries.length, true);
                await fetch("/api/teams",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({teamCode:t.teamCode,analysis:a})});
                setSelectedTeam(Object.assign({},t,{analysis:a,analysisAt:Date.now()}));
              }}>↺ Opnieuw genereren</Btn></>
          : t.entries.length>0
            ? <AdminAnalysisBtn team={t} avg={avg} onDone={function(a){ setSelectedTeam(Object.assign({},t,{analysis:a,analysisAt:Date.now()})); }}/>
            : <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,margin:0}}>Nog geen deelnemers ingevuld.</p>
        }
      </Card>

      {t.entries.length>0&&<Card>
        <SectionLabel>Deelnemers ({t.entries.length})</SectionLabel>
        <table style={{width:"100%",borderCollapse:"collapse",fontFamily:FONT_BODY,fontSize:13}}>
          <thead><tr style={{borderBottom:"2px solid "+C.warm}}>
            <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>#</th>
            <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>Naam</th>
            <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>E-mail</th>
            <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>Datum</th>
          </tr></thead>
          <tbody>{t.entries.map(function(e,i){
            return <tr key={e.sid} style={{borderBottom:"1px solid "+C.warm}}>
              <td style={{padding:"8px 10px",color:C.muted}}>{i+1}</td>
              <td style={{padding:"8px 10px",color:C.charcoal}}>{e.name||<span style={{color:C.muted,fontStyle:"italic"}}>Anoniem</span>}</td>
              <td style={{padding:"8px 10px",color:C.muted}}>{new Date(e.ts).toLocaleDateString("nl-NL")}</td>
            </tr>;
          })}</tbody>
        </table>
      </Card>}

      {avg&&<Card>
        <SectionLabel>Exporteren</SectionLabel>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Btn variant="secondary" onClick={function(){ exportTeamCSV(t, t.entries, avg, t.analysis); }}>↓ CSV</Btn>
          <Btn variant="secondary" onClick={function(){ exportTeamPDF(t, t.entries, avg, t.analysis); }}>↓ PDF</Btn>
        </div>
      </Card>}
    </div>;
  }

  return <div style={{maxWidth:800,margin:"0 auto",padding:"clamp(22px,5vw,48px) 24px"}}>
    <div style={{marginBottom:28}}>
      <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#E8EDE3",borderRadius:8,padding:"4px 12px",marginBottom:14}}>
        <span style={{fontFamily:FONT_BODY,fontSize:11,color:C.olive,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>Admin dashboard</span>
      </div>
      <Heading size={2}>Alle teams & sessies</Heading>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))",gap:12,marginBottom:20}}>
      {[["Teams",data.totalTeams],["Sessies",data.totalSessions],["Subscribers",(data.subscribers||[]).length],["Conversie",(data.totalTeams?Math.round((data.totalEntries/data.teams.reduce(function(a,t){return a+t.memberCount;},0))*100):0)+"%"]].map(function(item){
        return <Card key={item[0]} style={{textAlign:"center",padding:"16px"}}>
          <p style={{fontFamily:FONT_BODY,fontSize:11,color:C.muted,margin:"0 0 4px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{item[0]}</p>
          <p style={{fontFamily:FONT_DISPLAY,fontSize:"2rem",color:C.charcoal,margin:0,fontWeight:400}}>{item[1]}</p>
        </Card>;
      })}
    </div>

    {data.subscribers&&data.subscribers.length>0&&<Card style={{marginBottom:20}}>
      <SectionLabel>Abonnees — e-mail opgevraagd ({data.subscribers.length})</SectionLabel>
      <table style={{width:"100%",borderCollapse:"collapse",fontFamily:FONT_BODY,fontSize:13}}>
        <thead><tr style={{borderBottom:"2px solid "+C.warm}}>
          <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>Naam</th>
          <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>E-mail</th>
          <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>Datum</th>
        </tr></thead>
        <tbody>{data.subscribers.map(function(s,i){
          return <tr key={i} style={{borderBottom:"1px solid "+C.warm}}>
            <td style={{padding:"8px 10px",color:C.charcoal,fontWeight:s.name!=="—"?600:400}}>{s.name}</td>
            <td style={{padding:"8px 10px"}}><a href={"mailto:"+s.email} style={{color:C.olive,textDecoration:"none"}}>{s.email}</a></td>
            <td style={{padding:"8px 10px",color:C.muted}}>{new Date(s.date).toLocaleDateString("nl-NL")}</td>
          </tr>;
        })}</tbody>
      </table>
    </Card>}

        {data.feedback&&data.feedback.length>0&&<Card style={{marginBottom:20}}>
      <SectionLabel>Feedback ({data.feedback.length})</SectionLabel>
      <table style={{width:"100%",borderCollapse:"collapse",fontFamily:FONT_BODY,fontSize:13}}>
        <thead><tr style={{borderBottom:"2px solid "+C.warm}}>
          <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>Naam</th>
          <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>Pagina</th>
          <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>Score</th>
          <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>Zou gebruiken</th>
          <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>Opmerking</th>
          <th style={{textAlign:"left",padding:"6px 10px",color:C.muted,fontWeight:600}}>Datum</th>
        </tr></thead>
        <tbody>{data.feedback.map(function(f,i){
          return <tr key={i} style={{borderBottom:"1px solid "+C.warm}}>
            <td style={{padding:"8px 10px",color:C.charcoal}}>{f.naam||<span style={{color:C.muted,fontStyle:"italic"}}>Anoniem</span>}</td>
            <td style={{padding:"8px 10px",color:C.muted}}>{f.page||"—"}</td>
            <td style={{padding:"8px 10px"}}>{f.rating ? "⭐".repeat(f.rating) : "—"}</td>
            <td style={{padding:"8px 10px",color:f.wouldUse==="Ja"?C.olive:f.wouldUse==="Nee"?C.terra:C.muted}}>{f.wouldUse||"—"}</td>
            <td style={{padding:"8px 10px",color:C.charcoal,maxWidth:240}}>{f.comment||<span style={{color:C.muted,fontStyle:"italic"}}>—</span>}</td>
            <td style={{padding:"8px 10px",color:C.muted}}>{new Date(f.createdAt).toLocaleDateString("nl-NL")}</td>
          </tr>;
        })}</tbody>
      </table>
    </Card>}

    {data.testers&&data.testers.length>0&&<>
      <SectionLabel>Testersfeedback ({data.testers.length})</SectionLabel>
      {data.testers.map(function(t,i){
        var naam = t.anonymous||!t.name ? "Anoniem" : t.name;
        return <Card key={i} style={{cursor:"pointer",marginBottom:10,transition:"box-shadow 0.2s"}} onClick={function(){setSelectedTester(t);}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
            <div>
              <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.1rem",color:C.charcoal,margin:"0 0 3px",fontWeight:400}}>{naam}</p>
              <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,margin:0}}>{t.team_getest==="ja"?"Heeft team getest":"Alleen scan ingevuld"}{t.invul_ervaring?" · Ervaring: "+t.invul_ervaring+"/5":""}</p>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <p style={{fontFamily:FONT_BODY,fontSize:12,color:C.muted,margin:"0 0 4px"}}>{new Date(t.created_at).toLocaleDateString("nl-NL")}</p>
              {t.inzetten_keuze&&<span style={{fontFamily:FONT_BODY,fontSize:11,background:t.inzetten_keuze==="ja"?"#E8EDE3":"#FBF0EA",color:t.inzetten_keuze==="ja"?C.olive:C.terra,borderRadius:20,padding:"2px 10px",fontWeight:600}}>Inzetten: {t.inzetten_keuze}</span>}
            </div>
          </div>
        </Card>;
      })}
    </>}

    <div style={{borderTop:"2px solid "+C.warm,margin:"32px 0 24px"}}/>
    <SectionLabel>Teams & sessies</SectionLabel>

    {data.teams.map(function(t){
      var pct = t.memberCount ? Math.round((t.entries.length/t.memberCount)*100) : 0;
      return <Card key={t.teamCode} style={{cursor:"pointer",transition:"box-shadow 0.2s"}} onClick={function(){setSelectedTeam(t);}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontFamily:FONT_BODY,fontSize:11,color:C.muted,margin:"0 0 3px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{t.teamCode}</p>
            <p style={{fontFamily:FONT_DISPLAY,fontSize:"1.2rem",color:C.charcoal,margin:"0 0 4px",fontWeight:400}}>{t.teamName}</p>
            <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,margin:0}}>{t.ownerName} · {t.ownerEmail}</p>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <p style={{fontFamily:FONT_BODY,fontSize:13,fontWeight:700,color:pct>=100?C.olive:C.muted,margin:"0 0 2px"}}>{t.entries.length}/{t.memberCount}</p>
            <p style={{fontFamily:FONT_BODY,fontSize:11,color:C.muted,margin:"0 0 6px"}}>{new Date(t.createdAt).toLocaleDateString("nl-NL")}</p>
            {t.analysis&&<span style={{fontFamily:FONT_BODY,fontSize:11,background:"#E8EDE3",color:C.olive,borderRadius:20,padding:"2px 10px",fontWeight:600}}>✓ Analyse</span>}
          </div>
        </div>
        <div style={{height:4,background:C.warm,borderRadius:2,marginTop:12,overflow:"hidden"}}>
          <div style={{height:"100%",width:pct+"%",background:pct>=100?C.olive:C.clay,borderRadius:2,transition:"width 0.3s"}}/>
        </div>
      </Card>;
    })}
    <style>{`@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1)}}`}</style>
  </div>;
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
// ─── TESTER FORM HELPERS (buiten component om focus-verlies te voorkomen) ───────
function TesterVraag(props) {
  return <div style={{marginBottom:28}}>
    <p style={{fontFamily:FONT_BODY,fontSize:15,color:C.charcoal,margin:"0 0 4px",fontWeight:600,lineHeight:1.5}}>{props.label}</p>
    {props.sub&&<p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,margin:"0 0 6px",lineHeight:1.5}}>{props.sub}</p>}
    {props.children}
  </div>;
}
function TesterTextarea(props) {
  return <textarea value={props.value}
    onChange={function(e){props.onChange(e.target.value);}}
    onKeyDown={function(e){e.stopPropagation();}}
    placeholder={props.placeholder||""}
    style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",borderRadius:10,border:"1.5px solid "+C.warm,fontFamily:FONT_BODY,fontSize:14,color:C.charcoal,background:C.white,outline:"none",resize:"vertical",minHeight:80,lineHeight:1.6,marginTop:8}}/>;
}
function TesterRadio(props) {
  return <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8}}>
    {props.options.map(function(opt){
      var active = props.value === opt.val;
      return <div key={opt.val} onClick={function(){props.onChange(opt.val);}}
        style={{padding:"8px 16px",borderRadius:20,border:"1.5px solid "+(active?C.olive:C.warm),background:active?"#E8EDE3":C.white,cursor:"pointer",fontFamily:FONT_BODY,fontSize:14,color:active?C.olive:C.charcoal,transition:"all 0.15s"}}>
        {opt.label}
      </div>;
    })}
  </div>;
}
function TesterScale(props) {
  return <div style={{display:"flex",gap:8,marginTop:8}}>
    {[1,2,3,4,5].map(function(n){
      var active = props.value === n;
      return <div key={n} onClick={function(){props.onChange(n);}}
        style={{width:44,height:44,borderRadius:"50%",border:"1.5px solid "+(active?C.olive:C.warm),background:active?C.olive:C.white,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT_BODY,fontSize:15,fontWeight:600,color:active?C.white:C.charcoal,transition:"all 0.15s",flexShrink:0}}>
        {n}
      </div>;
    })}
  </div>;
}

// ─── TESTER FORM ──────────────────────────────────────────────────────────────
function TesterForm() {
  var [anonymous, setAnonymous] = useState(null);
  var [name, setName] = useState("");
  var [step, setStep] = useState("intro"); // intro | form | done
  var [saving, setSaving] = useState(false);

  var [f, setF] = useState({
    apparaat:[],
    eersteReactie:"", doelgroep:"",
    teamGetest: null,
    invulErvaring: null, invulToelichting:"",
    aantalVragen: null, aantalVragenOpmerking:"",
    blokkade:"", sterkste:"",
    analyseLengte: null, analyseTaal: null,
    teamAnalyseLengte: null, teamAnalyseTaal: null,
    teamAanmaken: null, teamAanmakenToelichting:"",
    inzetten:"", mist:"", overig:""
  });

  function set(key, val) { setF(function(prev){ return Object.assign({}, prev, {[key]:val}); }); }

  var showTeamVragen = f.teamGetest === "ja";

  async function handleSubmit() {
    setSaving(true);
    try {
      await fetch("/api/tester", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ anonymous, name: anonymous ? null : name, ...f }),
      });
      setStep("done");
    } catch(e) { console.error(e); }
    setSaving(false);
  }



  if(step === "done") return <div style={{maxWidth:560,margin:"0 auto",padding:"clamp(40px,8vw,80px) 24px",textAlign:"center"}}>
    <div style={{background:C.olive,borderRadius:"50%",width:64,height:64,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px"}}>
      <span style={{fontSize:28,color:C.white}}>✓</span>
    </div>
    <Heading size={2}>Bedankt voor je feedback!</Heading>
    <p style={{fontFamily:FONT_BODY,fontSize:16,color:C.muted,lineHeight:1.7,marginTop:8}}>Je input is opgeslagen en helpt de tool beter te maken. Waardevol.</p>
  </div>;

  return <div style={{maxWidth:600,margin:"0 auto",padding:"clamp(28px,5vw,56px) 24px"}}>

    {/* Header */}
    <div style={{background:C.olive,margin:"0 -24px",padding:"22px 24px",marginBottom:40,borderRadius:"0 0 20px 20px"}}>
      <p style={{fontFamily:FONT_DISPLAY,fontSize:28,color:"#F5F3EF",fontWeight:400,margin:"0 0 4px"}}>Testersfeedback</p>
      <p style={{fontFamily:FONT_BODY,fontSize:13,color:"rgba(245,243,239,0.7)",margin:0}}>Team Energie Spiegel · erikvandongen.eu</p>
    </div>

    {step === "intro" && <>
      <Heading size={2}>Bedankt dat je de tool hebt getest.</Heading>
      <p style={{fontFamily:FONT_BODY,fontSize:16,color:C.muted,lineHeight:1.7,marginBottom:32,marginTop:8}}>
        Deze vragenlijst bestaat uit 13 vragen en duurt ongeveer 5 minuten. Je helpt mij de tool te verbeteren. Eerst een kleine keuze:
      </p>
      <Card>
        <p style={{fontFamily:FONT_BODY,fontSize:15,fontWeight:600,color:C.charcoal,margin:"0 0 14px"}}>Wil je je feedback op naam indienen?</p>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[{val:false,title:"Ja, op mijn naam",desc:"Je naam wordt zichtbaar in het overzicht."},{val:true,title:"Nee, anoniem",desc:"Alleen je antwoorden worden opgeslagen."}].map(function(opt){
            return <div key={String(opt.val)} onClick={function(){setAnonymous(opt.val);}}
              style={{padding:"13px 17px",borderRadius:12,border:"2px solid "+(anonymous===opt.val?C.olive:C.warm),cursor:"pointer",background:anonymous===opt.val?"#E8EDE3":C.white,transition:"all 0.15s"}}>
              <p style={{fontFamily:FONT_BODY,fontSize:14,fontWeight:600,color:C.charcoal,margin:"0 0 2px"}}>{opt.title}</p>
              <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,margin:0}}>{opt.desc}</p>
            </div>;
          })}
        </div>
        {anonymous === false && <div style={{marginTop:16}}>
          <FormInput label="Jouw naam" value={name} onChange={setName} placeholder="Voornaam en achternaam"/>
        </div>}
        <Btn onClick={function(){setStep("form");}} style={{marginTop:20,width:"100%",justifyContent:"center"}}
          disabled={anonymous===null||(anonymous===false&&!name.trim())}>
          Start de vragenlijst →
        </Btn>
      </Card>
    </>}

    {step === "form" && <>
      <p style={{fontFamily:FONT_BODY,fontSize:14,color:C.muted,marginBottom:32,marginTop:0,lineHeight:1.6}}>
        {anonymous ? "Je antwoorden worden anoniem opgeslagen." : "Je antwoorden worden opgeslagen op naam van "+name+"."}
      </p>

      {/* Apparaat */}
      <Card style={{marginBottom:20}}>
        <TesterVraag label="Op welk apparaat heb je de test gedaan?" sub="Je kunt meerdere opties selecteren.">
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8}}>
            {["Mobiel","Desktop / laptop","Tablet"].map(function(opt){
              var active = f.apparaat.indexOf(opt) > -1;
              return <div key={opt} onClick={function(){
                set("apparaat", active ? f.apparaat.filter(function(a){return a!==opt;}) : f.apparaat.concat(opt));
              }} style={{padding:"8px 16px",borderRadius:20,border:"1.5px solid "+(active?C.olive:C.warm),background:active?"#E8EDE3":C.white,cursor:"pointer",fontFamily:FONT_BODY,fontSize:14,color:active?C.olive:C.charcoal,transition:"all 0.15s"}}>
                {opt}
              </div>;
            })}
          </div>
        </TesterVraag>
      </Card>

      {/* Blok 1 */}
      <p style={{fontFamily:FONT_BODY,fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",color:C.muted,marginBottom:16}}>Eerste indruk</p>
      <Card>
        <TesterVraag label="1. Wat was je eerste reactie toen je hoorde wat de tool doet?">
          <TesterTextarea value={f["eersteReactie"]} onChange={function(v){set("eersteReactie",v);}} placeholder="Vertel het ons..."/>
        </TesterVraag>
        <TesterVraag label="2. Voor welk type team of organisatie zie jij dit het meest werken?">
          <TesterTextarea value={f["doelgroep"]} onChange={function(v){set("doelgroep",v);}} placeholder="Bijv. MT's, teams in groei, organisaties in verandering..."/>
        </TesterVraag>
      </Card>

      {/* Blok 2 */}
      <p style={{fontFamily:FONT_BODY,fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",color:C.muted,marginBottom:16,marginTop:28}}>Ervaring met de tool</p>
      <Card>
        <TesterVraag label="3. Heb je alleen de scan ingevuld, of ook een team aangemaakt en dit met je teamleden getest?">
          <TesterRadio value={f["teamGetest"]} onChange={function(v){set("teamGetest",v);}} options={[{val:"alleen",label:"Alleen de scan ingevuld"},{val:"ja",label:"Ja, ook met een team getest"}]}/>
        </TesterVraag>
        <TesterVraag label="4. Hoe verliep het invullen voor jou?" sub="1 = moeizaam, 5 = vlekkeloos">
          <TesterScale value={f["invulErvaring"]} onChange={function(v){set("invulErvaring",v);}}/>
          <TesterTextarea value={f["invulToelichting"]} onChange={function(v){set("invulToelichting",v);}} placeholder="Toelichting (optioneel)"/>
        </TesterVraag>
        <TesterVraag label="5. Wat vond je van het aantal vragen?">
          <TesterRadio value={f["aantalVragen"]} onChange={function(v){set("aantalVragen",v);}} options={[{val:"te weinig",label:"Te weinig"},{val:"precies goed",label:"Precies goed"},{val:"te veel",label:"Te veel"}]}/>
          <TesterTextarea value={f["aantalVragenOpmerking"]} onChange={function(v){set("aantalVragenOpmerking",v);}} placeholder="Opmerking (optioneel)"/>
        </TesterVraag>
        <TesterVraag label="6. Denk je dat 12 vragen voldoende zijn voor een betrouwbare analyse, of zou je meer vragen adviseren voor de geloofwaardigheid?" sub="Als je meer vragen adviseert, hoeveel zou je dan aanbevelen?">
          <TesterRadio value={f["aantalVragenBetrouwbaar"]} onChange={function(v){set("aantalVragenBetrouwbaar",v);}} options={[{val:"ja voldoende",label:"Ja, 12 is voldoende"},{val:"meer nodig",label:"Meer vragen nodig"}]}/>
          {f.aantalVragenBetrouwbaar==="meer nodig"&&<TesterTextarea value={f["aantalVragenAdvies"]} onChange={function(v){set("aantalVragenAdvies",v);}} placeholder="Hoeveel vragen zou je aanbevelen en waarom?"/>}
        </TesterVraag>
        <TesterVraag label="7. Was er iets dat je niet begreep of dat je afremde?">
          <TesterTextarea value={f["blokkade"]} onChange={function(v){set("blokkade",v);}} placeholder="Bijv. onduidelijke stap, verwarrende tekst..."/>
        </TesterVraag>
        <TesterVraag label="8. Wat vond je het sterkste onderdeel van de tool?">
          <TesterTextarea value={f["sterkste"]} onChange={function(v){set("sterkste",v);}} placeholder="Vertel het ons..."/>
        </TesterVraag>
      </Card>

      {/* Blok 3 */}
      <p style={{fontFamily:FONT_BODY,fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",color:C.muted,marginBottom:16,marginTop:28}}>Analyse</p>
      <Card>
        <TesterVraag label="9. Wat vond je van de persoonlijke analyse?" sub="Dit is de analyse die verschijnt nadat je op 'Genereer analyse' hebt geklikt na het invullen van de 12 vragen.">
          <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,margin:"8px 0 4px"}}>Lengte</p>
          <TesterRadio value={f["analyseLengte"]} onChange={function(v){set("analyseLengte",v);}} options={[{val:"te kort",label:"Te kort"},{val:"precies goed",label:"Precies goed"},{val:"te lang",label:"Te lang"}]}/>
          <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,margin:"14px 0 4px"}}>Taal</p>
          <TesterRadio value={f["analyseTaal"]} onChange={function(v){set("analyseTaal",v);}} options={[{val:"helder en concreet",label:"Helder en concreet"},{val:"begrijpelijk maar globaal",label:"Begrijpelijk maar globaal"},{val:"moeilijk te duiden",label:"Moeilijk te duiden"}]}/>
          <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,margin:"14px 0 4px"}}>Overige opmerkingen</p>
          <TesterTextarea value={f["analyseOpmerking"]} onChange={function(v){set("analyseOpmerking",v);}} placeholder="Wat vond je verder van de analyse? (optioneel)"/>
        </TesterVraag>

        {showTeamVragen && <>
          <div style={{borderTop:"1px solid "+C.warm,marginTop:8,paddingTop:20}}>
            <TesterVraag label="10. Wat vond je van de teamanalyse?">
              <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,margin:"8px 0 4px"}}>Lengte</p>
              <TesterRadio value={f["teamAnalyseLengte"]} onChange={function(v){set("teamAnalyseLengte",v);}} options={[{val:"te kort",label:"Te kort"},{val:"precies goed",label:"Precies goed"},{val:"te lang",label:"Te lang"}]}/>
              <p style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted,margin:"14px 0 4px"}}>Taal</p>
              <TesterRadio value={f["teamAnalyseTaal"]} onChange={function(v){set("teamAnalyseTaal",v);}} options={[{val:"helder en concreet",label:"Helder en concreet"},{val:"begrijpelijk maar globaal",label:"Begrijpelijk maar globaal"},{val:"moeilijk te duiden",label:"Moeilijk te duiden"}]}/>
            </TesterVraag>
            <TesterVraag label="11. Hoe gemakkelijk was het om een team aan te maken?" sub="1 = erg lastig, 5 = heel eenvoudig">
              <TesterScale value={f["teamAanmaken"]} onChange={function(v){set("teamAanmaken",v);}}/>
              <TesterTextarea value={f["teamAanmakenToelichting"]} onChange={function(v){set("teamAanmakenToelichting",v);}} placeholder="Toelichting (optioneel)"/>
            </TesterVraag>
          </div>
        </>}
      </Card>

      {/* Blok 4 */}
      <p style={{fontFamily:FONT_BODY,fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",color:C.muted,marginBottom:16,marginTop:28}}>Waarde</p>
      <Card>
        <TesterVraag label="12. Zou jij dit inzetten voor je eigen team?">
          <TesterRadio value={f["inzettenKeuze"]} onChange={function(v){set("inzettenKeuze",v);}} options={[{val:"ja",label:"Ja"},{val:"nee",label:"Nee"},{val:"misschien",label:"Misschien"}]}/>
          {f.inzettenKeuze&&<TesterTextarea value={f["inzetten"]} onChange={function(v){set("inzetten",v);}} placeholder="Waarom wel of niet?"/>}
        </TesterVraag>
      </Card>

      {/* Blok 5 */}
      <p style={{fontFamily:FONT_BODY,fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",color:C.muted,marginBottom:16,marginTop:28}}>Verbeteringen</p>
      <Card>
        <TesterVraag label="13. Wat mis je, of wat zou de tool significant beter maken?">
          <TesterTextarea value={f["mist"]} onChange={function(v){set("mist",v);}} placeholder="Vertel het ons..."/>
        </TesterVraag>
        <TesterVraag label="14. Heb je nog iets dat je kwijt wil?">
          <TesterTextarea value={f["overig"]} onChange={function(v){set("overig",v);}} placeholder="Vrije ruimte..."/>
        </TesterVraag>
      </Card>

      <Btn onClick={handleSubmit} disabled={saving} style={{width:"100%",justifyContent:"center",marginTop:8,fontSize:16,padding:"16px 24px"}}>
        {saving ? "Opslaan..." : "Verstuur mijn feedback →"}
      </Btn>
      <p style={{fontFamily:FONT_BODY,fontSize:12,color:C.muted,textAlign:"center",marginTop:12}}>
        Team Energie Spiegel · erikvandongen.eu
      </p>
    </>}
  </div>;
}

export default function App() {
  var [urlParams] = useState(function(){
    try {
      var p = new URLSearchParams(window.location.search);
      return { team: p.get("team")||null, owner: p.get("owner")||null, admin: p.get("admin")||null, tester: p.get("tester")||null };
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
    } else if(urlParams.team && !urlParams.owner) {
      // Teamlid via uitnodigingslink — direct welkomstscherm laden
      apiGetTeam(urlParams.team).then(function(m){
        if(m){ setWelcomeMeta(m); setPage("welcome"); }
        setOwnerChecked(true);
      });
    } else {
      setOwnerChecked(true);
    }
  }, []);

  var isAdmin = urlParams.admin === "true";
  var isTester = urlParams.tester === "true";
  var [page, setPage] = useState("start");
  var [welcomeMeta, setWelcomeMeta] = useState(null);
  var [answers, setAnswers] = useState({});
  var [prefilledCode, setPrefilledCode] = useState(urlParams.team && !urlParams.owner ? urlParams.team : null);
  var [demoMode, setDemoMode] = useState(false);
  var [personalAnalysis, setPersonalAnalysis] = useState(null);

  function handleReset(){ setDemoMode(false); setPage("start"); setAnswers({});  setWelcomeMeta(null); setPrefilledCode(urlParams.team&&!urlParams.owner?urlParams.team:null); setPersonalAnalysis(null); window.scrollTo(0,0); }
  useEffect(function(){ window.scrollTo({top:0,behavior:"smooth"}); },[page]);

  var showingDashboard = ownerView || demoMode;

  if(!ownerChecked) return <div style={{minHeight:"100vh",background:C.cream,display:"flex",alignItems:"center",justifyContent:"center"}}><LoadingDots/></div>;

  if(isAdmin) return <div style={{minHeight:"100vh",background:C.cream,fontFamily:FONT_BODY}}>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Source+Sans+Pro:wght@400;600&display=swap" rel="stylesheet"/>
    <AdminDashboard/>
  </div>;

  return <div style={{minHeight:"100vh",background:C.cream,fontFamily:FONT_BODY}}>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Source+Sans+Pro:wght@400;600&display=swap" rel="stylesheet"/>
    <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(245,240,232,0.93)",backdropFilter:"blur(8px)",borderBottom:"1px solid "+C.warm,padding:"10px 24px",display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:24,height:24,background:C.olive,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{display:"flex",gap:2,alignItems:"flex-end",height:12}}>{[6,9,12,9,6].map(function(h,i){return <div key={i} style={{width:2,height:h,background:C.cream,borderRadius:1}}/>;})}</div>
        </div>
        <span style={{fontFamily:FONT_BODY,fontSize:13,color:C.muted}}>Team Energie Spiegel</span>
      </div>
      <a href="https://erikvandongen.eu" target="_blank" rel="noopener noreferrer" style={{fontFamily:FONT_BODY,fontSize:13,color:C.charcoal,textDecoration:"none",letterSpacing:"0.02em",textAlign:"center"}}>erikvandongen.eu</a>
      <div style={{display:"flex",gap:8,alignItems:"center",justifyContent:"flex-end"}}>
        {demoMode&&<div style={{display:"inline-flex",alignItems:"center",gap:5,background:"rgba(181,98,42,0.1)",borderRadius:20,padding:"4px 11px"}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:C.terra}}/>
          <span style={{fontFamily:FONT_BODY,fontSize:11,color:C.terra,fontWeight:600,letterSpacing:"0.05em"}}>Voorbeeldweergave</span>
        </div>}
        {(showingDashboard||page!=="start"&&page!=="teamcode")&&<button onClick={handleReset} style={{background:"none",border:"1px solid "+C.warm,borderRadius:20,padding:"6px 14px",cursor:"pointer",fontFamily:FONT_BODY,fontSize:13,color:C.muted}}>← Terug naar home</button>}
      </div>
    </div>
    <FeedbackButton page={page}/>
    {isTester ? <TesterForm/>
    : showingDashboard
      ? <OwnerDashboard teamCode={urlParams.team} isDemo={demoMode}/>
      : <>
          {page==="start"    &&(!ownerView&&urlParams.team
            ? <StartPage onStart={function(code){
                setPrefilledCode(code);
                apiGetTeam(code).then(function(m){ if(m){ setWelcomeMeta(m); setPage("welcome"); } else { setPage("questions"); } });
              }} inviteContext={{code:urlParams.team}} onDemo={function(){setDemoMode(true);}}/>
            : <StartPage onStart={function(code){setPrefilledCode(code);setPage("teamcode");}} inviteContext={null} onDemo={function(){setDemoMode(true);}}/>
          )}
          {page==="welcome"   &&welcomeMeta&&<WelcomeTeamScreen meta={welcomeMeta} onStart={function(){setPage("questions");}}/>}
          {page==="teamcode"  &&<TeamCodePage onStart={function(code){
            setPrefilledCode(code);
            apiGetTeam(code).then(function(m){ if(m){ setWelcomeMeta(m); setPage("welcome"); } else { setPage("questions"); } });
          }}/>}
          {page==="questions"&&<QuestionsPage onComplete={function(a){setAnswers(a);setPage("analysis");}}/>}
          {page==="analysis" &&<AnalysisPage answers={answers} prefilledCode={prefilledCode} onDone={function(){setPage("team");}} onAnalysisReady={setPersonalAnalysis}/>}
          {page==="team"     &&<ErrorBoundary><TeamPage answers={answers} prefilledCode={prefilledCode} isOwner={ownerView} onBack={function(){setPage("analysis");}} personalAnalysis={personalAnalysis}/></ErrorBoundary>}
        </>
    }
  </div>;
}
