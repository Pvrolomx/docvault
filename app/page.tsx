"use client";
import { useState, useEffect, useRef } from "react";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const OWNERS = ["Rolo", "Claudia", "Castle"];

const CATEGORIES_PERSONAL = [
  { id: "identidad",   icon: "◈", label: "Identidad",         sub: "INE · Pasaporte · CURP · Acta de Nacimiento" },
  { id: "fiscal",      icon: "◉", label: "Fiscal & IMSS",     sub: "RFC · Constancia SAT · NSS · IMSS" },
  { id: "profesional", icon: "◆", label: "Profesional",       sub: "Cédula · Título · Diplomas · Certificados" },
  { id: "domicilio",   icon: "◫", label: "Domicilio",         sub: "Comprobante · CFE · Agua · Teléfono" },
  { id: "vehicular",   icon: "◳", label: "Vehicular",         sub: "Licencia · Factura · Tarjeta · Seguro" },
  { id: "civil",       icon: "◑", label: "Estado Civil",      sub: "Acta de Matrimonio · Divorcio · Actas" },
  { id: "inmuebles",   icon: "◰", label: "Inmuebles",         sub: "Escrituras · Fideicomiso · Predial · Planos" },
  { id: "legal",       icon: "◮", label: "Legal & Sucesorio", sub: "Poderes · Testamento · Contratos" },
  { id: "salud",       icon: "◍", label: "Salud & Seguro",    sub: "INAPAM · Seguro médico · Expediente" },
  { id: "financiero",  icon: "◎", label: "Financiero",        sub: "Cuentas · Estados · Inversiones · Crédito" },
  { id: "migratorio",  icon: "◐", label: "Migratorio",        sub: "Visa · Residente · FM3 · CURP extranjero" },
  { id: "otros",       icon: "◯", label: "Otros",             sub: "Documentos varios · Misceláneos" },
];

const CATEGORIES_CASTLE = [
  { id: "constitucion", icon: "◈", label: "Constitución",      sub: "Acta · Estatutos · Modificaciones" },
  { id: "fiscal_emp",   icon: "◉", label: "Fiscal",            sub: "RFC · Constancia SAT · Declaraciones" },
  { id: "imss_emp",     icon: "◆", label: "IMSS & Nómina",     sub: "Registro patronal · Altas/Bajas · Nómina" },
  { id: "permisos",     icon: "◫", label: "Permisos & Licencias", sub: "Uso de suelo · Operación · Turismo" },
  { id: "contratos",    icon: "◳", label: "Contratos",         sub: "Arrendamiento · Servicios · Proveedores" },
  { id: "bancario",     icon: "◑", label: "Bancario",          sub: "Cuentas · Estados · Tarjetas corporativas" },
  { id: "inmuebles_emp",icon: "◰", label: "Inmuebles",         sub: "Propiedades · Contratos de renta" },
  { id: "poderes",      icon: "◮", label: "Poderes & Legal",   sub: "Poderes notariales · Representantes" },
  { id: "plataformas",  icon: "◍", label: "Plataformas",       sub: "Airbnb · VRBO · Booking · Licencias" },
  { id: "seguros",      icon: "◎", label: "Seguros",           sub: "Pólizas · Propiedades · Responsabilidad" },
  { id: "contabilidad", icon: "◐", label: "Contabilidad",      sub: "Balances · Estados financieros · Auditorías" },
  { id: "otros_emp",    icon: "◯", label: "Otros",             sub: "Documentos corporativos varios" },
];

const DOC_TYPES = ["Original","Copia simple","Copia certificada","Digital oficial","Apostillada","Traducida","Vigente","Vencida","Histórico"];

const PAL: Record<string,{accent:string;dim:string;mid:string;dot:string}> = {
  Rolo:    { accent: "#C8A96E", dim: "#C8A96E22", mid: "#C8A96E44", dot: "#C8A96E" },
  Claudia: { accent: "#9B7BB8", dim: "#9B7BB822", mid: "#9B7BB844", dot: "#9B7BB8" },
  Castle:  { accent: "#4EADA0", dim: "#4EADA022", mid: "#4EADA044", dot: "#4EADA0" },
};

const ITERATIONS = 310000;
const SALT_LEN = 32;
const IV_LEN   = 12;

async function generateSalt() {
  const s = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  return btoa(String.fromCharCode(...s));
}
async function deriveKey(password: string, saltB64: string) {
  const enc  = new TextEncoder();
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const km   = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name:"PBKDF2", salt, iterations:ITERATIONS, hash:"SHA-256" },
    km, { name:"AES-GCM", length:256 }, false, ["encrypt","decrypt"]
  );
}
async function encryptData(data: unknown, key: CryptoKey) {
  const enc = new TextEncoder();
  const iv  = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ct  = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, enc.encode(JSON.stringify(data)));
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv); combined.set(new Uint8Array(ct), iv.length);
  return btoa(String.fromCharCode(...combined));
}
async function decryptData(b64: string, key: CryptoKey) {
  const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LEN);
  const ct = combined.slice(IV_LEN);
  const pt = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}
async function hashPassword(password: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password + "_docvault_v1"));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────
async function sbUploadFile(vaultId: string, catId: string, file: File): Promise<string> {
  const ext  = file.name.split('.').pop() || 'bin';
  const name = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
  const path = `${vaultId}/${catId}/${name}`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/docvault-files/${path}`, {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}`, "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Upload failed'); }
  return path;
}

async function sbGetFileUrl(path: string): Promise<string> {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/docvault-files/${path}`, {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 300 }),
  });
  const d = await r.json();
  return `${SUPABASE_URL}/storage/v1${d.signedURL}`;
}

async function sbDeleteFile(path: string) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/docvault-files/${path}`, {
    method: "DELETE",
    headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}` },
  });
}

async function sbSave(vaultId: string, blob: string, salt: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/docvault_docs`, {
    method:"POST",
    headers:{ "apikey":SUPABASE_ANON, "Authorization":`Bearer ${SUPABASE_ANON}`, "Content-Type":"application/json", "Prefer":"resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ vault_id:vaultId, blob, salt, updated_at:new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`Save failed: ${r.status}`);
}
async function sbLoad(vaultId: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/docvault_docs?vault_id=eq.${vaultId}&select=blob,salt`, {
    headers:{ "apikey":SUPABASE_ANON, "Authorization":`Bearer ${SUPABASE_ANON}` },
  });
  const rows = await r.json();
  return rows.length ? rows[0] : null;
}

type FileAttachment = { name: string; path: string; size: number; type: string; uploaded: number };
type Doc = { id:string; name:string; type:string; notes:string; date:string; expires:string; created:number; files?: FileAttachment[] };
type VaultData = Record<string, Doc[]>;

export default function DocVault() {
  const [screen, setScreen]       = useState<"login"|"app">("login");
  const [owner, setOwner]         = useState("Rolo");
  const [pinInput, setPinInput]   = useState("");
  const [pinError, setPinError]   = useState("");
  const [vaultData, setVaultData] = useState<Record<string,VaultData>>({ Rolo:{}, Claudia:{}, Castle:{} });
  const [keys,  setKeys]          = useState<Record<string,CryptoKey|null>>({ Rolo:null, Claudia:null, Castle:null });
  const [salts, setSalts]         = useState<Record<string,string>>({ Rolo:"", Claudia:"", Castle:"" });
  const [vaultIds, setVaultIds]   = useState<Record<string,string>>({ Rolo:"", Claudia:"", Castle:"" });
  const [openCat, setOpenCat]     = useState<string|null>(null);
  const [modal, setModal]         = useState<{cat:string;doc?:Doc}|null>(null);
  const [form,  setForm]          = useState({ name:"", type:"Original", notes:"", date:"", expires:"" });
  const [search, setSearch]       = useState("");
  const [saving,  setSaving]      = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [uploading, setUploading] = useState<string|null>(null); // docId en proceso
  const [dragOver, setDragOver]   = useState<string|null>(null); // docId con drag encima
  const [toast,   setToast]       = useState<{msg:string;err?:boolean}|null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e:any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const showToast = (msg:string, err=false) => {
    setToast({msg,err}); setTimeout(()=>setToast(null), 2500);
  };

  const unlock = async () => {
    if (pinInput.length < 4) { setPinError("Mínimo 4 caracteres"); return; }
    setSyncing(true); setPinError("");
    try {
      const vaultId = await hashPassword(`${owner}_${pinInput}`);
      const row = await sbLoad(vaultId);
      let salt:string, key:CryptoKey, data:VaultData;
      if (row) {
        salt = row.salt; key = await deriveKey(pinInput, salt);
        try { data = await decryptData(row.blob, key); }
        catch { setSyncing(false); setPinError("PIN incorrecto"); return; }
      } else {
        salt = await generateSalt(); key = await deriveKey(pinInput, salt);
        data = {};
        const cats = owner === "Castle" ? CATEGORIES_CASTLE : CATEGORIES_PERSONAL;
        for (const c of cats) data[c.id] = [];
        const blob = await encryptData(data, key);
        await sbSave(vaultId, blob, salt);
      }
      setKeys(prev    => ({...prev,[owner]:key}));
      setSalts(prev   => ({...prev,[owner]:salt}));
      setVaultIds(prev => ({...prev,[owner]:vaultId}));
      setVaultData(prev => ({...prev,[owner]:data}));
      setPinInput(""); setScreen("app");
      showToast(`${owner} desbloqueado ✓`);
    } catch { setPinError("Error de conexión"); }
    setSyncing(false);
  };

  const saveToCloud = async (newData:VaultData) => {
    const key=keys[owner]; const salt=salts[owner]; const vaultId=vaultIds[owner];
    if (!key||!salt||!vaultId) return;
    setSaving(true);
    try { const blob = await encryptData(newData, key); await sbSave(vaultId, blob, salt); }
    catch { showToast("Error al sincronizar", true); }
    setSaving(false);
  };

  const updateOwnerData = async (newData:VaultData) => {
    setVaultData(prev => ({...prev,[owner]:newData}));
    await saveToCloud(newData);
  };

  const openAdd  = (catId:string) => { setModal({cat:catId}); setForm({name:"",type:"Original",notes:"",date:"",expires:""}); setTimeout(()=>inputRef.current?.focus(),80); };
  const openEdit = (catId:string, doc:Doc) => { setModal({cat:catId,doc}); setForm({name:doc.name,type:doc.type,notes:doc.notes,date:doc.date,expires:doc.expires}); setTimeout(()=>inputRef.current?.focus(),80); };

  const submitDoc = async () => {
    if (!form.name.trim()||!modal) return;
    const catId = modal.cat;
    const current = vaultData[owner]?.[catId] || [];
    let updated:Doc[];
    if (modal.doc) {
      updated = current.map(d => d.id===modal.doc!.id ? {...d,...form} : d);
      showToast("Actualizado ✓");
    } else {
      updated = [...current, {id:`${catId}-${Date.now()}`,...form,created:Date.now()}];
      showToast("Guardado ✓");
    }
    await updateOwnerData({...vaultData[owner],[catId]:updated});
    setModal(null);
  };

  const deleteDoc = async (catId:string, docId:string) => {
    // Borrar archivos del doc primero
    const doc = (vaultData[owner]?.[catId]||[]).find(d=>d.id===docId);
    if (doc?.files?.length) {
      for (const f of doc.files) { try { await sbDeleteFile(f.path); } catch {} }
    }
    await updateOwnerData({...vaultData[owner],[catId]:(vaultData[owner]?.[catId]||[]).filter(d=>d.id!==docId)});
    showToast("Eliminado",true);
  };

  const handleFiles = async (catId:string, docId:string, files: FileList|File[]) => {
    const fileArr = Array.from(files);
    const vaultId = vaultIds[owner];
    if (!vaultId) return;
    setUploading(docId);
    try {
      const uploaded: FileAttachment[] = [];
      for (const file of fileArr) {
        if (file.size > 10 * 1024 * 1024) { showToast(`${file.name} supera 10MB`, true); continue; }
        const path = await sbUploadFile(vaultId, catId, file);
        uploaded.push({ name: file.name, path, size: file.size, type: file.type, uploaded: Date.now() });
      }
      const catDocs = vaultData[owner]?.[catId] || [];
      const newDocs = catDocs.map(d => d.id===docId
        ? {...d, files: [...(d.files||[]), ...uploaded]}
        : d
      );
      await updateOwnerData({...vaultData[owner],[catId]:newDocs});
      showToast(`${uploaded.length} archivo${uploaded.length!==1?"s":""} subido${uploaded.length!==1?"s":""} ✓`);
    } catch(e:any) { showToast(e.message||"Error al subir", true); }
    setUploading(null);
  };

  const deleteFile = async (catId:string, docId:string, filePath:string) => {
    try { await sbDeleteFile(filePath); } catch {}
    const catDocs = vaultData[owner]?.[catId] || [];
    const newDocs = catDocs.map(d => d.id===docId
      ? {...d, files:(d.files||[]).filter(f=>f.path!==filePath)}
      : d
    );
    await updateOwnerData({...vaultData[owner],[catId]:newDocs});
    showToast("Archivo eliminado",true);
  };

  const downloadFile = async (path:string, name:string) => {
    try {
      const url = await sbGetFileUrl(path);
      const a = document.createElement('a');
      a.href=url; a.download=name; a.target="_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { showToast("Error al descargar",true); }
  };

  const switchOwner = (o:string) => {
    setOwner(o); setOpenCat(null);
    if (!keys[o]) { setScreen("login"); setPinInput(""); setPinError(""); }
  };

  const pal   = PAL[owner];
  const CATEGORIES = owner === "Castle" ? CATEGORIES_CASTLE : CATEGORIES_PERSONAL;
  const oData = vaultData[owner] || {};
  const total = Object.values(oData).reduce((s,a)=>s+(a?.length||0),0);
  const filtered = search.trim()
    ? CATEGORIES.filter(c => c.label.toLowerCase().includes(search.toLowerCase()) || (oData[c.id]||[]).some(d=>d.name.toLowerCase().includes(search.toLowerCase())))
    : CATEGORIES;
  const isExpired  = (d:Doc) => !!d.expires && new Date(d.expires)<new Date();
  const isExpiring = (d:Doc) => { if(!d.expires||isExpired(d)) return false; return (new Date(d.expires).getTime()-Date.now())/86400000<60; };

  // ── OWNER CARD COMPONENT ──────────────────────────────────────────────────
  const OwnerCard = ({ o, onClick, showCount }: { o:string; onClick:()=>void; showCount?:boolean }) => {
    const p     = PAL[o];
    const cnt   = Object.values(vaultData[o]||{}).reduce((s,a)=>s+(a?.length||0),0);
    const active = owner === o;
    const unlocked = !!keys[o];
    return (
      <button onClick={onClick} style={{
        flex:1, maxWidth:220,
        display:"flex", flexDirection:"column", alignItems:"center", gap:10,
        padding:"20px 16px 16px",
        borderRadius:16,
        border:`1px solid ${active ? p.accent+"80" : "#252525"}`,
        background: active
          ? `linear-gradient(150deg, ${p.accent}1a 0%, ${p.accent}08 100%)`
          : "linear-gradient(150deg, #161616 0%, #111 100%)",
        cursor:"pointer",
        transition:"all 0.25s ease",
        boxShadow: active ? `0 0 28px ${p.accent}20, inset 0 1px 0 ${p.accent}30` : "inset 0 1px 0 #ffffff08",
        position:"relative", overflow:"hidden"
      }}>
        {/* shimmer top */}
        <div style={{
          position:"absolute", top:0, left:"15%", right:"15%", height:1,
          background: active ? `linear-gradient(90deg, transparent, ${p.accent}70, transparent)` : "transparent",
          transition:"all 0.25s"
        }}/>
        {/* avatar */}
        <div style={{
          width:52, height:52, borderRadius:"50%",
          background: active
            ? `radial-gradient(circle at 38% 38%, ${p.accent}50, ${p.accent}18)`
            : "radial-gradient(circle at 38% 38%, #252525, #181818)",
          border:`2px solid ${active ? p.accent+"70" : "#3a3a3a"}`,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:22, fontFamily:"'Libre Baskerville',serif", fontWeight:700,
          color: active ? p.accent : "#3a3a3a",
          boxShadow: active ? `0 4px 20px ${p.accent}28` : "none",
          transition:"all 0.25s", flexShrink:0
        }}>{o[0]}</div>
        {/* name */}
        <div style={{
          fontSize:11, letterSpacing:"0.22em", fontWeight:700,
          fontFamily:"'Space Mono',monospace",
          color: active ? p.accent : "#909090"
        }}>{o.toUpperCase()}</div>
        {/* badge */}
        {showCount ? (
          <div style={{
            fontSize:10, padding:"3px 12px", borderRadius:20,
            background: active ? p.accent+"25" : "#1a1a1a",
            color: active ? p.accent : "#888888",
            border:`1px solid ${active ? p.accent+"40" : "#252525"}`,
            fontFamily:"'Space Mono',monospace", letterSpacing:"0.05em"
          }}>{cnt} doc{cnt!==1?"s":""}</div>
        ) : (
          <div style={{
            fontSize:9, padding:"3px 10px", borderRadius:20,
            background: active ? p.accent+"20" : "#1a1a1a",
            color: active ? p.accent+"cc" : "#888888",
            border:`1px solid ${active ? p.accent+"35" : "#252525"}`,
            fontFamily:"'Space Mono',monospace", letterSpacing:"0.08em"
          }}>{unlocked ? "✓ desbloqueado" : "🔒 bloqueado"}</div>
        )}
      </button>
    );
  };

  // ════════════════════════════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ════════════════════════════════════════════════════════════════════════════
  if (screen==="login") return (
    <div style={{minHeight:"100vh",background:"#0D0D0D",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Space Mono',monospace",padding:16}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');
        input{background:#1a1a1a!important;border:1px solid #2a2a2a!important;color:#e5e0d8!important;border-radius:6px;padding:14px 16px;font-family:'Space Mono',monospace;font-size:18px;outline:none;width:100%;letter-spacing:0.25em;text-align:center;}
        input:focus{border-color:var(--acc)!important;box-shadow:0 0 0 3px var(--acc-dim);}
        .unlock-btn{transition:all 0.2s;} .unlock-btn:hover{filter:brightness(1.1);}
      `}</style>

      <div style={{width:"100%",maxWidth:520}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontSize:10,letterSpacing:"0.3em",color:"#777777",marginBottom:10}}>BÓVEDA PERSONAL</div>
          <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:32,color:"#E5E0D8",letterSpacing:"-0.01em"}}>DocVault</div>
          <div style={{width:40,height:1,background:"linear-gradient(90deg,transparent,#444,transparent)",margin:"12px auto 0"}}/>
        </div>

        {/* Owner cards */}
        <div style={{display:"flex",gap:12,marginBottom:28,justifyContent:"center"}}>
          {OWNERS.map(o => (
            <OwnerCard key={o} o={o} onClick={()=>{setOwner(o);setPinInput("");setPinError("");}} />
          ))}
        </div>

        {/* PIN input */}
        <div style={{"--acc":pal.accent,"--acc-dim":pal.dim} as any}>
          <div style={{fontSize:9,color:"#888888",letterSpacing:"0.2em",marginBottom:8,textAlign:"center"}}>
            PIN DE {owner.toUpperCase()}
          </div>
          <input
            type="password" value={pinInput}
            onChange={e=>setPinInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&unlock()}
            placeholder="••••" autoFocus
          />
          {pinError && (
            <div style={{fontSize:11,color:"#f87171",textAlign:"center",marginTop:8,letterSpacing:"0.05em"}}>{pinError}</div>
          )}
        </div>

        <button className="unlock-btn" onClick={unlock} disabled={syncing} style={{
          width:"100%", marginTop:14, padding:"13px 0", borderRadius:8, border:"none",
          cursor:syncing?"not-allowed":"pointer",
          background: `linear-gradient(135deg, ${pal.accent}, ${pal.accent}cc)`,
          color:"#0D0D0D", fontSize:11, fontFamily:"'Space Mono',monospace",
          fontWeight:700, letterSpacing:"0.18em",
          boxShadow:`0 4px 20px ${pal.accent}30`,
          opacity:syncing?0.6:1
        }}>{syncing?"CONECTANDO…":"ABRIR BÓVEDA"}</button>

        <div style={{textAlign:"center",marginTop:14,fontSize:10,color:"#888888"}}>
          Primera vez → tu PIN crea la bóveda
        </div>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // APP SCREEN
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{minHeight:"100vh",background:"#0D0D0D",color:"#E5E0D8",fontFamily:"'Space Mono',monospace"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap');
        .sli{animation:sli .2s ease forwards}
        @keyframes sli{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        .tin{animation:tin .2s ease,tout .3s ease 2.2s forwards}
        @keyframes tin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes tout{from{opacity:1}to{opacity:0}}
        .drow{transition:transform .15s}.drow:hover{transform:translateX(3px)}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        input,textarea,select{background:#1A1A1A!important;border:1px solid #2A2A2A!important;color:#E5E0D8!important;border-radius:4px;padding:8px 10px;font-family:'Space Mono',monospace;font-size:13px;outline:none;width:100%}
        input:focus,textarea:focus,select:focus{border-color:var(--acc)!important}
        select option{background:#1A1A1A}
        .ocard{transition:all .25s ease} .ocard:hover{transform:translateY(-2px)}
      `}</style>

      {toast&&(
        <div className="tin" style={{position:"fixed",bottom:72,left:"50%",transform:"translateX(-50%)",zIndex:60,padding:"10px 20px",borderRadius:6,fontSize:12,letterSpacing:"0.08em",background:toast.err?"#2d0a0a":"#1a1a1a",border:`1px solid ${toast.err?"#7f1d1d":"#333"}`,color:toast.err?"#fca5a5":"#d4d4d4"}}>
          {toast.msg}
        </div>
      )}

      {modal&&(
        <div onClick={e=>{if(e.target===e.currentTarget)setModal(null)}} style={{position:"fixed",inset:0,zIndex:40,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div className="sli" style={{width:"100%",maxWidth:440,margin:"0 16px",borderRadius:12,border:`1px solid ${pal.accent}55`,background:"#111",padding:24,["--acc"as any]:pal.accent}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
              <div>
                <div style={{fontSize:10,letterSpacing:"0.2em",color:pal.accent,marginBottom:4}}>{modal.doc?"EDITAR":"NUEVO DOCUMENTO"}</div>
                <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:18,color:"#e5e0d8"}}>{CATEGORIES.find(c=>c.id===modal.cat)?.label}</div>
              </div>
              <button onClick={()=>setModal(null)} style={{background:"none",border:"none",color:"#909090",fontSize:22,cursor:"pointer",lineHeight:1}}>×</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <div style={{fontSize:10,color:"#909090",letterSpacing:"0.15em",marginBottom:4}}>NOMBRE *</div>
                <input ref={inputRef} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="ej. INE vigente 2025…" onKeyDown={e=>e.key==="Enter"&&submitDoc()}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <div style={{fontSize:10,color:"#909090",letterSpacing:"0.15em",marginBottom:4}}>TIPO</div>
                  <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{DOC_TYPES.map(t=><option key={t}>{t}</option>)}</select>
                </div>
                <div>
                  <div style={{fontSize:10,color:"#909090",letterSpacing:"0.15em",marginBottom:4}}>FECHA</div>
                  <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:"#909090",letterSpacing:"0.15em",marginBottom:4}}>VENCIMIENTO</div>
                <input type="date" value={form.expires} onChange={e=>setForm(f=>({...f,expires:e.target.value}))}/>
              </div>
              <div>
                <div style={{fontSize:10,color:"#909090",letterSpacing:"0.15em",marginBottom:4}}>NOTAS</div>
                <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Folio, ubicación física…" rows={2} style={{resize:"none"}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:8,marginTop:20}}>
              <button onClick={submitDoc} disabled={saving} style={{flex:1,padding:"10px 0",borderRadius:6,border:"none",cursor:"pointer",background:`linear-gradient(135deg,${pal.accent},${pal.accent}cc)`,color:"#0D0D0D",fontSize:11,fontFamily:"'Space Mono',monospace",fontWeight:700,letterSpacing:"0.15em",opacity:saving?.6:1}}>
                {saving?"GUARDANDO…":modal.doc?"ACTUALIZAR":"GUARDAR"}
              </button>
              <button onClick={()=>setModal(null)} style={{padding:"10px 16px",borderRadius:6,border:"1px solid #333",cursor:"pointer",background:"transparent",color:"#bbbbbb",fontSize:11,fontFamily:"'Space Mono',monospace"}}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{background:"#0A0A0A",borderBottom:"1px solid #1a1a1a"}}>
        <div style={{maxWidth:600,margin:"0 auto",padding:"20px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:10,letterSpacing:"0.25em",color:"#777777",marginBottom:4}}>BÓVEDA PERSONAL</div>
              <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:26,color:"#E5E0D8"}}>DocVault</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
              <div style={{fontSize:10,color:"#888888"}}>{total} doc{total!==1?"s":""}</div>
              {installPrompt&&(
                <button onClick={async()=>{installPrompt.prompt();const{outcome}=await installPrompt.userChoice;if(outcome==="accepted")setInstallPrompt(null);}} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${pal.accent}60`,background:pal.dim,color:pal.accent,fontSize:10,cursor:"pointer",fontFamily:"'Space Mono',monospace",letterSpacing:"0.1em"}}>
                  ⬇ Instalar App
                </button>
              )}
              {saving&&<div style={{fontSize:9,color:"#888888",letterSpacing:"0.1em"}}>sincronizando…</div>}
            </div>
          </div>

          {/* Owner cards — centered, with avatar */}
          <div style={{display:"flex",gap:12,marginTop:20,justifyContent:"center"}}>
            {OWNERS.map(o => (
              <OwnerCard key={o} o={o} onClick={()=>switchOwner(o)} showCount />
            ))}
          </div>

          {/* Search */}
          <div style={{marginTop:14,position:"relative"}}>
            <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#888888",fontSize:14}}>⌕</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar categoría o documento…" style={{paddingLeft:30}}/>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div style={{maxWidth:600,margin:"0 auto",padding:"12px 16px 80px"}}>
        {filtered.map(cat=>{
          const catDocs = oData[cat.id]||[];
          const isOpen  = openCat===cat.id;
          const expiredDocs  = catDocs.filter(d=>isExpired(d));
          const expiringDocs = catDocs.filter(d=>isExpiring(d));
          return (
            <div key={cat.id} style={{marginBottom:6,borderRadius:8,overflow:"hidden",border:`1px solid ${isOpen?pal.accent+"45":"#1e1e1e"}`,background:isOpen?"#111":"#0D0D0D"}}>
              <button onClick={()=>setOpenCat(isOpen?null:cat.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 14px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left"}}>
                <span style={{fontSize:17,color:isOpen?pal.accent:"#888888",minWidth:20}}>{cat.icon}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,color:isOpen?"#e5e0d8":"#cccccc"}}>{cat.label}</span>
                    {catDocs.length>0&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:pal.dim,color:pal.accent,border:`1px solid ${pal.accent}35`}}>{catDocs.length}</span>}
                    {expiredDocs.length>0&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:"#2d0a0a",color:"#f87171",border:"1px solid #7f1d1d55"}}>⚠ {expiredDocs.length} vencido{expiredDocs.length>1?"s":""}</span>}
                    {expiringDocs.length>0&&expiredDocs.length===0&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:"#2d1f00",color:"#fbbf24",border:"1px solid #92400e55"}}>por vencer</span>}
                  </div>
                  <div style={{fontSize:11,color:"#aaaaaa",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat.sub}</div>
                </div>
                <span style={{color:"#888888",fontSize:10,transform:isOpen?"rotate(90deg)":"rotate(0)",transition:"transform .2s",display:"inline-block"}}>▶</span>
              </button>

              {isOpen&&(
                <div className="sli" style={{padding:"0 14px 14px"}}>
                  <div style={{borderTop:"1px solid #222",marginBottom:12}}/>
                  {catDocs.length===0&&<div style={{fontSize:11,color:"#aaaaaa",fontStyle:"italic",textAlign:"center",padding:"8px 0 12px"}}>Sin documentos en esta categoría</div>}
                  <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:catDocs.length?12:0}}>
                    {catDocs.map(doc=>{
                      const exp=isExpired(doc); const exp2=isExpiring(doc);
                      const barColor=exp?"#ef4444":exp2?"#eab308":pal.dot;
                      return (
                        <div key={doc.id} className="drow"
                          onDragOver={e=>{e.preventDefault();setDragOver(doc.id);}}
                          onDragLeave={()=>setDragOver(null)}
                          onDrop={e=>{e.preventDefault();setDragOver(null);handleFiles(cat.id,doc.id,e.dataTransfer.files);}}
                          style={{display:"flex",alignItems:"flex-start",gap:10,padding:12,borderRadius:6,
                            background:dragOver===doc.id?`${pal.accent}12`:"#141414",
                            border:`1px solid ${dragOver===doc.id?pal.accent+"60":"#222"}`,
                            transition:"all 0.15s"}}>
                          <div style={{width:3,borderRadius:2,background:barColor,alignSelf:"stretch",minHeight:18,flexShrink:0}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,color:"#e5e0d8"}}>{doc.name}</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
                              <span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:pal.dim,color:pal.accent,border:`1px solid ${pal.accent}30`}}>{doc.type}</span>
                              {doc.date&&<span style={{fontSize:10,color:"#aaaaaa"}}>📅 {doc.date}</span>}
                              {doc.expires&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:exp?"#2d0a0a":exp2?"#2d1f00":"#1a1a1a",color:exp?"#f87171":exp2?"#fbbf24":"#aaaaaa",border:`1px solid ${exp?"#7f1d1d55":exp2?"#92400e55":"#3a3a3a"}`}}>{exp?"⚠ ":"↺ "}{doc.expires}</span>}
                            </div>
                            {doc.notes&&<div style={{fontSize:11,color:"#aaaaaa",marginTop:6,fontStyle:"italic",lineHeight:1.5}}>{doc.notes}</div>}

                            {/* Archivos adjuntos */}
                            {(doc.files||[]).length>0&&(
                              <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:4}}>
                                {(doc.files||[]).map(f=>(
                                  <div key={f.path} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:5,background:"#1a1a1a",border:"1px solid #2a2a2a"}}>
                                    <span style={{fontSize:15,flexShrink:0}}>{f.type.startsWith("image/")?"🖼️":f.type==="application/pdf"?"📄":"📎"}</span>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{fontSize:11,color:"#cccccc",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                                      <div style={{fontSize:9,color:"#666"}}>{(f.size/1024).toFixed(0)} KB</div>
                                    </div>
                                    <button onClick={()=>downloadFile(f.path,f.name)}
                                      style={{background:"none",border:"none",cursor:"pointer",fontSize:15,padding:"2px 5px",color:"#888"}}
                                      onMouseEnter={e=>(e.currentTarget.style.color=pal.accent)}
                                      onMouseLeave={e=>(e.currentTarget.style.color="#888")}
                                      title="Descargar">⬇️</button>
                                    <button onClick={()=>deleteFile(cat.id,doc.id,f.path)}
                                      style={{background:"none",border:"none",cursor:"pointer",fontSize:12,padding:"2px 5px",color:"#555"}}
                                      onMouseEnter={e=>(e.currentTarget.style.color="#f87171")}
                                      onMouseLeave={e=>(e.currentTarget.style.color="#555")}
                                      title="Eliminar">✕</button>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Zona drag & drop / tap para subir */}
                            <label style={{
                              marginTop:8, display:"flex", alignItems:"center", gap:7,
                              padding:"8px 10px", borderRadius:5, cursor:"pointer",
                              border:`1px dashed ${dragOver===doc.id?pal.accent:"#2a2a2a"}`,
                              color:dragOver===doc.id?pal.accent:"#777",
                              background:dragOver===doc.id?pal.dim:"transparent",
                              fontSize:10, transition:"all 0.15s",
                              opacity:uploading===doc.id?0.6:1
                            }}>
                              {uploading===doc.id
                                ? <><span style={{display:"inline-block",animation:"spin 0.8s linear infinite"}}>⟳</span> Subiendo…</>
                                : <><span>📎</span> Arrastra aquí o toca para adjuntar</>
                              }
                              <input type="file" multiple style={{display:"none"}}
                                onChange={e=>e.target.files&&handleFiles(cat.id,doc.id,e.target.files)}
                                disabled={!!uploading}/>
                            </label>
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
                            <button onClick={()=>openEdit(cat.id,doc)} style={{background:"none",border:"none",color:"#909090",cursor:"pointer",padding:"4px 8px",fontSize:12}} onMouseEnter={e=>(e.currentTarget.style.color="#ccc")} onMouseLeave={e=>(e.currentTarget.style.color="#909090")}>✎</button>
                            <button onClick={()=>deleteDoc(cat.id,doc.id)} style={{background:"none",border:"none",color:"#909090",cursor:"pointer",padding:"4px 8px",fontSize:12}} onMouseEnter={e=>(e.currentTarget.style.color="#f87171")} onMouseLeave={e=>(e.currentTarget.style.color="#909090")}>✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={()=>openAdd(cat.id)} style={{width:"100%",padding:"10px 0",borderRadius:6,border:`1px solid ${pal.accent}45`,background:pal.dim,color:pal.accent,cursor:"pointer",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:"0.15em"}}>
                    + AGREGAR DOCUMENTO
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length===0&&<div style={{textAlign:"center",padding:"48px 0",color:"#888888",fontSize:12}}>Sin resultados para "{search}"</div>}
      </div>

      {/* Footer */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0A0A0A",borderTop:"1px solid #1a1a1a",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:10,color:"#aaaaaa"}}>DocVault · {owner} · <span style={{color:"#4EADA0"}}>☁ cloud</span></span>
        <span style={{fontSize:10,color:pal.accent}}>● {total} docs</span>
      </div>
    </div>
  );
}
