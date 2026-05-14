import { useState, useRef, useEffect, useCallback } from "react";

/* ════════════════════════════════════════════════════════
   SplitPay v5 — Complete prototype
   
   Features:
   - OCR: scans receipt photo via Anthropic API
   - Room: creates unique code per bill, stored in shared persistent storage
   - Link: generates WhatsApp message with room code to share
   - Form: each person picks name from dropdown + qty stepper per item
   - Tip: proportional to each person's consumption
   - Dashboard: real-time view of who confirmed, totals, warnings
   - Multi-user: anyone with the code can enter and fill their form
   ════════════════════════════════════════════════════════ */

// ─── Theme ───
const T = {
  bg:"#06080c",surface:"#0e1117",card:"#161a23",cardAlt:"#1c2130",
  accent:"#22c55e",accentSoft:"rgba(34,197,94,0.10)",accentGlow:"rgba(34,197,94,0.25)",accentBorder:"rgba(34,197,94,0.25)",
  hot:"#f97316",hotSoft:"rgba(249,115,22,0.10)",
  warn:"#eab308",warnSoft:"rgba(234,179,8,0.10)",
  danger:"#ef4444",dangerSoft:"rgba(239,68,68,0.10)",
  text:"#e4e7ec",textSec:"#8b95a5",textDim:"#4a5264",
  border:"#1e2433",borderLight:"#2a3145",whatsapp:"#25D366",
};
const FONT = "'Nunito','DM Sans',system-ui,sans-serif";
const FT = "'Bricolage Grotesque','Nunito',system-ui,sans-serif";
const FONTS_URL = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Nunito:wght@400;500;600;700;800&display=swap";
const AV = ["🦊","🐱","🐼","🦄","🐸","🦉","🐙","🦋","🐧","🦎","🐬","🦩","🐨","🦁","🐯","🐮"];
const uid = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const fmt = n => `$${Math.round(Number(n)).toLocaleString("es-CL")}`;
function getRoomURL(code) { return `${window.location.origin}/sala/${code}`; }

const genCode = () => {
  const w = ["ASADO","SUSHI","PIZZA","BIRRA","TACO","BRUNCH","CENA","POKE"];
  return w[Math.floor(Math.random() * w.length)] + "-" + uid().slice(0, 4);
};

import { createRoom as fbCreate, getRoom as fbGet, submitClaim as fbSubmit, subscribeToClaims as fbSub, updateRoom as fbUpdate } from "./db.js";

// ─── Demo Items ───
const DEMO = [
  { id: uid(), name: "Coca Cola Zero", qty: 2, unitPrice: 2900 },
  { id: uid(), name: "Limonada Menta Jeng", qty: 2, unitPrice: 3900 },
  { id: uid(), name: "Sprite Zero", qty: 2, unitPrice: 2900 },
  { id: uid(), name: "Agua con Gas", qty: 1, unitPrice: 2900 },
  { id: uid(), name: "Sour Clásico Cátedra", qty: 1, unitPrice: 9900 },
  { id: uid(), name: "Pulpo a la Parrilla", qty: 1, unitPrice: 24900 },
  { id: uid(), name: "Raviol de Asado", qty: 2, unitPrice: 12900 },
  { id: uid(), name: "Camarón Saltado Crio", qty: 1, unitPrice: 18900 },
  { id: uid(), name: "Estofado Carne Champ", qty: 1, unitPrice: 22900 },
  { id: uid(), name: "Fetuccini Criollo", qty: 1, unitPrice: 19900 },
  { id: uid(), name: "Seco Vacuno Norteña", qty: 1, unitPrice: 24900 },
  { id: uid(), name: "Tall. Sal Crio Pollo", qty: 1, unitPrice: 13900 },
  { id: uid(), name: "Anticucho Filete", qty: 1, unitPrice: 18900 },
  { id: uid(), name: "Floricienta", qty: 1, unitPrice: 4900 },
  { id: uid(), name: "Torta Cumpleañera", qty: 1, unitPrice: 7200 },
  { id: uid(), name: "Tartita Maracuyá", qty: 1, unitPrice: 4900 },
];

// ─── CSS ───
const CSS = `
@import url('${FONTS_URL}');
*{box-sizing:border-box;margin:0;padding:0}
body{background:${T.bg}}
button:active{transform:scale(0.97)}
input:focus,select:focus{border-color:${T.accent}!important;outline:none}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes pop{0%{transform:scale(.5);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
`;

// ─── UI Components ───
const Shell = ({ children }) => (
  <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: T.bg, color: T.text, fontFamily: FONT, position: "relative" }}>
    <style>{CSS}</style>{children}
  </div>
);

const Hdr = ({ title, sub, onBack, right }) => (
  <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(16px)" }}>
    {onBack && <button onClick={onBack} style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text, width: 36, height: 36, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>←</button>}
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: FT, letterSpacing: -0.3 }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: T.textSec, marginTop: 1 }}>{sub}</div>}
    </div>
    {right}
  </div>
);

const Card = ({ children, style, glow }) => (
  <div style={{ background: T.card, borderRadius: 16, padding: "18px 20px", border: `1px solid ${T.border}`, ...(glow ? { boxShadow: `0 0 20px ${T.accentGlow}`, borderColor: T.accentBorder } : {}), ...style }}>{children}</div>
);

const Btn = ({ children, color = T.accent, full, disabled, style: sx, ...p }) => (
  <button disabled={disabled} {...p} style={{ background: disabled ? T.cardAlt : color, color: [T.accent, T.whatsapp].includes(color) ? "#000" : "#fff", border: "none", borderRadius: 14, padding: "15px 24px", fontSize: 15, fontWeight: 700, cursor: disabled ? "default" : "pointer", width: full ? "100%" : "auto", fontFamily: FONT, opacity: disabled ? .4 : 1, transition: "all .12s", ...(sx || {}) }}>{children}</button>
);

const GBtn = ({ children, full, style: sx, ...p }) => (
  <button {...p} style={{ background: "transparent", border: `1.5px solid ${T.border}`, color: T.textSec, borderRadius: 14, padding: "13px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT, width: full ? "100%" : "auto", ...(sx || {}) }}>{children}</button>
);

const Inp = ({ style: sx, ...p }) => (
  <input {...p} style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "13px 16px", color: T.text, fontSize: 15, outline: "none", width: "100%", fontFamily: FONT, ...(sx || {}) }} />
);

const Sel = ({ style: sx, ...p }) => (
  <select {...p} style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", color: T.text, fontSize: 15, outline: "none", width: "100%", fontFamily: FONT, appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238b95a5' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", cursor: "pointer", ...(sx || {}) }} />
);

const Tag = ({ children, color = T.accent }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: color === T.accent ? T.accentSoft : color === T.danger ? T.dangerSoft : T.warnSoft, color, borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{children}</span>
);

const Lbl = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: T.textDim, marginBottom: 10 }}>{children}</div>
);

const Fab = ({ children, disabled, ...p }) => (
  <button disabled={disabled} {...p} style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", maxWidth: 440, width: "calc(100% - 32px)", background: disabled ? T.cardAlt : T.accent, color: "#000", border: "none", borderRadius: 16, padding: "17px 32px", fontSize: 16, fontWeight: 800, cursor: disabled ? "default" : "pointer", fontFamily: FT, zIndex: 40, boxShadow: disabled ? "none" : `0 8px 40px ${T.accentGlow}`, opacity: disabled ? .4 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{children}</button>
);

const Ring = ({ pct, size = 56, stroke = 5 }) => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.border} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.accent} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c - (pct/100) * c} strokeLinecap="round" style={{ transition: "stroke-dashoffset .6s ease" }} />
    </svg>
  );
};

const Stepper = ({ value, max, onChange }) => {
  const bs = en => ({ width: 38, height: 38, borderRadius: 10, border: "none", fontSize: 20, fontWeight: 700, cursor: en ? "pointer" : "default", background: en ? T.accent : T.surface, color: en ? "#000" : T.textDim, display: "flex", alignItems: "center", justifyContent: "center", opacity: en ? 1 : .35 });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button style={bs(value > 0)} onClick={e => { e.stopPropagation(); if (value > 0) onChange(value - 1); }}>−</button>
      <div style={{ width: 36, textAlign: "center", fontSize: 20, fontWeight: 800, color: value > 0 ? T.accent : T.textDim, fontFamily: FT }}>{value}</div>
      <button style={bs(value < max)} onClick={e => { e.stopPropagation(); if (value < max) onChange(value + 1); }}>+</button>
    </div>
  );
};


// ════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════
export default function SplitPay() {
  // ─── Core state ───
  const [view, setView] = useState("home");
  // home | processing | setup | roomCreated | joinEntry | form | formDone | dashboard
  const [roomCode, setRoomCode] = useState(null);
  const [roomData, setRoomData] = useState(null); // { items, people, tipPercent, claims }
  const [ocrItems, setOcrItems] = useState([]);
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantBranch, setRestaurantBranch] = useState("");
  const [ocrStatus, setOcrStatus] = useState(""); // "" | "ok" | error message
  const [progress, setProgress] = useState(0);
  const [urlChecked, setUrlChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem("sp_onboarded"); } catch { return true; }
  });
  const [obSlide, setObSlide] = useState(0);
  const [roomHistory, setRoomHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sp_rooms") || "[]"); } catch { return []; }
  });

  // ─── URL Routing: auto-join room from /sala/CODE ───
  useEffect(() => {
    const match = window.location.pathname.match(/^\/sala\/([A-Za-z0-9-]+)$/i);
    if (match) {
      const code = match[1].toUpperCase();
      fbGet(code).then(data => {
        if (data) {
          setRoomCode(code);
          setRoomData(data);
          setView("form");
          const entry = {
            code,
            restaurant: data.restaurant || "",
            branch: data.branch || "",
            total: data.items ? data.items.reduce((s, it) => s + it.unitPrice * it.qty, 0) : undefined,
            createdAt: data.createdAt || Date.now(),
            accessedAt: Date.now(),
          };
          try {
            const prev = JSON.parse(localStorage.getItem("sp_rooms") || "[]");
            const filtered = prev.filter(e => e.code !== code);
            const updated = [entry, ...filtered].slice(0, 20);
            localStorage.setItem("sp_rooms", JSON.stringify(updated));
            setRoomHistory(updated);
          } catch {}
        }
        setUrlChecked(true);
      }).catch(() => setUrlChecked(true));
    } else {
      setUrlChecked(true);
    }
  }, []);

  // Setup state
  const [people, setPeople] = useState([]);
  const [tipPercent, setTipPercent] = useState(10);
  const [pName, setPName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [niName, setNiName] = useState("");
  const [niPrice, setNiPrice] = useState("");
  const [niQty, setNiQty] = useState("1");
  const [editId, setEditId] = useState(null);
  const [ef, setEf] = useState({ n: "", p: "", q: "" });

  // Join state
  const [joinCode, setJoinCode] = useState("");
  const [joinErr, setJoinErr] = useState("");

  // Form state
  const [selPerson, setSelPerson] = useState("");
  const [myQtys, setMyQtys] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [isEditingClaim, setIsEditingClaim] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const [lastSubmittedPerson, setLastSubmittedPerson] = useState(null);
  const [editingRoom, setEditingRoom] = useState(false);
  const [roomSaveMsg, setRoomSaveMsg] = useState("");

  // UI state
  const [copied, setCopied] = useState("");
  const fileRef = useRef(null);

  // ─── OCR via serverless proxy (/api/ocr) ───
  const processOCR = async (base64Img) => {
    setView("processing"); setProgress(10); setOcrStatus("");
    const mediaType = base64Img.startsWith("data:image/png") ? "image/png" : "image/jpeg";
    const b64 = base64Img.split(",")[1];
    setProgress(30);
    
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64, mediaType })
      });
      setProgress(70);
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `API error ${res.status}`);
      }
      
      const parsed = await res.json();
      setProgress(90);
      
      // Extract restaurant info
      if (parsed.restaurant) setRestaurantName(parsed.restaurant);
      if (parsed.branch) setRestaurantBranch(parsed.branch);
      
      // Extract items (handle both {items:[...]} and [...] formats)
      const itemsList = parsed.items || (Array.isArray(parsed) ? parsed : []);
      
      if (!Array.isArray(itemsList) || itemsList.length === 0) {
        throw new Error("No se encontraron ítems en la boleta");
      }

      setOcrItems(itemsList.map(it => ({ id: uid(), name: it.name || "Ítem", qty: Number(it.qty)||1, unitPrice: Number(it.unitPrice)||0 })));
      setOcrStatus("ok");
      setProgress(100);
      setTimeout(() => setView("setup"), 400);
    } catch(e) {
      setOcrStatus("Error: " + e.message + ". Puedes agregar los ítems manualmente o intentar con otra foto.");
      setOcrItems([]);
      setProgress(100);
      setView("setup");
    }
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.75);
        processOCR(compressed);
      };
      img.onerror = () => {
        // If Image() fails, send original
        processOCR(ev.target.result);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const useManual = () => {
    setOcrItems([]);
    setRestaurantName("");
    setRestaurantBranch("");
    setOcrStatus("");
    setShowAdd(true);
    setView("setup");
  };

  // ─── Item CRUD ───
  const addItem = () => {
    if (!niName.trim() || !niPrice) return;
    setOcrItems(prev => [...prev, { id: uid(), name: niName.trim(), qty: Number(niQty) || 1, unitPrice: Number(niPrice) }]);
    setNiName(""); setNiPrice(""); setNiQty("1"); setShowAdd(false);
  };
  const rmItem = id => { setOcrItems(prev => prev.filter(it => it.id !== id)); if (editId === id) setEditId(null); };
  const toggleShared = id => { setOcrItems(prev => prev.map(it => it.id === id ? { ...it, shared: !it.shared } : it)); };
  const startEdit = it => { setEditId(it.id); setEf({ n: it.name, p: String(it.unitPrice), q: String(it.qty) }); };
  const saveEdit = id => {
    setOcrItems(prev => prev.map(it => it.id === id ? { ...it, name: ef.n || it.name, unitPrice: Number(ef.p) || it.unitPrice, qty: Number(ef.q) || it.qty } : it));
    setEditId(null);
  };

  // ─── People CRUD ───
  const addPerson = () => {
    const n = pName.trim();
    if (!n || people.find(p => p.name.toLowerCase() === n.toLowerCase())) return;
    setPeople(prev => [...prev, { id: uid(), name: n, avatar: AV[prev.length % AV.length] }]);
    setPName("");
  };
  const rmPerson = id => setPeople(prev => prev.filter(p => p.id !== id));

  // ─── Save room to local history ───
  const saveToHistory = (code, data) => {
    setRoomHistory(prev => {
      const entry = {
        code,
        restaurant: data.restaurant || "",
        branch: data.branch || "",
        total: data.items ? data.items.reduce((s, it) => s + it.unitPrice * it.qty, 0) : undefined,
        createdAt: data.createdAt || Date.now(),
        accessedAt: Date.now(),
      };
      const filtered = prev.filter(e => e.code !== code);
      const updated = [entry, ...filtered].slice(0, 20);
      try { localStorage.setItem("sp_rooms", JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  // ─── Create Room ───
  const createRoom = async () => {
    const code = genCode();
    const data = { items: ocrItems, people, tipPercent, restaurant: restaurantName, branch: restaurantBranch, claims: {}, createdAt: Date.now() };
    await fbCreate(code, data);
    setRoomCode(code);
    setRoomData(data);
    saveToHistory(code, data);
    setView("roomCreated");
  };

  // ─── Join Room ───
  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoinErr("");
    const data = await fbGet(code);
    if (data) {
      setRoomCode(code);
      setRoomData(data);
      saveToHistory(code, data);
      setSelPerson("");
      setMyQtys({});
      setView("form");
    } else {
      setJoinErr("Sala no encontrada. Verifica el código.");
    }
  };

  // ─── Go to form from room created ───
  const goToForm = () => {
    setSelPerson("");
    setMyQtys({});
    setView("form");
  };

  

  // Subscribe to real-time updates
  useEffect(() => {
    if (roomCode) {
      const unsub = fbSub(roomCode, (claims) => {
        setRoomData(prev => prev ? { ...prev, claims: claims || {} } : prev);
      });
      return () => unsub();
    }
  }, [roomCode]);

  // ─── Refresh full room data ───
  const refreshRoom = async () => {
    if (!roomCode) return;
    const data = await fbGet(roomCode);
    if (data) setRoomData(data);
  };

  // ─── Load room into setup state for inline editing ───
  const loadRoomForEditing = () => {
    if (!roomData) return;
    setOcrItems(roomData.items || []);
    setPeople(roomData.people || []);
    setTipPercent(roomData.tipPercent ?? 10);
    setRestaurantName(roomData.restaurant || "");
    setRestaurantBranch(roomData.branch || "");
    setEditId(null);
    setShowAdd(false);
    setEditingRoom(true);
    setRoomSaveMsg("");
  };

  // ─── Save inline room edits to Firebase ───
  const saveRoomEdits = async () => {
    if (!roomCode || !roomData) return;
    const updated = { ...roomData, items: ocrItems, people, tipPercent, restaurant: restaurantName, branch: restaurantBranch };
    await fbUpdate(roomCode, updated);
    setRoomData(updated);
    saveToHistory(roomCode, updated);
    setEditingRoom(false);
    setRoomSaveMsg("✓ Sala actualizada");
    setTimeout(() => setRoomSaveMsg(""), 3000);
  };

  // ─── Submit claim ───
  const submitForm = async () => {
    if (!selPerson || !roomCode || !roomData) return;
    const sel = Object.entries(myQtys).filter(([_, q]) => q > 0);
    if (!sel.length) return;
    setSubmitting(true);
    const itemsClaim = {};
    const sharedClaim = {};
    sel.forEach(([id, q]) => {
      if (id.startsWith("sh_")) sharedClaim[id.replace("sh_", "")] = 1;
      else itemsClaim[id] = q;
    });
    await fbSubmit(roomCode, selPerson, { items: itemsClaim, shared: sharedClaim });
    const updated = await fbGet(roomCode);
    if (updated) setRoomData(updated);
    const wasEditing = isEditingClaim;
    setLastSubmittedPerson(selPerson);
    setMyQtys({});
    setSelPerson("");
    setSubmitting(false);
    setIsEditingClaim(false);
    setJustUpdated(wasEditing);
    setView("formDone");
  };

  // ─── Calculations ───
  const items = roomData?.items || ocrItems;
  const ppl = roomData?.people || people;
  const tp = roomData?.tipPercent ?? tipPercent;
  const claims = roomData?.claims || {};

  const subtotal = items.reduce((s, it) => s + it.unitPrice * it.qty, 0);
  const tipAmount = Math.round(subtotal * tp / 100);
  const total = subtotal + tipAmount;

  const claimedQty = iid => { let t = 0; Object.values(claims).forEach(c => { t += ((c.items || {})[iid] || 0); }); return t; };
  const remainQty = iid => { const it = items.find(i => i.id === iid); return it ? it.qty - claimedQty(iid) : 0; };

  // Count how many people claimed a shared item
  const sharedClaimCount = iid => {
    let n = 0;
    Object.values(claims).forEach(c => { if (c.shared && c.shared[iid]) n++; });
    return n;
  };
  // Person's shared items total
  const pShared = pid => {
    if (!claims[pid]?.shared) return 0;
    return Object.keys(claims[pid].shared).reduce((s, iid) => {
      const it = items.find(i => i.id === iid);
      if (!it) return s;
      const n = sharedClaimCount(iid) || 1;
      return s + Math.round(it.unitPrice * it.qty / n);
    }, 0);
  };
  const pSub = pid => { 
    let s = pShared(pid);
    if (claims[pid]) Object.entries(claims[pid].items || {}).forEach(([iid, q]) => { const it = items.find(i => i.id === iid); if (it) s += it.unitPrice * q; });
    return s;
  };
  const pTip = pid => Math.round(pSub(pid) * tp / 100);
  const pTot = pid => pSub(pid) + pTip(pid);

  const availPeople = ppl.filter(p => !claims[p.id]);
  const confCount = Object.keys(claims).length;
  const allDone = confCount === ppl.length && ppl.length > 0;

  // ─── WhatsApp messages ───
  const whatsInvite = () => {
    const rName = roomData?.restaurant || restaurantName;
    const rBranch = roomData?.branch || restaurantBranch;
    const loc = rName ? `\n📍 *${rName}*${rBranch ? `\n📌 ${rBranch}` : ""}` : "";
    const url = getRoomURL(roomCode);
    const nItems = items.length;
    return `🧾 *¡Llegó la cuenta!*${loc}\n\n💰 ${nItems} ítems · Total: ${fmt(total)}\n\n👉 Entra acá y marca lo que consumiste:\n${url}\n\n${ppl.map(p => `${p.avatar} ${p.name}`).join("\n")}\n\n_Se abre en el navegador, sin descargar nada._`;
  };

  const whatsSummary = () => {
    const rName = roomData?.restaurant || restaurantName;
    const rBranch = roomData?.branch || restaurantBranch;
    const loc = rName ? `📍 ${rName}${rBranch ? ` — ${rBranch}` : ""}\n` : "";
    let m = `🧾 *Resumen — SplitPay*\n${loc}\nTotal: ${fmt(total)}\n\n`;
    ppl.forEach(p => {
      const cl = claims[p.id];
      m += `${p.avatar} *${p.name}*: ${fmt(pTot(p.id))}\n`;
      // Shared items from claims
      if (claims[p.id]?.shared) {
        Object.keys(claims[p.id].shared).forEach(iid => {
          const it = items.find(i => i.id === iid); if (!it) return;
          const n = sharedClaimCount(iid) || 1;
          m += `   • 👥 ${it.name} (÷${n}): ${fmt(Math.round(it.unitPrice * it.qty / n))}\n`;
        });
      }
      // Individual items
      if (cl) {
        Object.entries(cl.items || {}).forEach(([iid, q]) => {
          const it = items.find(i => i.id === iid);
          if (it) m += `   • ${q > 1 ? q + "x " : ""}${it.name}: ${fmt(it.unitPrice * q)}\n`;
        });
      }
      m += `   • Propina: ${fmt(pTip(p.id))}\n\n`;
    });
    m += `💸 ¡Cada uno envía su parte!\n\n👉 Ver detalle: ${getRoomURL(roomCode)}`;
    return m;
  };

  const cp = (txt, lb) => { navigator.clipboard?.writeText(txt); setCopied(lb); setTimeout(() => setCopied(""), 2500); };

  const setIQ = (iid, q) => setMyQtys(prev => { const n = { ...prev }; if (q <= 0) delete n[iid]; else n[iid] = q; return n; });

  // Shared items: calculate this person's share based on how many people joined
  const mySharedTotal = selPerson ? items.filter(it => it.shared && (myQtys["sh_" + it.id] || 0) === 1).reduce((s, it) => {
    // Count others who already claimed this shared item + me
    const othersCount = Object.entries(claims).filter(([pid, c]) => pid !== selPerson && c.shared && c.shared[it.id]).length;
    const totalCount = othersCount + 1;
    return s + Math.round(it.unitPrice * it.qty / totalCount);
  }, 0) : 0;
  const mySharedCount = Object.keys(myQtys).filter(k => k.startsWith("sh_") && myQtys[k] === 1).length;
  const myItemsTotal = Object.entries(myQtys).reduce((s, [iid, q]) => { const it = items.find(i => i.id === iid); return s + (it ? it.unitPrice * q : 0); }, 0) + mySharedTotal;
  const myTip = Math.round(myItemsTotal * tp / 100);
  const myCount = Object.values(myQtys).reduce((s, q) => s + q, 0);

  // ═══════════════════════════════════
  // VIEWS
  // ═══════════════════════════════════

  // ── HOME ──
  // ─── Onboarding slides ───
  const obSlides = [
    { emoji: "📸", title: "Sube la boleta", desc: "Toma una foto de la cuenta y la IA extrae todos los platos, bebidas y precios automáticamente.", color: T.accent },
    { emoji: "👥", title: "Agrega al grupo", desc: "Escribe los nombres de quienes comparten la cuenta. Puedes marcar ítems compartidos con 👥.", color: T.hot },
    { emoji: "📲", title: "Comparte el link", desc: "Envía el mensaje por WhatsApp. Cada persona abre el link y marca lo que consumió.", color: T.whatsapp },
    { emoji: "✅", title: "¡Listo! Cada uno sabe cuánto poner", desc: "SplitPay calcula automáticamente cuánto debe cada persona, incluyendo propina proporcional.", color: T.accent },
  ];

  const finishOnboarding = () => {
    try { localStorage.setItem("sp_onboarded", "1"); } catch {}
    setShowOnboarding(false);
  };

  if (showOnboarding) return (
    <Shell>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", padding: "0 28px" }}>
        {/* Skip */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "20px 0 0" }}>
          <button onClick={finishOnboarding} style={{ background: "none", border: "none", color: T.textSec, fontSize: 15, cursor: "pointer", padding: "8px 0" }}>Omitir →</button>
        </div>

        {/* Slide content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", paddingBottom: 40 }}>
          <div style={{
            width: 120, height: 120, borderRadius: 32, margin: "0 auto 32px",
            background: `linear-gradient(145deg, ${obSlides[obSlide].color}22, ${obSlides[obSlide].color}44)`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56,
            boxShadow: `0 16px 48px ${obSlides[obSlide].color}33`,
            transition: "all 0.3s ease"
          }}>{obSlides[obSlide].emoji}</div>
          <h2 style={{
            fontSize: 28, fontWeight: 800, fontFamily: FT, margin: "0 0 16px",
            color: obSlides[obSlide].color, transition: "color 0.3s ease"
          }}>{obSlides[obSlide].title}</h2>
          <p style={{ color: T.textSec, fontSize: 16, lineHeight: 1.7, margin: 0, maxWidth: 300 }}>
            {obSlides[obSlide].desc}
          </p>
        </div>

        {/* Dots + nav */}
        <div style={{ paddingBottom: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          {/* Dots */}
          <div style={{ display: "flex", gap: 8 }}>
            {obSlides.map((_, i) => (
              <div key={i} onClick={() => setObSlide(i)} style={{
                width: i === obSlide ? 28 : 8, height: 8, borderRadius: 4,
                background: i === obSlide ? obSlides[obSlide].color : T.border,
                cursor: "pointer", transition: "all 0.3s ease"
              }} />
            ))}
          </div>

          {/* Button */}
          {obSlide < obSlides.length - 1 ? (
            <button onClick={() => setObSlide(obSlide + 1)} style={{
              width: "100%", padding: "16px 32px", fontSize: 17, fontWeight: 700,
              background: obSlides[obSlide].color, color: "#fff", border: "none",
              borderRadius: 14, cursor: "pointer", fontFamily: FT
            }}>Siguiente</button>
          ) : (
            <button onClick={finishOnboarding} style={{
              width: "100%", padding: "16px 32px", fontSize: 17, fontWeight: 700,
              background: `linear-gradient(135deg,${T.accent},${T.hot})`, color: "#fff", border: "none",
              borderRadius: 14, cursor: "pointer", fontFamily: FT
            }}>🚀 ¡Empezar!</button>
          )}
        </div>
      </div>
    </Shell>
  );

  if (!urlChecked) return (
    <Shell>
      <div style={{ padding: "100px 32px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
        <p style={{ color: T.textSec }}>Cargando...</p>
      </div>
    </Shell>
  );

  if (view === "home") return (
    <Shell>
      <div style={{ padding: "48px 28px 40px", textAlign: "center" }}>
        <div style={{ width: 96, height: 96, borderRadius: 28, margin: "0 auto 24px", background: `linear-gradient(145deg,${T.accentSoft},${T.hotSoft})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46, boxShadow: `0 16px 48px ${T.accentGlow}` }}>🧾</div>
        <h1 style={{ fontSize: 40, fontWeight: 800, fontFamily: FT, letterSpacing: -1.5, margin: "0 0 8px", background: `linear-gradient(135deg,${T.accent},${T.hot})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>SplitPay</h1>
        <p style={{ color: T.textSec, fontSize: 15, lineHeight: 1.6, margin: "0 0 40px" }}>Sube la boleta, comparte el código,<br/>cada uno marca lo suyo desde su celular.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 320, margin: "0 auto" }}>
          <Btn color={T.accent} full onClick={() => fileRef.current?.click()} style={{ padding: 18, fontSize: 16, borderRadius: 16 }}>📷 Subir foto de la boleta</Btn>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
          <GBtn full onClick={useManual} style={{ padding: 16 }}>✏️ Ingresar valores manualmente</GBtn>
        </div>

        {roomHistory.length > 0 && (
          <div style={{ maxWidth: 320, margin: "16px auto 0" }}>
            <GBtn full onClick={() => setView("history")} style={{ padding: 16 }}>🕘 Ver historial de salas ({roomHistory.length})</GBtn>
          </div>
        )}

        {/* Join section */}
        <div style={{ marginTop: 32, background: T.card, borderRadius: 16, padding: 20, border: `1px solid ${T.border}`, maxWidth: 320, margin: "32px auto 0" }}>
          <Lbl>¿TE COMPARTIERON UN CÓDIGO?</Lbl>
          <div style={{ display: "flex", gap: 8 }}>
            <Inp placeholder="ASADO-X1F2" value={joinCode} onChange={e => setJoinCode(e.target.value)} onKeyDown={e => e.key === "Enter" && joinRoom()} style={{ flex: 1, textTransform: "uppercase", fontWeight: 700, letterSpacing: 1 }} />
            <Btn color={T.hot} onClick={joinRoom} style={{ padding: "12px 18px" }}>Entrar</Btn>
          </div>
          {joinErr && <div style={{ color: T.danger, fontSize: 13, marginTop: 8 }}>{joinErr}</div>}
        </div>

        <div style={{ marginTop: 48, display: "flex", justifyContent: "center", gap: 36 }}>
          {[["📸", "Escanea", "la boleta"], ["📲", "Comparte", "el código"], ["✅", "Cada uno", "confirma"]].map(([ic, l1, l2], i) => (
            <div key={i} style={{ textAlign: "center", maxWidth: 90 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, margin: "0 auto 8px", background: T.card, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{ic}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{l1}</div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{l2}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 24, paddingBottom: 24 }}>
          <button onClick={() => { setObSlide(0); setShowOnboarding(true); }} style={{ background: "none", border: "none", color: T.textSec, fontSize: 14, cursor: "pointer", textDecoration: "underline" }}>¿Cómo funciona?</button>
        </div>
      </div>
    </Shell>
  );

  // ── PROCESSING ──
  if (view === "processing") {
    const labels = ["Leyendo boleta…", "Analizando con IA…", "Extrayendo platos y precios…", "Casi listo…", "¡Listo!"];
    const idx = Math.min(Math.floor(progress / 25), labels.length - 1);
    return (
      <Shell>
        <div style={{ padding: "100px 32px", textAlign: "center" }}>
          <div style={{ position: "relative", width: 110, height: 110, margin: "0 auto 28px" }}>
            <Ring pct={progress} size={110} stroke={6} />
            <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 40 }}>{progress < 100 ? "🔍" : "✅"}</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: FT, margin: "0 0 8px" }}>Procesando boleta</h2>
          <p style={{ color: T.textSec, fontSize: 15 }}>{labels[idx]}</p>
          <div style={{ marginTop: 20, background: T.surface, borderRadius: 8, height: 5, maxWidth: 220, margin: "0 auto", overflow: "hidden" }}>
            <div style={{ background: `linear-gradient(90deg,${T.accent},${T.hot})`, height: "100%", width: `${progress}%`, borderRadius: 8, transition: "width .4s" }} />
          </div>
        </div>
      </Shell>
    );
  }

  // ── SETUP (organizer edits items + adds people) ──
  if (view === "setup") {
    const sub = ocrItems.reduce((s, it) => s + it.unitPrice * it.qty, 0);
    const tip = Math.round(sub * tipPercent / 100);
    return (
      <Shell>
        <Hdr title="Preparar cuenta" sub={`${ocrItems.length} ítems · ${people.length} personas`} onBack={() => setView("home")} />
        <div style={{ padding: "20px 16px 120px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Restaurant info */}
          <Card style={{ background: `linear-gradient(145deg,${T.surface},${T.card})`, borderColor: T.accentBorder }}>
            <Lbl>RESTAURANTE</Lbl>
            <Inp placeholder="Nombre del local" value={restaurantName} onChange={e => setRestaurantName(e.target.value)} style={{ marginBottom: 8, fontSize: 17, fontWeight: 700, fontFamily: FT }} />
            <Inp placeholder="Sucursal / dirección (opcional)" value={restaurantBranch} onChange={e => setRestaurantBranch(e.target.value)} style={{ fontSize: 13 }} />
          </Card>

          {ocrStatus && ocrStatus !== "ok" && (
            <Card style={{ background: T.warnSoft, borderLeft: `3px solid ${T.warn}` }}>
              <div style={{ fontSize: 13, color: T.warn, fontWeight: 600, marginBottom: 8 }}>⚠️ {ocrStatus}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn color={T.hot} onClick={() => { setOcrStatus(""); fileRef.current?.click(); }} style={{ padding: "10px 16px", fontSize: 13, borderRadius: 10 }}>📷 Otra foto</Btn>
                <GBtn onClick={() => setShowAdd(true)} style={{ padding: "10px 16px", fontSize: 13 }}>✏️ Agregar manual</GBtn>
              </div>
            </Card>
          )}

          <Lbl>ÍTEMS DETECTADOS</Lbl>
          {ocrItems.map(it => (
            <div key={it.id}>
              {editId === it.id ? (
                <Card>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Inp value={ef.n} onChange={e => setEf(f => ({ ...f, n: e.target.value }))} placeholder="Nombre" />
                    <div style={{ display: "flex", gap: 8 }}>
                      <Inp value={ef.q} onChange={e => setEf(f => ({ ...f, q: e.target.value }))} placeholder="Cant" type="number" style={{ width: 70 }} />
                      <Inp value={ef.p} onChange={e => setEf(f => ({ ...f, p: e.target.value }))} placeholder="Precio unit." type="number" style={{ flex: 1 }} />
                      <Btn onClick={() => saveEdit(it.id)} style={{ padding: "12px 16px" }}>✓</Btn>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card style={{ background: it.shared ? T.hotSoft : T.card, borderColor: it.shared ? T.hot : T.border }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {it.qty > 1 && <div style={{ background: T.accentSoft, color: T.accent, borderRadius: 8, padding: "2px 8px", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>×{it.qty}</div>}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{it.name}</div>
                      <div style={{ fontSize: 13, color: T.textSec }}>{fmt(it.unitPrice)} c/u</div>
                      {it.shared && <div style={{ fontSize: 11, fontWeight: 700, color: T.hot, marginTop: 2 }}>👥 Compartido — cada persona se asigna</div>}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: T.accent }}>{fmt(it.unitPrice * it.qty)}</div>
                    <button onClick={() => toggleShared(it.id)} title={it.shared ? "Quitar compartido" : "Marcar como compartido"} style={{ background: it.shared ? T.hot : T.surface, border: `1px solid ${it.shared ? T.hot : T.border}`, borderRadius: 8, cursor: "pointer", fontSize: 13, padding: "4px 8px", color: it.shared ? "#fff" : T.textSec }}>👥</button>
                    <button onClick={() => startEdit(it)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 6, color: T.textSec }}>✏️</button>
                    <button onClick={() => rmItem(it.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: 6, color: T.danger }}>🗑</button>
                  </div>
                </Card>
              )}
            </div>
          ))}

          {showAdd ? (
            <Card style={{ border: `1px dashed ${T.accentBorder}` }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Inp placeholder="Nombre" value={niName} onChange={e => setNiName(e.target.value)} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Inp placeholder="Cant" type="number" value={niQty} onChange={e => setNiQty(e.target.value)} style={{ width: 70 }} />
                  <Inp placeholder="Precio unit." type="number" value={niPrice} onChange={e => setNiPrice(e.target.value)} style={{ flex: 1 }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}><Btn onClick={addItem} full>Agregar</Btn><GBtn onClick={() => setShowAdd(false)}>✕</GBtn></div>
              </div>
            </Card>
          ) : (
            <GBtn full onClick={() => setShowAdd(true)}>+ Agregar ítem</GBtn>
          )}

          <Lbl>PROPINA</Lbl>
          <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 5, 10, 15, 20].map(p => (
                <button key={p} onClick={() => setTipPercent(p)} style={{ background: tipPercent === p ? T.accent : T.surface, color: tipPercent === p ? "#000" : T.textSec, border: `1.5px solid ${tipPercent === p ? T.accent : T.border}`, borderRadius: 20, padding: "8px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT, boxShadow: tipPercent === p ? `0 0 12px ${T.accentGlow}` : "none" }}>{p}%</button>
              ))}
            </div>
            <span style={{ fontWeight: 700, color: T.accent }}>{fmt(tip)}</span>
          </Card>
          <div style={{ fontSize: 12, color: T.textDim, marginTop: -6 }}>Se calcula sobre el consumo de cada persona</div>

          <Lbl>PARTICIPANTES</Lbl>
          <div style={{ display: "flex", gap: 8 }}>
            <Inp placeholder="Nombre…" value={pName} onChange={e => setPName(e.target.value)} onKeyDown={e => e.key === "Enter" && addPerson()} style={{ flex: 1 }} />
            <Btn onClick={addPerson} style={{ padding: "12px 20px" }}>+</Btn>
          </div>
          {people.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {people.map(p => (
                <div key={p.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 24, padding: "8px 10px 8px 14px", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 600 }}>
                  <span>{p.avatar}</span><span>{p.name}</span>
                  <span onClick={() => rmPerson(p.id)} style={{ cursor: "pointer", color: T.danger, fontSize: 16, lineHeight: 1, marginLeft: 2 }}>×</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 24, color: T.textDim, fontSize: 14 }}>👥 Agrega las personas que fueron</div>
          )}

          <Card style={{ background: `linear-gradient(145deg,${T.accentSoft},${T.hotSoft})` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 14, color: T.textSec }}><span>Subtotal</span><span>{fmt(sub)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 14, color: T.textSec }}><span>Propina ({tipPercent}%)</span><span>{fmt(tip)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 800, fontFamily: FT, paddingTop: 12, borderTop: `1px solid ${T.border}` }}><span>Total</span><span style={{ color: T.accent }}>{fmt(sub + tip)}</span></div>
          </Card>

          <Fab disabled={people.length < 2 || ocrItems.length === 0} onClick={createRoom}>
            {people.length < 2 ? "Agrega al menos 2 personas" : "🚀 Crear Sala y Compartir"}
          </Fab>
        </div>
      </Shell>
    );
  }

  // ── ROOM CREATED (share code + WhatsApp) ──
  if (view === "roomCreated") {
    const noClaimsYet = Object.keys(roomData?.claims || {}).length === 0;

    if (editingRoom) return (
      <Shell>
        <Hdr title="Editar sala" sub={restaurantName || undefined} onBack={() => { setEditingRoom(false); setEditId(null); setShowAdd(false); }} />
        <div style={{ padding: "20px 16px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Card style={{ background: T.warnSoft, borderColor: T.warn, borderWidth: 1.5, borderStyle: "solid" }}>
            <div style={{ fontWeight: 700, color: T.warn, marginBottom: 4 }}>✏️ Editando sala</div>
            <div style={{ fontSize: 12, color: T.textSec }}>Los cambios se guardarán en Firebase y serán visibles para todos.</div>
          </Card>

          <Card style={{ background: `linear-gradient(145deg,${T.surface},${T.card})`, borderColor: T.accentBorder }}>
            <Lbl>RESTAURANTE</Lbl>
            <Inp placeholder="Nombre del local" value={restaurantName} onChange={e => setRestaurantName(e.target.value)} style={{ marginBottom: 8, fontSize: 17, fontWeight: 700, fontFamily: FT }} />
            <Inp placeholder="Sucursal / dirección (opcional)" value={restaurantBranch} onChange={e => setRestaurantBranch(e.target.value)} style={{ fontSize: 13 }} />
          </Card>

          <Lbl>ÍTEMS</Lbl>
          {ocrItems.map(it => (
            <div key={it.id}>
              {editId === it.id ? (
                <Card>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Inp value={ef.n} onChange={e => setEf(f => ({ ...f, n: e.target.value }))} placeholder="Nombre" />
                    <div style={{ display: "flex", gap: 8 }}>
                      <Inp value={ef.q} onChange={e => setEf(f => ({ ...f, q: e.target.value }))} placeholder="Cant" type="number" style={{ width: 70 }} />
                      <Inp value={ef.p} onChange={e => setEf(f => ({ ...f, p: e.target.value }))} placeholder="Precio unit." type="number" style={{ flex: 1 }} />
                      <Btn onClick={() => saveEdit(it.id)} style={{ padding: "12px 16px" }}>✓</Btn>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{it.name}</div>
                      <div style={{ fontSize: 12, color: T.textSec }}>{it.qty > 1 ? `${it.qty}× ` : ""}{fmt(it.unitPrice)} c/u</div>
                    </div>
                    <button onClick={() => startEdit(it)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 6, color: T.textSec }}>✏️</button>
                    <button onClick={() => rmItem(it.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 6, color: T.danger }}>🗑</button>
                  </div>
                </Card>
              )}
            </div>
          ))}
          {showAdd ? (
            <Card style={{ border: `1px dashed ${T.accentBorder}` }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Inp placeholder="Nombre" value={niName} onChange={e => setNiName(e.target.value)} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Inp placeholder="Cant" type="number" value={niQty} onChange={e => setNiQty(e.target.value)} style={{ width: 70 }} />
                  <Inp placeholder="Precio unit." type="number" value={niPrice} onChange={e => setNiPrice(e.target.value)} style={{ flex: 1 }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}><Btn onClick={addItem} full>Agregar</Btn><GBtn onClick={() => setShowAdd(false)}>✕</GBtn></div>
              </div>
            </Card>
          ) : (
            <GBtn full onClick={() => setShowAdd(true)}>+ Agregar ítem</GBtn>
          )}

          <Lbl>PROPINA</Lbl>
          <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 5, 10, 15, 20].map(p => (
                <button key={p} onClick={() => setTipPercent(p)} style={{ background: tipPercent === p ? T.accent : T.surface, color: tipPercent === p ? "#000" : T.textSec, border: `1.5px solid ${tipPercent === p ? T.accent : T.border}`, borderRadius: 20, padding: "8px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>{p}%</button>
              ))}
            </div>
          </Card>

          <Lbl>PARTICIPANTES</Lbl>
          {people.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {people.map(p => (
                <div key={p.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 24, padding: "8px 10px 8px 14px", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 600 }}>
                  <span>{p.avatar}</span><span>{p.name}</span>
                  <span onClick={() => rmPerson(p.id)} style={{ cursor: "pointer", color: T.danger, fontSize: 16, lineHeight: 1, marginLeft: 2 }}>×</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Inp placeholder="Agregar persona…" value={pName} onChange={e => setPName(e.target.value)} onKeyDown={e => e.key === "Enter" && addPerson()} style={{ flex: 1 }} />
            <Btn onClick={addPerson} style={{ padding: "12px 20px" }}>+</Btn>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Btn color={T.accent} full onClick={saveRoomEdits} disabled={ocrItems.length === 0 || people.length < 2}>💾 Guardar cambios</Btn>
            <GBtn onClick={() => { setEditingRoom(false); setEditId(null); setShowAdd(false); }}>Cancelar</GBtn>
          </div>
        </div>
      </Shell>
    );

    return (
      <Shell>
        <Hdr title="¡Sala creada!" sub={restaurantName ? `📍 ${restaurantName}` : "Comparte el código con el grupo"} />
        <div style={{ padding: "20px 16px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ textAlign: "center", background: `linear-gradient(145deg,${T.accentSoft},${T.hotSoft})` }}>
            <Lbl>CÓDIGO DE SALA</Lbl>
            <div style={{ fontSize: 38, fontWeight: 800, fontFamily: FT, letterSpacing: 3, color: T.accent, marginTop: 4, marginBottom: 8, textShadow: `0 0 30px ${T.accentGlow}` }}>{roomCode}</div>
            <div style={{ fontSize: 13, color: T.textSec }}>Comparte este código para que cada uno marque lo suyo</div>
          </Card>

          <Card style={{ background: "#1a2e1a", border: "1px solid rgba(37,211,102,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>💬</span>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.whatsapp }}>Mensaje para WhatsApp</div>
            </div>
            <div style={{ background: T.bg, borderRadius: 10, padding: 14, fontSize: 13, color: T.textSec, lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto", border: `1px solid ${T.border}`, marginBottom: 12 }}>
              {whatsInvite()}
            </div>
            <Btn color={T.whatsapp} full onClick={() => cp(whatsInvite(), "✅ Mensaje copiado")} style={{ borderRadius: 12 }}>
              {copied === "✅ Mensaje copiado" ? "✅ ¡Copiado!" : "📋 Copiar mensaje para WhatsApp"}
            </Btn>
          </Card>

          <Btn color={T.accent} full onClick={() => cp(roomCode, "✅ Código copiado")} style={{ borderRadius: 14 }}>
            {copied === "✅ Código copiado" ? "✅ ¡Copiado!" : "🔑 Copiar solo el código"}
          </Btn>

          <Btn color={T.hot} full onClick={goToForm} style={{ borderRadius: 14 }}>📝 Ir al formulario</Btn>

          <GBtn full onClick={() => setView("dashboard")}>📊 Ver Dashboard</GBtn>

          {noClaimsYet && (
            <GBtn full onClick={loadRoomForEditing} style={{ color: T.warn, borderColor: T.warn }}>✏️ Editar sala</GBtn>
          )}
          {roomSaveMsg && (
            <div style={{ textAlign: "center", color: T.accent, fontWeight: 700, fontSize: 15 }}>{roomSaveMsg}</div>
          )}
        </div>
      </Shell>
    );
  }

  // ── FORM (each person fills this) ──
  if (view === "form") return (
    <Shell>
      <Hdr title={roomData?.restaurant || `Sala ${roomCode}`} sub={`${roomData?.branch ? roomData.branch + " · " : ""}${confCount}/${ppl.length} confirmados`}
        onBack={() => confCount > 0 ? setView("dashboard") : setView("roomCreated")}
        right={confCount > 0 ? <Btn onClick={() => setView("dashboard")} color={T.cardAlt} style={{ padding: "8px 14px", fontSize: 12, color: T.text, border: `1px solid ${T.border}` }}>📊</Btn> : null}
      />
      <div style={{ padding: "20px 16px 140px", display: "flex", flexDirection: "column", gap: 16 }}>
        <Card style={{ background: T.accentSoft, borderColor: T.accentBorder }}>
          <div style={{ fontSize: 14, color: T.accent, fontWeight: 600, lineHeight: 1.5 }}>
            👋 Elige tu nombre y marca la cantidad de cada ítem que consumiste con los botones + / −
          </div>
        </Card>

        <Lbl>¿QUIÉN ERES?</Lbl>
        <Sel value={selPerson} onChange={e => { setSelPerson(e.target.value); setMyQtys({}); setIsEditingClaim(false); }}>
          <option value="">— Elige tu nombre —</option>
          {(isEditingClaim ? ppl : availPeople).map(p => <option key={p.id} value={p.id}>{p.avatar} {p.name}</option>)}
        </Sel>

        {isEditingClaim && selPerson && (
          <Card style={{ background: T.warnSoft, borderColor: T.warn, borderWidth: 1.5, borderStyle: "solid" }}>
            <div style={{ fontSize: 14, color: T.warn, fontWeight: 700 }}>✏️ Editando respuesta anterior</div>
            <div style={{ fontSize: 12, color: T.textSec, marginTop: 4 }}>Tus selecciones anteriores están pre-cargadas. Al confirmar se sobrescribirán.</div>
          </Card>
        )}

        {availPeople.length === 0 && ppl.length > 0 && !isEditingClaim && (
          <Card style={{ background: T.accentSoft, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.accent }}>¡Todos confirmaron!</div>
            <Btn onClick={() => setView("dashboard")} full style={{ marginTop: 12 }}>📊 Ver Resumen</Btn>
          </Card>
        )}

        {confCount > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ppl.filter(p => claims[p.id]).map(p => <Tag key={p.id} color={T.accent}>{p.avatar} {p.name} ✓</Tag>)}
            {ppl.filter(p => !claims[p.id]).map(p => <Tag key={p.id} color={T.warn}>{p.avatar} {p.name}</Tag>)}
          </div>
        )}

        {selPerson && (<>
          {/* Shared items — each person toggles if they participated */}
          {items.filter(it => it.shared).length > 0 && (<>
            <Lbl>👥 ÍTEMS COMPARTIDOS</Lbl>
            <div style={{ fontSize: 12, color: T.textSec, marginTop: -8, marginBottom: 4 }}>Marca los que compartiste</div>
            {items.filter(it => it.shared).map(it => {
              const joined = (myQtys["sh_" + it.id] || 0) === 1;
              const othersCount = Object.entries(claims).filter(([pid, c]) => pid !== selPerson && c.shared && c.shared[it.id]).length;
              const totalIfJoin = othersCount + 1;
              const shareIfJoin = Math.round(it.unitPrice * it.qty / totalIfJoin);
              return (
                <div key={"sh-" + it.id} onClick={() => setMyQtys(prev => ({ ...prev, ["sh_" + it.id]: joined ? 0 : 1 }))}
                  style={{ background: joined ? T.hotSoft : T.card, borderRadius: 14, padding: "14px 18px", border: `1.5px solid ${joined ? T.hot : T.border}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: joined ? T.hot : T.surface, border: `2px solid ${joined ? T.hot : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", flexShrink: 0 }}>{joined ? "✓" : ""}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: joined ? T.text : T.textSec }}>{it.name}</div>
                    <div style={{ fontSize: 12, color: T.textDim }}>
                      {fmt(it.unitPrice * it.qty)} total
                      {othersCount > 0 && ` · ${othersCount} ya se sumaron`}
                      {joined && ` · te toca ${fmt(shareIfJoin)}`}
                    </div>
                  </div>
                  {joined && <div style={{ fontSize: 14, fontWeight: 700, color: T.hot }}>{fmt(shareIfJoin)}</div>}
                </div>
              );
            })}
          </>)}

          {/* Individual items — stepper selection */}
          <Lbl>¿QUÉ CONSUMISTE?</Lbl>
          {items.filter(it => !it.shared).map(it => {
            const myQ = myQtys[it.id] || 0;
            const rem = remainQty(it.id);
            const on = myQ > 0;
            return (
              <div key={it.id} style={{
                background: on ? T.cardAlt : T.card, borderRadius: 14, padding: "16px 18px",
                border: `1.5px solid ${on ? T.accent : T.border}`,
                display: "flex", alignItems: "center", gap: 14,
                boxShadow: on ? `0 0 14px ${T.accentGlow}` : "none",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: on ? T.text : T.textSec }}>{it.name}</div>
                  <div style={{ fontSize: 13, color: T.textDim, display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                    <span>{fmt(it.unitPrice)} c/u</span><span>·</span>
                    {rem > 0 ? <span style={{ color: T.textSec }}>{rem} disponible{rem !== 1 ? "s" : ""}</span> : <span style={{ color: T.warn }}>Agotado</span>}
                  </div>
                  {on && <div style={{ fontSize: 14, fontWeight: 700, color: T.accent, marginTop: 4 }}>{myQ} × {fmt(it.unitPrice)} = {fmt(it.unitPrice * myQ)}</div>}
                </div>
                <Stepper value={myQ} max={rem} onChange={q => setIQ(it.id, q)} />
              </div>
            );
          })}

          <Card glow style={{ position: "sticky", bottom: 80 }}>
            {mySharedTotal > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.hot, marginBottom: 4 }}>
              <span>👥 Compartidos</span><span>{fmt(mySharedTotal)}</span>
            </div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.textSec, marginBottom: 4 }}>
              <span>{myCount} ítem{myCount !== 1 ? "s" : ""} individual{myCount !== 1 ? "es" : ""}</span><span>{fmt(myItemsTotal - mySharedTotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.textSec, marginBottom: 8 }}>
              <span>Propina ({tp}%)</span><span>{fmt(myTip)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 800, fontFamily: FT, color: T.accent, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
              <span>Tu total</span><span>{fmt(myItemsTotal + myTip)}</span>
            </div>
          </Card>

          <Fab disabled={(myCount === 0 && mySharedTotal === 0) || submitting} onClick={submitForm}>
            {submitting ? "Enviando…" : isEditingClaim ? `🔄 Actualizar · ${fmt(myItemsTotal + myTip)}` : `✅ Confirmar · ${fmt(myItemsTotal + myTip)}`}
          </Fab>
        </>)}
      </div>
    </Shell>
  );

  // ── FORM DONE ──
  if (view === "formDone") {
    const rem = ppl.length - confCount;
    const canCorrect = lastSubmittedPerson && roomData?.claims?.[lastSubmittedPerson];
    const handleCorrect = () => {
      if (!canCorrect) return;
      const claim = roomData.claims[lastSubmittedPerson];
      const rebuilt = {};
      Object.entries(claim.items || {}).forEach(([iid, q]) => { rebuilt[iid] = q; });
      Object.keys(claim.shared || {}).forEach(iid => { rebuilt["sh_" + iid] = 1; });
      setMyQtys(rebuilt);
      setSelPerson(lastSubmittedPerson);
      setIsEditingClaim(true);
      setJustUpdated(false);
      setView("form");
    };
    return (
      <Shell>
        <Hdr title={justUpdated ? "¡Actualizado!" : "¡Confirmado!"} />
        <div style={{ padding: "20px 16px 40px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ textAlign: "center", padding: "28px 0 8px" }}>
            <div style={{ width: 88, height: 88, borderRadius: 24, margin: "0 auto 16px", background: T.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, animation: "pop .5s ease", boxShadow: `0 0 40px ${T.accentGlow}` }}>✅</div>
            <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: FT, margin: "0 0 6px" }}>
              {justUpdated ? "Respuesta actualizada ✓" : "¡Registrado!"}
            </h2>
            <p style={{ color: T.textSec, fontSize: 14 }}>{rem > 0 ? `Faltan ${rem} persona${rem > 1 ? "s" : ""}` : "🎉 ¡Todos confirmaron!"}</p>
          </div>
          {canCorrect && (
            <GBtn full onClick={handleCorrect} style={{ color: T.warn, borderColor: T.warn }}>✏️ Corregir mi reclamo</GBtn>
          )}
          {rem > 0 ? (
            <Btn color={T.accent} full onClick={goToForm}>📝 Siguiente persona</Btn>
          ) : (
            <Btn color={T.accent} full onClick={() => setView("dashboard")}>📊 Ver Resumen Final</Btn>
          )}
          <GBtn full onClick={() => setView("dashboard")}>📊 Ver Dashboard</GBtn>
        </div>
      </Shell>
    );
  }

  // ── HISTORY ──
  if (view === "history") {
    const goToHistoryRoom = async (code) => {
      const data = await fbGet(code);
      if (data) {
        setRoomCode(code);
        setRoomData(data);
        saveToHistory(code, data);
        setView("dashboard");
      }
    };
    const clearHistory = () => {
      setRoomHistory([]);
      try { localStorage.removeItem("sp_rooms"); } catch {}
    };
    return (
      <Shell>
        <Hdr title="Historial de salas" onBack={() => setView("home")} />
        <div style={{ padding: "20px 16px 40px", display: "flex", flexDirection: "column", gap: 12 }}>
          {roomHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: T.textDim }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <div>No hay salas recientes</div>
            </div>
          ) : roomHistory.map(entry => (
            <Card key={entry.code}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: T.text, marginBottom: 2 }}>{entry.restaurant || "Sin nombre"}</div>
                  <div style={{ fontSize: 12, color: T.textDim, fontWeight: 700, letterSpacing: 1 }}>{entry.code}</div>
                  {entry.branch && <div style={{ fontSize: 12, color: T.textSec, marginTop: 1 }}>{entry.branch}</div>}
                  <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>
                    {new Date(entry.accessedAt).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                    {entry.total ? ` · ${fmt(entry.total)}` : ""}
                  </div>
                </div>
                <Btn color={T.accent} onClick={() => goToHistoryRoom(entry.code)} style={{ padding: "10px 16px", fontSize: 13, borderRadius: 10 }}>Ver sala</Btn>
              </div>
            </Card>
          ))}
          {roomHistory.length > 0 && (
            <GBtn full onClick={clearHistory} style={{ marginTop: 8, color: T.danger, borderColor: T.danger }}>🗑️ Limpiar historial</GBtn>
          )}
        </div>
      </Shell>
    );
  }

  // ── DASHBOARD ──
  if (view === "dashboard") {
    const pctDone = ppl.length > 0 ? Math.round(confCount / ppl.length * 100) : 0;
    const overCl = items.filter(it => claimedQty(it.id) > it.qty);
    const underCl = allDone ? items.filter(it => claimedQty(it.id) < it.qty) : [];
    const sumP = ppl.reduce((s, p) => s + pTot(p.id), 0);

    return (
      <Shell>
        <Hdr title={roomData?.restaurant || "Dashboard"} sub={`${roomData?.branch ? roomData.branch + " · " : ""}${confCount}/${ppl.length}`}
          onBack={goToForm}
          right={<Btn onClick={refreshRoom} color={T.cardAlt} style={{ padding: "8px 14px", fontSize: 12, color: T.text, border: `1px solid ${T.border}` }}>🔄</Btn>}
        />
        <div style={{ padding: "20px 16px 120px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Card style={{ display: "flex", alignItems: "center", gap: 20, background: allDone ? T.accentSoft : T.card }}>
            <Ring pct={pctDone} />
            <div>
              <div style={{ fontSize: 30, fontWeight: 800, fontFamily: FT }}>{confCount}/{ppl.length}</div>
              <div style={{ fontSize: 13, color: T.textSec }}>{allDone ? "✅ ¡Todos confirmaron!" : "Esperando…"}</div>
            </div>
          </Card>

          {/* Share reminder */}
          {!allDone && roomCode && (
            <Card style={{ background: "#1a2e1a", border: "1px solid rgba(37,211,102,0.15)" }}>
              <div style={{ fontSize: 13, color: T.textSec, marginBottom: 8 }}>🔑 Código: <strong style={{ color: T.whatsapp, fontSize: 16, letterSpacing: 1 }}>{roomCode}</strong></div>
              <Btn color={T.whatsapp} full onClick={() => cp(whatsInvite(), "✅ Copiado")} style={{ fontSize: 13, padding: 12, borderRadius: 10 }}>
                {copied === "✅ Copiado" ? "✅ ¡Copiado!" : "💬 Copiar mensaje WhatsApp"}
              </Btn>
            </Card>
          )}

          {overCl.length > 0 && (
            <Card style={{ borderLeft: `3px solid ${T.danger}`, background: T.dangerSoft }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.danger, marginBottom: 6 }}>⚠️ Sobre-reclamados</div>
              {overCl.map(it => <div key={it.id} style={{ fontSize: 13, color: T.text, padding: "2px 0" }}>{it.name}: {claimedQty(it.id)}/{it.qty}</div>)}
            </Card>
          )}
          {underCl.length > 0 && (
            <Card style={{ borderLeft: `3px solid ${T.warn}`, background: T.warnSoft }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.warn, marginBottom: 6 }}>📋 Sin reclamar</div>
              {underCl.map(it => <div key={it.id} style={{ fontSize: 13, color: T.text, padding: "2px 0" }}>{it.name}: {claimedQty(it.id)}/{it.qty}</div>)}
            </Card>
          )}

          <Lbl>DETALLE POR PERSONA</Lbl>
          {ppl.map(p => {
            const cl = claims[p.id]; const s = pSub(p.id); const t = pTip(p.id); const tot = pTot(p.id);
            const pc = total > 0 ? (tot / total * 100) : 0;
            return (
              <Card key={p.id} style={{ borderLeft: `3px solid ${cl ? T.accent : T.warn}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: cl ? 10 : 0 }}>
                  <span style={{ fontSize: 28 }}>{p.avatar}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: T.textSec }}>{cl ? `${pc.toFixed(0)}% del total` : "⏳ Pendiente"}</div>
                  </div>
                  {cl ? <div style={{ fontSize: 20, fontWeight: 800, color: T.accent }}>{fmt(tot)}</div> : <Tag color={T.warn}>Esperando</Tag>}
                </div>
                {cl && (<>
                  <div style={{ background: T.surface, borderRadius: 6, height: 4, overflow: "hidden", marginBottom: 10 }}>
                    <div style={{ background: T.accent, height: "100%", width: `${pc}%`, borderRadius: 6, transition: "width .5s" }} />
                  </div>
                  {Object.entries(cl.items || {}).map(([iid, q]) => {
                    const it = items.find(i => i.id === iid); if (!it) return null;
                    return <div key={iid} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.textSec, padding: "2px 0" }}><span>{q > 1 ? `${q}× ` : ""}{it.name}</span><span>{fmt(it.unitPrice * q)}</span></div>;
                  })}
                  {claims[p.id]?.shared && Object.keys(claims[p.id].shared).map(iid => {
                    const it = items.find(i => i.id === iid); if (!it) return null;
                    const n = sharedClaimCount(iid) || 1;
                    return <div key={"sh-"+iid} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.hot, padding: "2px 0" }}><span>👥 {it.name} (÷{n})</span><span>{fmt(Math.round(it.unitPrice * it.qty / n))}</span></div>;
                  })}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.textSec, padding: "4px 0 0", borderTop: `1px solid ${T.border}`, marginTop: 4 }}>
                    <span>Propina ({tp}%)</span><span>{fmt(t)}</span>
                  </div>
                </>)}
              </Card>
            );
          })}

          <Card style={{ background: `linear-gradient(145deg,${T.accentSoft},${T.hotSoft})` }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: T.textSec, marginBottom: 4 }}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: T.textSec, marginBottom: 4 }}><span>Propina</span><span>{fmt(tipAmount)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: T.textSec, marginBottom: 10 }}><span>Suma aportes</span><span>{fmt(sumP)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 800, fontFamily: FT, paddingTop: 10, borderTop: `1px solid ${T.border}` }}><span>Total</span><span style={{ color: T.accent }}>{fmt(total)}</span></div>
          </Card>

          <Btn color={T.whatsapp} full onClick={() => cp(whatsSummary(), "✅ Resumen copiado")} style={{ borderRadius: 14, padding: 16 }}>
            {copied === "✅ Resumen copiado" ? "✅ ¡Copiado!" : "📋 Copiar resumen para WhatsApp"}
          </Btn>

          {!allDone && <Btn full onClick={goToForm} style={{ borderRadius: 14, padding: 16 }}>📝 Siguiente persona</Btn>}
          <GBtn full onClick={() => { setView("home"); setRoomCode(null); setRoomData(null); setOcrItems([]); setPeople([]); setRestaurantName(""); setRestaurantBranch(""); }}>🏠 Nueva cuenta</GBtn>
        </div>
      </Shell>
    );
  }

  return <Shell><div style={{ padding: 40, textAlign: "center" }}><Btn onClick={() => setView("home")}>Inicio</Btn></div></Shell>;
}
