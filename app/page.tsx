"use client";
import { useState, useEffect, useRef } from "react";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const OWNERS = ["Rolo", "Claudia", "Castle"] as const;
type Owner = typeof OWNERS[number];

const CATEGORIES_PERSONAL = [
  { id: "identidad",   icon: "◈", label: "Identidad",         sub: "INE · Pasaporte · CURP · Acta" },
  { id: "fiscal",      icon: "◉", label: "Fiscal & IMSS",     sub: "RFC · SAT · NSS · IMSS" },
  { id: "profesional", icon: "◆", label: "Profesional",       sub: "Cédula · Título · Diplomas" },
  { id: "domicilio",   icon: "◫", label: "Domicilio",         sub: "CFE · Agua · Teléfono" },
  { id: "vehicular",   icon: "◳", label: "Vehicular",         sub: "Licencia · Factura · Seguro" },
  { id: "civil",       icon: "◑", label: "Estado Civil",      sub: "Matrimonio · Divorcio" },
  { id: "inmuebles",   icon: "◰", label: "Inmuebles",         sub: "Escrituras · Fideicomiso · Predial" },
  { id: "legal",       icon: "◮", label: "Legal & Sucesorio", sub: "Poderes · Testamento · Contratos" },
  { id: "salud",       icon: "◍", label: "Salud & Seguro",    sub: "INAPAM · Médico · Expediente" },
  { id: "financiero",  icon: "◎", label: "Financiero",        sub: "Cuentas · Estados · Inversiones" },
  { id: "migratorio",  icon: "◐", label: "Migratorio",        sub: "Visa · Residente · FM3" },
  { id: "apps",        icon: "◉", label: "Apps",              sub: "Contraseñas · PWA Builder · Cuentas" },
  { id: "otros",       icon: "◯", label: "Otros",             sub: "Varios · Misceláneos" },
];

const CATEGORIES_CASTLE = [
  { id: "constitucion",  icon: "◈", label: "Constitución",      sub: "Acta · Estatutos · Modificaciones" },
  { id: "fiscal_emp",    icon: "◉", label: "Fiscal",            sub: "RFC · SAT · Declaraciones" },
  { id: "imss_emp",      icon: "◆", label: "IMSS & Nómina",     sub: "Patronal · Altas/Bajas" },
  { id: "permisos",      icon: "◫", label: "Permisos",          sub: "Uso suelo · Operación · Turismo" },
  { id: "contratos",     icon: "◳", label: "Contratos",         sub: "Arrendamiento · Servicios" },
  { id: "bancario",      icon: "◑", label: "Bancario",          sub: "Cuentas · Estados · Tarjetas" },
  { id: "inmuebles_emp", icon: "◰", label: "Inmuebles",         sub: "Propiedades · Rentas" },
  { id: "poderes",       icon: "◮", label: "Poderes & Legal",   sub: "Notariales · Representantes" },
  { id: "plataformas",   icon: "◍", label: "Plataformas",       sub: "Airbnb · VRBO · Booking" },
  { id: "seguros",       icon: "◎", label: "Seguros",           sub: "Pólizas · Responsabilidad" },
  { id: "contabilidad",  icon: "◐", label: "Contabilidad",      sub: "Balances · Estados · Auditorías" },
  { id: "otros_emp",     icon: "◯", label: "Otros",             sub: "Corporativos varios" },
];

// Paleta LUMINOSA — papel crema, tinta cálida, acentos vivos pero sofisticados
const PAL: Record<Owner,{accent:string;light:string;tint:string;ink:string;emoji:string}> = {
  Rolo:    { accent: "#B8864A", light: "#D9B27F", tint: "#F5EBD7", ink: "#5C3E1A", emoji: "🌊" },
  Claudia: { accent: "#8B5FA8", light: "#B592CC", tint: "#EFE4F5", ink: "#3F2454", emoji: "🏇" },
  Castle:  { accent: "#2D8F7A", light: "#6EBFA8", tint: "#DDF0EA", ink: "#164A3E", emoji: "🏛" },
};

// ─── CRYPTO ──────────────────────────────────────────────────────────────────
const ITERATIONS = 310000;
const SALT_LEN = 32;
const IV_LEN   = 12;

function genSalt() {
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
async function encrypt(data: unknown, key: CryptoKey) {
  const enc = new TextEncoder();
  const iv  = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const ct  = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, enc.encode(JSON.stringify(data)));
  const combined = new Uint8Array(iv.length + ct.byteLength);
  combined.set(iv); combined.set(new Uint8Array(ct), iv.length);
  return btoa(String.fromCharCode(...combined));
}
async function decrypt(b64: string, key: CryptoKey) {
  const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LEN);
  const ct = combined.slice(IV_LEN);
  const pt = await crypto.subtle.decrypt({ name:"AES-GCM", iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}
async function hashPwd(pwd: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pwd + "_docvault_v1"));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// ─── SUPABASE (REST directo) ─────────────────────────────────────────────────
async function sbUpload(vaultId: string, catId: string, file: File): Promise<string> {
  const ext = file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")) : "";
  const uid = crypto.randomUUID();
  const path = `${vaultId}/${catId}/${uid}${ext}`;
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/docvault-files/${path}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON,
      "Authorization": `Bearer ${SUPABASE_ANON}`,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });
  if (!r.ok) throw new Error(`Upload failed: ${r.status}`);
  return path;
}
async function sbSignedUrl(path: string): Promise<string> {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/docvault-files/${path}`, {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  if (!r.ok) throw new Error(`Sign failed: ${r.status}`);
  const d = await r.json();
  return `${SUPABASE_URL}/storage/v1${d.signedURL}`;
}
async function sbDeleteObj(path: string) {
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

// ─── TIPOS ───────────────────────────────────────────────────────────────────
type DocFile = {
  id: string;
  name: string;
  path: string;
  size: number;
  mime: string;
  notes: string;
  uploaded: number;
};
type VaultData = Record<string, DocFile[]>;

// ─── COMPONENTE ──────────────────────────────────────────────────────────────
export default function DocVault() {
  const [screen, setScreen] = useState<"login"|"app">("login");
  const [owner, setOwner]   = useState<Owner>("Rolo");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  // Un solo estado por owner — simple
  const [vaultData, setVaultData] = useState<Record<Owner, VaultData>>({ Rolo:{}, Claudia:{}, Castle:{} });
  const [vaultId, setVaultId] = useState<Record<Owner, string>>({ Rolo:"", Claudia:"", Castle:"" });
  const [vaultKey, setVaultKey] = useState<Record<Owner, CryptoKey|null>>({ Rolo:null, Claudia:null, Castle:null });
  const [vaultSalt, setVaultSalt] = useState<Record<Owner, string>>({ Rolo:"", Claudia:"", Castle:"" });

  // Estados de UI — dos únicos flags
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState<Set<string>>(new Set());

  const [openCat, setOpenCat] = useState<string|null>(null);
  const [editing, setEditing] = useState<{catId:string;fileId:string}|null>(null);
  const [toast, setToast] = useState<{msg:string;err?:boolean}|null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const pal = PAL[owner];
  const CATEGORIES = owner === "Castle" ? CATEGORIES_CASTLE : CATEGORIES_PERSONAL;

  useEffect(() => {
    const h = (e:any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const showToast = (msg:string, err=false) => {
    setToast({msg, err});
    setTimeout(() => setToast(null), 2800);
  };

  // ─── LOGIN ─────────────────────────────────────────────────────────────────
  const login = async () => {
    if (pinInput.length < 4) { setPinError("Mínimo 4 caracteres"); return; }
    setPinError("");
    setSyncing(true);
    try {
      const vid = await hashPwd(`${owner}_${pinInput}`);
      const row = await sbLoad(vid);
      let key:CryptoKey, salt:string, data:VaultData = {};

      if (row) {
        salt = row.salt;
        key = await deriveKey(pinInput, salt);
        try { data = await decrypt(row.blob, key) as VaultData; }
        catch { setSyncing(false); setPinError("PIN incorrecto"); return; }
      } else {
        salt = genSalt();
        key = await deriveKey(pinInput, salt);
        const blob = await encrypt(data, key);
        await sbSave(vid, blob, salt);
      }

      setVaultId(p => ({...p, [owner]:vid}));
      setVaultKey(p => ({...p, [owner]:key}));
      setVaultSalt(p => ({...p, [owner]:salt}));
      setVaultData(p => ({...p, [owner]:data}));
      setPinInput(""); setScreen("app");
      setSyncing(false);
    } catch(e:any) {
      setSyncing(false);
      setPinError("Error de conexión");
    }
  };

  // ─── PERSIST (único punto que habla con Supabase para metadata) ────────────
  const persistVault = async (newData: VaultData) => {
    const key = vaultKey[owner];
    const salt = vaultSalt[owner];
    const vid = vaultId[owner];
    if (!key || !salt || !vid) throw new Error("Sesión inválida");
    setSyncing(true);
    try {
      const blob = await encrypt(newData, key);
      await sbSave(vid, blob, salt);
    } finally {
      setSyncing(false);
    }
  };

  // ─── UPLOAD FILES ──────────────────────────────────────────────────────────
  const addFiles = async (catId: string, files: File[]) => {
    const vid = vaultId[owner];
    if (!vid) { showToast("Sesión inválida", true); return; }

    const currentCat = vaultData[owner][catId] || [];
    const newFiles: DocFile[] = [];

    // Agregar cada archivo al set de uploading para mostrar spinner
    const pendingIds = files.map(() => crypto.randomUUID());
    setUploading(prev => {
      const next = new Set(prev);
      pendingIds.forEach(id => next.add(id));
      return next;
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempId = pendingIds[i];

      if (file.size > 25 * 1024 * 1024) {
        showToast(`${file.name} supera 25MB`, true);
        setUploading(prev => { const n = new Set(prev); n.delete(tempId); return n; });
        continue;
      }

      try {
        const path = await sbUpload(vid, catId, file);
        const baseName = file.name.replace(/\.[^.]+$/, "");
        newFiles.push({
          id: tempId,
          name: baseName,
          path,
          size: file.size,
          mime: file.type || "application/octet-stream",
          notes: "",
          uploaded: Date.now(),
        });
      } catch(e:any) {
        showToast(`Error: ${file.name}`, true);
      } finally {
        setUploading(prev => { const n = new Set(prev); n.delete(tempId); return n; });
      }
    }

    if (newFiles.length === 0) return;

    // Batch: un solo write al vault con todos los archivos exitosos
    const updated: VaultData = {
      ...vaultData[owner],
      [catId]: [...currentCat, ...newFiles],
    };
    setVaultData(p => ({...p, [owner]:updated}));

    try {
      await persistVault(updated);
      showToast(`${newFiles.length} archivo${newFiles.length>1?"s":""} agregado${newFiles.length>1?"s":""} ✓`);
    } catch {
      showToast("Error al sincronizar", true);
    }
  };

  // ─── RENAME / NOTES / DELETE ───────────────────────────────────────────────
  const updateFile = async (catId: string, fileId: string, patch: Partial<DocFile>) => {
    const cat = vaultData[owner][catId] || [];
    const updated: VaultData = {
      ...vaultData[owner],
      [catId]: cat.map(f => f.id === fileId ? {...f, ...patch} : f),
    };
    setVaultData(p => ({...p, [owner]:updated}));
    try { await persistVault(updated); }
    catch { showToast("Error al sincronizar", true); }
  };

  const deleteFile = async (catId: string, fileId: string) => {
    const cat = vaultData[owner][catId] || [];
    const file = cat.find(f => f.id === fileId);
    if (!file) return;
    if (!confirm(`Eliminar "${file.name}"?`)) return;

    try { await sbDeleteObj(file.path); } catch {}

    const updated: VaultData = {
      ...vaultData[owner],
      [catId]: cat.filter(f => f.id !== fileId),
    };
    setVaultData(p => ({...p, [owner]:updated}));
    setEditing(null);

    try {
      await persistVault(updated);
      showToast("Eliminado");
    } catch { showToast("Error al sincronizar", true); }
  };

  const download = async (file: DocFile) => {
    try {
      const url = await sbSignedUrl(file.path);
      const a = document.createElement("a");
      a.href = url;
      const ext = file.mime === "application/pdf" ? ".pdf" : "";
      a.download = file.name + ext;
      a.target = "_blank";
      a.click();
    } catch { showToast("Error al descargar", true); }
  };

  const shareFile = async (file: DocFile) => {
    try {
      const url = await sbSignedUrl(file.path);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error("Fetch failed");
      const blob = await resp.blob();
      const ext = file.mime === "application/pdf" ? ".pdf"
                : file.mime.startsWith("image/") ? "." + file.mime.split("/")[1].replace("jpeg","jpg")
                : "";
      const fileObj = new File([blob], file.name + ext, { type: file.mime });

      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [fileObj] })) {
        await navigator.share({
          files: [fileObj],
          title: file.name,
          text: file.notes || file.name,
        });
      } else {
        showToast("Compartir no soportado, descargando…");
        download(file);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        showToast("Error al compartir", true);
      }
    }
  };

  const switchOwner = (o: Owner) => {
    if (o === owner) return;
    if (vaultKey[o]) {
      setOwner(o); setOpenCat(null); setEditing(null);
    } else {
      setOwner(o); setScreen("login");
    }
  };

  const logout = () => {
    setVaultData({ Rolo:{}, Claudia:{}, Castle:{} });
    setVaultKey({ Rolo:null, Claudia:null, Castle:null });
    setVaultSalt({ Rolo:"", Claudia:"", Castle:"" });
    setVaultId({ Rolo:"", Claudia:"", Castle:"" });
    setScreen("login");
    setOwner("Rolo");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // PANTALLA LOGIN
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === "login") {
    return (
      <div style={S.page}>
        <div style={S.loginWrap}>
          <div style={S.brand}>
            <div style={{fontSize:11,letterSpacing:"0.3em",color:"#9a8570",fontWeight:700}}>BÓVEDA PERSONAL</div>
            <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:38,color:"#2a2215",marginTop:6,fontStyle:"italic"}}>DocVault</div>
          </div>

          <div style={S.ownerRow}>
            {OWNERS.map(o => {
              const p = PAL[o];
              const active = o === owner;
              return (
                <button key={o} onClick={() => setOwner(o)}
                  style={{
                    ...S.ownerBtn,
                    background: active ? p.tint : "#ffffff",
                    borderColor: active ? p.accent : "#e8dfd0",
                    boxShadow: active ? `0 4px 12px ${p.accent}33` : "0 1px 3px #00000010",
                    transform: active ? "translateY(-2px)" : "none",
                  }}>
                  <div style={{fontSize:28}}>{p.emoji}</div>
                  <div style={{fontSize:11,letterSpacing:"0.15em",color:active?p.ink:"#8a7a65",fontWeight:700,marginTop:4}}>{o.toUpperCase()}</div>
                </button>
              );
            })}
          </div>

          <div style={{...S.card, borderColor: pal.light}}>
            <div style={{fontSize:10,letterSpacing:"0.25em",color:pal.ink,fontWeight:700,marginBottom:10}}>
              PIN DE {owner.toUpperCase()}
            </div>
            <input
              type="password"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && login()}
              placeholder="••••"
              autoFocus
              style={{
                ...S.pinInput,
                borderColor: pal.light,
                color: pal.ink,
              }}/>
            {pinError && <div style={S.err}>{pinError}</div>}
            <button onClick={login} disabled={syncing}
              style={{
                ...S.primaryBtn,
                background: `linear-gradient(135deg, ${pal.accent}, ${pal.light})`,
                opacity: syncing ? 0.6 : 1,
                cursor: syncing ? "wait" : "pointer",
              }}>
              {syncing ? "ABRIENDO…" : "ABRIR BÓVEDA"}
            </button>
            <div style={{fontSize:10,color:"#a89680",marginTop:14,textAlign:"center",fontStyle:"italic"}}>
              Primera vez → tu PIN crea la bóveda
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PANTALLA APP
  // ─────────────────────────────────────────────────────────────────────────
  const total = Object.values(vaultData[owner]).reduce((n, arr) => n + arr.length, 0);

  return (
    <div style={S.page}>
      {/* HEADER */}
      <div style={{...S.header, background: `linear-gradient(180deg, ${pal.tint} 0%, #FBF7EF 100%)`, borderBottom:`1px solid ${pal.light}44`}}>
        <div style={S.headerInner}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:10,letterSpacing:"0.3em",color:pal.ink,fontWeight:700}}>BÓVEDA · {owner.toUpperCase()}</div>
              <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:28,color:"#2a2215",fontStyle:"italic",marginTop:2}}>DocVault</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
              <div style={{fontSize:11,color:pal.ink,fontWeight:600}}>{total} doc{total!==1?"s":""}</div>
              {syncing && <div style={{fontSize:9,color:pal.accent,letterSpacing:"0.15em",fontWeight:600}}>SINCRONIZANDO…</div>}
              {installPrompt && (
                <button onClick={async () => {
                  installPrompt.prompt();
                  const {outcome} = await installPrompt.userChoice;
                  if (outcome === "accepted") setInstallPrompt(null);
                }} style={{...S.chip, borderColor: pal.accent, color: pal.ink, background:"#fff"}}>
                  ⬇ Instalar
                </button>
              )}
            </div>
          </div>

          {/* Owner switcher en cápsulas */}
          <div style={{display:"flex",gap:8,marginTop:18,justifyContent:"center"}}>
            {OWNERS.map(o => {
              const p = PAL[o];
              const active = o === owner;
              return (
                <button key={o} onClick={() => switchOwner(o)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1.5px solid ${active ? p.accent : "#e8dfd0"}`,
                    background: active ? p.tint : "#fff",
                    color: active ? p.ink : "#8a7a65",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    cursor: "pointer",
                    display:"flex",
                    alignItems:"center",
                    gap:6,
                  }}>
                  <span style={{fontSize:14}}>{p.emoji}</span>
                  <span>{o.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CATEGORÍAS */}
      <div style={S.content}>
        {CATEGORIES.map(cat => {
          const files = vaultData[owner][cat.id] || [];
          const isOpen = openCat === cat.id;
          return (
            <CategorySection
              key={cat.id}
              cat={cat}
              files={files}
              isOpen={isOpen}
              pal={pal}
              uploading={uploading}
              onToggle={() => setOpenCat(isOpen ? null : cat.id)}
              onAddFiles={(fs) => addFiles(cat.id, fs)}
              onEdit={(fid) => setEditing({catId: cat.id, fileId: fid})}
              onDownload={download}
            />
          );
        })}

        <div style={{textAlign:"center",padding:"28px 0 12px",color:"#a89680",fontSize:10,letterSpacing:"0.2em",fontWeight:600}}>
          🔒 CIFRADO EXTREMO · {total} ARCHIVO{total!==1?"S":""}
        </div>
        <div style={{textAlign:"center",paddingBottom:40}}>
          <button onClick={logout} style={{...S.chip, borderColor:"#d4c5a8", color:"#8a7a65", background:"#fff"}}>
            CERRAR BÓVEDA
          </button>
        </div>
      </div>

      {/* EDIT SHEET */}
      {editing && (() => {
        const file = (vaultData[owner][editing.catId] || []).find(f => f.id === editing.fileId);
        if (!file) return null;
        return (
          <EditSheet
            file={file}
            pal={pal}
            onClose={() => setEditing(null)}
            onRename={(name) => updateFile(editing.catId, editing.fileId, {name})}
            onNotes={(notes) => updateFile(editing.catId, editing.fileId, {notes})}
            onDownload={() => download(file)}
            onShare={() => shareFile(file)}
            onDelete={() => deleteFile(editing.catId, editing.fileId)}
          />
        );
      })()}

      {/* TOAST */}
      {toast && (
        <div style={{
          position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)",
          padding:"12px 20px", borderRadius:12,
          background: toast.err ? "#c2473f" : "#2a2215",
          color:"#fff", fontSize:13, fontWeight:600, letterSpacing:"0.05em",
          boxShadow:"0 8px 24px #00000040", zIndex:1000,
        }}>
          {toast.msg}
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ─── CATEGORY SECTION ──────────────────────────────────────────────────────
function CategorySection({cat, files, isOpen, pal, uploading, onToggle, onAddFiles, onEdit, onDownload}:{
  cat: {id:string;icon:string;label:string;sub:string};
  files: DocFile[];
  isOpen: boolean;
  pal: typeof PAL[Owner];
  uploading: Set<string>;
  onToggle: () => void;
  onAddFiles: (files: File[]) => void;
  onEdit: (fileId: string) => void;
  onDownload: (f: DocFile) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef  = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      onAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div style={{
      marginBottom: 12,
      borderRadius: 14,
      overflow:"hidden",
      border: `1px solid ${isOpen ? pal.light : "#e8dfd0"}`,
      background: "#ffffff",
      boxShadow: isOpen ? `0 4px 16px ${pal.accent}22` : "0 1px 3px #00000008",
      transition: "all 0.2s ease",
    }}>
      {/* Header de categoría */}
      <button onClick={onToggle} style={{
        width:"100%",
        padding: "14px 16px",
        background: isOpen ? pal.tint : "#ffffff",
        border:"none",
        cursor:"pointer",
        display:"flex",
        alignItems:"center",
        gap:12,
        textAlign:"left",
      }}>
        <div style={{
          width:38, height:38, borderRadius:10,
          background: pal.tint,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:18, color: pal.accent,
          border: `1px solid ${pal.light}`,
        }}>{cat.icon}</div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:16,color:"#2a2215",fontWeight:700}}>{cat.label}</div>
          <div style={{fontSize:11,color:"#8a7a65",marginTop:2}}>{cat.sub}</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
          <div style={{
            background: files.length > 0 ? pal.accent : "#e8dfd0",
            color: files.length > 0 ? "#fff" : "#8a7a65",
            fontSize:11, fontWeight:700, letterSpacing:"0.05em",
            padding:"3px 9px", borderRadius:999, minWidth:24, textAlign:"center",
          }}>{files.length}</div>
          <div style={{fontSize:14,color:pal.accent,marginTop:2}}>{isOpen ? "−" : "+"}</div>
        </div>
      </button>

      {/* Contenido expandido */}
      {isOpen && (
        <div style={{padding:"4px 12px 14px", background:"#fbf8f2"}}>
          {/* Lista de archivos */}
          {files.length > 0 && (
            <div style={{marginBottom:10}}>
              {files.map(f => (
                <FileRow key={f.id} file={f} pal={pal} uploading={uploading.has(f.id)}
                  onEdit={() => onEdit(f.id)} onDownload={() => onDownload(f)} />
              ))}
            </div>
          )}

          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? pal.accent : pal.light}`,
              borderRadius: 12,
              padding: "22px 16px",
              background: dragOver ? pal.tint : "#ffffff",
              textAlign:"center",
              transition:"all 0.15s ease",
            }}>
            <div style={{fontSize:22,color:pal.accent,marginBottom:6}}>⇪</div>
            <div style={{fontSize:13,color:pal.ink,fontWeight:700,letterSpacing:"0.05em",marginBottom:3}}>
              Arrastra archivos aquí
            </div>
            <div style={{fontSize:11,color:"#8a7a65",marginBottom:12}}>
              o usa los botones de abajo
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
              <button onClick={() => fileRef.current?.click()} style={{
                padding:"8px 14px", borderRadius:8,
                border:`1px solid ${pal.light}`,
                background:"#fff", color: pal.ink,
                fontSize:11, fontWeight:700, letterSpacing:"0.1em",
                cursor:"pointer",
              }}>📎 ARCHIVO</button>
              <button onClick={() => camRef.current?.click()} style={{
                padding:"8px 14px", borderRadius:8,
                border:`1px solid ${pal.light}`,
                background:"#fff", color: pal.ink,
                fontSize:11, fontWeight:700, letterSpacing:"0.1em",
                cursor:"pointer",
              }}>📷 CÁMARA</button>
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
              style={{display:"none"}}
              onChange={(e) => {
                if (!e.target.files) return;
                onAddFiles(Array.from(e.target.files));
                e.target.value = "";
              }}/>
            <input ref={camRef} type="file" accept="image/*" capture="environment"
              style={{display:"none"}}
              onChange={(e) => {
                if (!e.target.files) return;
                onAddFiles(Array.from(e.target.files));
                e.target.value = "";
              }}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FILE ROW ──────────────────────────────────────────────────────────────
function FileRow({file, pal, uploading, onEdit, onDownload}:{
  file: DocFile;
  pal: typeof PAL[Owner];
  uploading: boolean;
  onEdit: () => void;
  onDownload: () => void;
}) {
  const icon = file.mime === "application/pdf" ? "📄" : file.mime.startsWith("image/") ? "🖼" : "📎";
  const kb = file.size < 1024*1024 ? `${(file.size/1024).toFixed(0)} KB` : `${(file.size/1024/1024).toFixed(1)} MB`;

  return (
    <div style={{
      display:"flex",
      alignItems:"center",
      gap:10,
      padding:"10px 12px",
      background:"#fff",
      borderRadius:10,
      border:"1px solid #f0e9dc",
      marginBottom:6,
      animation:"fadeIn 0.2s ease",
    }}>
      <div style={{fontSize:18}}>{icon}</div>
      <div style={{flex:1, minWidth:0, cursor:"pointer"}} onClick={onEdit}>
        <div style={{
          fontSize:13, color:"#2a2215", fontWeight:600,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
        }}>{file.name}</div>
        <div style={{fontSize:10,color:"#a89680",marginTop:2,letterSpacing:"0.05em"}}>
          {kb} · {file.notes ? "📝 " + file.notes.substring(0,30) + (file.notes.length>30?"…":"") : "sin notas"}
        </div>
      </div>
      {uploading ? (
        <div style={{fontSize:11,color:pal.accent,fontWeight:700,letterSpacing:"0.05em"}}>
          <span style={{display:"inline-block",animation:"spin 0.8s linear infinite"}}>⟳</span>
        </div>
      ) : (
        <button onClick={onDownload} style={{
          padding:"6px 10px", borderRadius:8,
          border:`1px solid ${pal.light}`,
          background: pal.tint, color: pal.ink,
          fontSize:10, fontWeight:700, letterSpacing:"0.08em",
          cursor:"pointer",
        }}>⬇</button>
      )}
    </div>
  );
}

// ─── EDIT SHEET ────────────────────────────────────────────────────────────
function EditSheet({file, pal, onClose, onRename, onNotes, onDownload, onShare, onDelete}:{
  file: DocFile;
  pal: typeof PAL[Owner];
  onClose: () => void;
  onRename: (name: string) => void;
  onNotes: (notes: string) => void;
  onDownload: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(file.name);
  const [notes, setNotes] = useState(file.notes);
  const nameTimer = useRef<any>(null);
  const notesTimer = useRef<any>(null);

  useEffect(() => { setName(file.name); setNotes(file.notes); }, [file.id]);

  const saveName = (v: string) => {
    setName(v);
    if (nameTimer.current) clearTimeout(nameTimer.current);
    nameTimer.current = setTimeout(() => {
      if (v.trim() && v.trim() !== file.name) onRename(v.trim());
    }, 500);
  };
  const saveNotes = (v: string) => {
    setNotes(v);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      if (v !== file.notes) onNotes(v);
    }, 500);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position:"fixed", inset:0,
        background:"#2a221580", zIndex:500,
        display:"flex", alignItems:"flex-end", justifyContent:"center",
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width:"100%", maxWidth:600,
          background:"#FDFAF3",
          borderRadius:"20px 20px 0 0",
          padding:"16px 20px 24px",
          animation:"slideUp 0.25s ease",
          boxShadow:"0 -8px 24px #00000020",
        }}>
        <div style={{width:40, height:4, background:"#d4c5a8", borderRadius:2, margin:"0 auto 14px"}}/>

        <div style={{fontSize:10,letterSpacing:"0.25em",color:pal.ink,fontWeight:700,marginBottom:4}}>
          EDITAR ARCHIVO
        </div>

        <input
          value={name}
          onChange={(e) => saveName(e.target.value)}
          placeholder="Nombre del archivo"
          style={{
            width:"100%", padding:"10px 12px",
            border:`1px solid ${pal.light}`,
            borderRadius:10,
            fontSize:16,
            fontFamily:"'Libre Baskerville',serif",
            color:"#2a2215",
            background:"#fff",
            marginBottom:12,
            boxSizing:"border-box",
          }}/>

        <div style={{fontSize:10,letterSpacing:"0.2em",color:"#8a7a65",fontWeight:700,marginBottom:6}}>
          NOTAS
        </div>
        <textarea
          value={notes}
          onChange={(e) => saveNotes(e.target.value)}
          placeholder="Detalles, vigencia, número de folio…"
          rows={4}
          style={{
            width:"100%", padding:"10px 12px",
            border:`1px solid ${pal.light}`,
            borderRadius:10,
            fontSize:13,
            color:"#2a2215",
            background:"#fff",
            fontFamily:"inherit",
            resize:"none",
            boxSizing:"border-box",
            marginBottom:14,
          }}/>

        <div style={{fontSize:10,color:"#a89680",marginBottom:12,letterSpacing:"0.05em"}}>
          {(file.size/1024).toFixed(0)} KB · {file.mime} · {new Date(file.uploaded).toLocaleDateString("es-MX")}
        </div>

        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={onShare} style={{
            flex:"1 1 calc(50% - 4px)", padding:"12px 0", borderRadius:10,
            border:"none",
            background:`linear-gradient(135deg, ${pal.accent}, ${pal.light})`,
            color:"#fff", fontSize:12, fontWeight:700, letterSpacing:"0.1em",
            cursor:"pointer",
          }}>↗ COMPARTIR</button>
          <button onClick={onDownload} style={{
            flex:"1 1 calc(50% - 4px)", padding:"12px 0", borderRadius:10,
            border:`1px solid ${pal.light}`,
            background: pal.tint, color: pal.ink,
            fontSize:12, fontWeight:700, letterSpacing:"0.1em",
            cursor:"pointer",
          }}>⬇ DESCARGAR</button>
          <button onClick={onDelete} style={{
            flex:"0 0 auto", padding:"12px 16px", borderRadius:10,
            border:"1px solid #d4a8a8",
            background:"#fff", color:"#a84747",
            fontSize:12, fontWeight:700, letterSpacing:"0.1em",
            cursor:"pointer",
          }}>🗑</button>
          <button onClick={onClose} style={{
            flex:"1 1 auto", padding:"12px 16px", borderRadius:10,
            border:"1px solid #d4c5a8",
            background:"#fff", color:"#8a7a65",
            fontSize:12, fontWeight:700, letterSpacing:"0.1em",
            cursor:"pointer",
          }}>CERRAR</button>
        </div>
      </div>
    </div>
  );
}

// ─── ESTILOS ───────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight:"100vh",
    background:"#FBF7EF",
    fontFamily:"system-ui, -apple-system, sans-serif",
    color:"#2a2215",
  },
  loginWrap: {
    maxWidth:420, margin:"0 auto", padding:"60px 20px 40px",
  },
  brand: {
    textAlign:"center", marginBottom:30,
  },
  ownerRow: {
    display:"flex", gap:10, marginBottom:22, justifyContent:"center",
  },
  ownerBtn: {
    flex:1, maxWidth:110,
    padding:"14px 8px",
    border:"2px solid",
    borderRadius:14,
    cursor:"pointer",
    transition:"all 0.2s ease",
  },
  card: {
    background:"#fff",
    border:"1px solid",
    borderRadius:16,
    padding:"22px 20px",
    boxShadow:"0 4px 16px #00000010",
  },
  pinInput: {
    width:"100%", padding:"12px 14px",
    border:"1.5px solid",
    borderRadius:10,
    fontSize:22,
    textAlign:"center",
    letterSpacing:"0.5em",
    background:"#fbf7ef",
    boxSizing:"border-box",
    fontFamily:"'Space Mono',monospace",
    outline:"none",
  },
  err: {
    fontSize:11, color:"#c2473f", textAlign:"center",
    marginTop:8, letterSpacing:"0.05em", fontWeight:600,
  },
  primaryBtn: {
    width:"100%", padding:"13px 0",
    border:"none", borderRadius:10,
    color:"#fff", fontSize:12, fontWeight:700,
    letterSpacing:"0.2em",
    cursor:"pointer",
    marginTop:14,
  },
  header: {
    position:"sticky", top:0, zIndex:100,
  },
  headerInner: {
    maxWidth:600, margin:"0 auto", padding:"18px 16px",
  },
  chip: {
    padding:"5px 11px",
    borderRadius:999,
    border:"1px solid",
    fontSize:10,
    fontWeight:700,
    letterSpacing:"0.1em",
    cursor:"pointer",
  },
  content: {
    maxWidth:600, margin:"0 auto", padding:"16px 14px 0",
  },
};
