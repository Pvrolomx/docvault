"use client";
import { useState, useEffect, useRef } from "react";

const OWNERS = ["Rolo", "Claudia"];

const CATEGORIES = [
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

const DOC_TYPES = ["Original","Copia simple","Copia certificada","Digital oficial","Apostillada","Traducida","Vigente","Vencida","Histórico"];

const PAL = {
  Rolo:    { accent: "#C8A96E", dim: "#C8A96E22", mid: "#C8A96E44", dot: "#C8A96E" },
  Claudia: { accent: "#9B7BB8", dim: "#9B7BB822", mid: "#9B7BB844", dot: "#9B7BB8" },
};

const skey = (o: string, cat: string) => `dv:${o.toLowerCase()}:${cat}`;

type Doc = { id: string; name: string; type: string; notes: string; date: string; expires: string; created: number; updated?: number };
type AllDocs = Record<string, Record<string, Doc[]>>;

export default function DocVault() {
  const [owner, setOwner]       = useState("Rolo");
  const [docs, setDocs]         = useState<AllDocs>({});
  const [openCat, setOpenCat]   = useState<string | null>(null);
  const [modal, setModal]       = useState<{ cat: string; doc?: Doc } | null>(null);
  const [form, setForm]         = useState({ name: "", type: "Original", notes: "", date: "", expires: "" });
  const [search, setSearch]     = useState("");
  const [loaded, setLoaded]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState<{ msg: string; err?: boolean } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // PWA install prompt capture
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => { setInstalled(true); setInstallPrompt(null); });
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Load from localStorage
  useEffect(() => {
    const all: AllDocs = {};
    for (const o of OWNERS) {
      all[o] = {};
      for (const cat of CATEGORIES) {
        try { all[o][cat.id] = JSON.parse(localStorage.getItem(skey(o, cat.id)) || "[]"); }
        catch { all[o][cat.id] = []; }
      }
    }
    setDocs(all);
    setLoaded(true);
  }, []);

  const showToast = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 2200);
  };

  const saveCategory = (o: string, catId: string, list: Doc[]) => {
    setSaving(true);
    try {
      localStorage.setItem(skey(o, catId), JSON.stringify(list));
      setDocs(prev => ({ ...prev, [o]: { ...prev[o], [catId]: list } }));
    } catch { showToast("Error al guardar", true); }
    setSaving(false);
  };

  const openAdd = (catId: string) => {
    setModal({ cat: catId });
    setForm({ name: "", type: "Original", notes: "", date: "", expires: "" });
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const openEdit = (catId: string, doc: Doc) => {
    setModal({ cat: catId, doc });
    setForm({ name: doc.name, type: doc.type, notes: doc.notes, date: doc.date, expires: doc.expires });
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const submitDoc = () => {
    if (!form.name.trim() || !modal) return;
    const catId = modal.cat;
    const current = docs[owner]?.[catId] || [];
    let updated: Doc[];
    if (modal.doc) {
      updated = current.map(d => d.id === modal.doc!.id ? { ...d, ...form, updated: Date.now() } : d);
      showToast("Documento actualizado ✓");
    } else {
      updated = [...current, { id: `${catId}-${Date.now()}`, ...form, created: Date.now() }];
      showToast("Guardado ✓");
    }
    saveCategory(owner, catId, updated);
    setModal(null);
  };

  const deleteDoc = (catId: string, docId: string) => {
    const updated = (docs[owner]?.[catId] || []).filter(d => d.id !== docId);
    saveCategory(owner, catId, updated);
    showToast("Eliminado", true);
  };

  const installApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") { setInstalled(true); setInstallPrompt(null); }
  };

  const pal = PAL[owner as keyof typeof PAL];
  const ownerDocs = docs[owner] || {};
  const totalDocs = Object.values(ownerDocs).reduce((s, a) => s + (a?.length || 0), 0);

  const filtered = search.trim()
    ? CATEGORIES.filter(cat =>
        cat.label.toLowerCase().includes(search.toLowerCase()) ||
        (ownerDocs[cat.id] || []).some(d => d.name.toLowerCase().includes(search.toLowerCase()))
      )
    : CATEGORIES;

  const isExpired  = (d: Doc) => d.expires && new Date(d.expires) < new Date();
  const isExpiring = (d: Doc) => {
    if (!d.expires || isExpired(d)) return false;
    return (new Date(d.expires).getTime() - Date.now()) / 86400000 < 60;
  };

  if (!loaded) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0D0D0D" }}>
      <div style={{ color: "#555", fontSize: 12, letterSpacing: "0.2em" }}>CARGANDO BÓVEDA…</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", color: "#E5E0D8", fontFamily: "'Space Mono', monospace" }}>
      <style>{`
        .slide-in { animation: sli 0.2s ease forwards; }
        @keyframes sli { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        .toast-anim { animation: tin 0.2s ease, tout 0.3s ease 1.9s forwards; }
        @keyframes tin { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tout { from{opacity:1} to{opacity:0} }
        .doc-row:hover { transform: translateX(3px); transition: transform 0.15s; }
        input, textarea, select {
          background: #1A1A1A !important; border: 1px solid #2A2A2A !important;
          color: #E5E0D8 !important; border-radius: 4px; padding: 8px 10px;
          font-family: 'Space Mono', monospace; font-size: 13px; outline: none; width: 100%;
        }
        input:focus, textarea:focus, select:focus { border-color: var(--acc) !important; }
        select option { background: #1A1A1A; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className="toast-anim" style={{
          position: "fixed", bottom: 72, left: "50%", transform: "translateX(-50%)",
          zIndex: 60, padding: "10px 20px", borderRadius: 6, fontSize: 12, letterSpacing: "0.08em",
          background: toast.err ? "#2d0a0a" : "#1a1a1a",
          border: `1px solid ${toast.err ? "#7f1d1d" : "#333"}`,
          color: toast.err ? "#fca5a5" : "#d4d4d4"
        }}>{toast.msg}</div>
      )}

      {/* Modal */}
      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="slide-in" style={{
            width: "100%", maxWidth: 440, margin: "0 16px", borderRadius: 10,
            border: `1px solid ${pal.accent}55`, background: "#111", padding: 24,
            ["--acc" as any]: pal.accent
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, letterSpacing: "0.2em", color: pal.accent, marginBottom: 4 }}>
                  {modal.doc ? "EDITAR DOCUMENTO" : "NUEVO DOCUMENTO"}
                </div>
                <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 18, color: "#e5e0d8" }}>
                  {CATEGORIES.find(c => c.id === modal.cat)?.label}
                </div>
              </div>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", color: "#555", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", marginBottom: 4 }}>NOMBRE DEL DOCUMENTO *</div>
                <input ref={inputRef} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ej. INE vigente 2025, Licencia caducada..." onKeyDown={e => e.key === "Enter" && submitDoc()} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", marginBottom: 4 }}>TIPO</div>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", marginBottom: 4 }}>FECHA DOC.</div>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", marginBottom: 4 }}>VENCIMIENTO</div>
                <input type="date" value={form.expires} onChange={e => setForm(f => ({ ...f, expires: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.15em", marginBottom: 4 }}>NOTAS</div>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Folio, observaciones, dónde está físicamente..." rows={2} style={{ resize: "none" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={submitDoc} style={{
                flex: 1, padding: "10px 0", borderRadius: 5, border: "none", cursor: "pointer",
                background: pal.accent, color: "#0D0D0D", fontSize: 11, fontFamily: "'Space Mono', monospace",
                fontWeight: 700, letterSpacing: "0.15em"
              }}>{saving ? "GUARDANDO…" : modal.doc ? "ACTUALIZAR" : "GUARDAR"}</button>
              <button onClick={() => setModal(null)} style={{
                padding: "10px 16px", borderRadius: 5, border: "1px solid #333", cursor: "pointer",
                background: "transparent", color: "#777", fontSize: 11, fontFamily: "'Space Mono', monospace"
              }}>CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#0A0A0A", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.25em", color: "#444", marginBottom: 4 }}>BÓVEDA PERSONAL</div>
              <div style={{ fontFamily: "'Libre Baskerville', serif", fontSize: 26, color: "#E5E0D8" }}>DocVault</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <div style={{ fontSize: 10, color: "#444" }}>{totalDocs} doc{totalDocs !== 1 ? "s" : ""}</div>
              {/* PWA Install Button */}
              {installPrompt && !installed && (
                <button onClick={installApp} style={{
                  padding: "6px 12px", borderRadius: 5, border: `1px solid ${pal.accent}60`,
                  background: pal.dim, color: pal.accent, fontSize: 10, cursor: "pointer",
                  fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em"
                }}>⬇ Instalar App</button>
              )}
              {saving && <div style={{ fontSize: 10, color: "#444" }}>guardando…</div>}
            </div>
          </div>

          {/* Owner switcher */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {OWNERS.map(o => {
              const p = PAL[o as keyof typeof PAL];
              const cnt = Object.values(docs[o] || {}).reduce((s, a) => s + (a?.length || 0), 0);
              const active = owner === o;
              return (
                <button key={o} onClick={() => { setOwner(o); setOpenCat(null); }} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 6,
                  border: `1px solid ${active ? p.accent + "70" : "#2a2a2a"}`,
                  background: active ? p.dim : "transparent",
                  color: active ? p.accent : "#555", cursor: "pointer",
                  fontFamily: "'Space Mono', monospace", fontSize: 12, letterSpacing: "0.12em", fontWeight: 700,
                  transition: "all 0.2s"
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? p.dot : "#333", display: "inline-block" }} />
                  {o.toUpperCase()}
                  {cnt > 0 && (
                    <span style={{
                      fontSize: 10, padding: "2px 6px", borderRadius: 10,
                      background: active ? p.mid : "#1a1a1a",
                      color: active ? p.accent : "#444"
                    }}>{cnt}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div style={{ marginTop: 12, position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#444", fontSize: 14 }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar categoría o documento…"
              style={{ paddingLeft: 30, background: "#141414 !important" }} />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "12px 16px 80px" }}>
        {filtered.map(cat => {
          const catDocs = ownerDocs[cat.id] || [];
          const isOpen = openCat === cat.id;
          const expiredDocs  = catDocs.filter(d => isExpired(d));
          const expiringDocs = catDocs.filter(d => isExpiring(d));

          return (
            <div key={cat.id} style={{
              marginBottom: 6, borderRadius: 8, overflow: "hidden",
              border: `1px solid ${isOpen ? pal.accent + "45" : "#1e1e1e"}`,
              background: isOpen ? "#111" : "#0D0D0D"
            }}>
              <button onClick={() => setOpenCat(isOpen ? null : cat.id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "13px 14px", background: "transparent", border: "none",
                cursor: "pointer", textAlign: "left"
              }}>
                <span style={{ fontSize: 17, color: isOpen ? pal.accent : "#383838", minWidth: 20 }}>{cat.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, color: isOpen ? "#e5e0d8" : "#666", fontFamily: "'Space Mono', monospace" }}>{cat.label}</span>
                    {catDocs.length > 0 && (
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: pal.dim, color: pal.accent, border: `1px solid ${pal.accent}35` }}>
                        {catDocs.length}
                      </span>
                    )}
                    {expiredDocs.length > 0 && (
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "#2d0a0a", color: "#f87171", border: "1px solid #7f1d1d55" }}>
                        ⚠ {expiredDocs.length} vencido{expiredDocs.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {expiringDocs.length > 0 && expiredDocs.length === 0 && (
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: "#2d1f00", color: "#fbbf24", border: "1px solid #92400e55" }}>
                        por vencer
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#383838", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.sub}</div>
                </div>
                <span style={{ color: "#383838", fontSize: 10, transform: isOpen ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s", display: "inline-block" }}>▶</span>
              </button>

              {isOpen && (
                <div className="slide-in" style={{ padding: "0 14px 14px" }}>
                  <div style={{ borderTop: "1px solid #222", marginBottom: 12 }} />

                  {catDocs.length === 0 && (
                    <div style={{ fontSize: 11, color: "#383838", fontStyle: "italic", textAlign: "center", padding: "8px 0 12px" }}>
                      Sin documentos en esta categoría
                    </div>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: catDocs.length ? 12 : 0 }}>
                    {catDocs.map(doc => {
                      const exp = isExpired(doc);
                      const exp2 = isExpiring(doc);
                      const barColor = exp ? "#ef4444" : exp2 ? "#eab308" : pal.dot;
                      return (
                        <div key={doc.id} className="doc-row" style={{
                          display: "flex", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 6,
                          background: "#141414", border: "1px solid #222", position: "relative"
                        }}>
                          <div style={{ width: 3, borderRadius: 2, background: barColor, alignSelf: "stretch", minHeight: 18, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: "#e5e0d8" }}>{doc.name}</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: pal.dim, color: pal.accent, border: `1px solid ${pal.accent}30` }}>{doc.type}</span>
                              {doc.date && <span style={{ fontSize: 10, color: "#555" }}>📅 {doc.date}</span>}
                              {doc.expires && (
                                <span style={{
                                  fontSize: 10, padding: "2px 8px", borderRadius: 4,
                                  background: exp ? "#2d0a0a" : exp2 ? "#2d1f00" : "#1a1a1a",
                                  color: exp ? "#f87171" : exp2 ? "#fbbf24" : "#555",
                                  border: `1px solid ${exp ? "#7f1d1d55" : exp2 ? "#92400e55" : "#2a2a2a"}`
                                }}>{exp ? "⚠ " : "↺ "}{doc.expires}</span>
                              )}
                            </div>
                            {doc.notes && <div style={{ fontSize: 11, color: "#555", marginTop: 6, fontStyle: "italic", lineHeight: 1.5 }}>{doc.notes}</div>}
                          </div>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            <button onClick={() => openEdit(cat.id, doc)} style={{
                              background: "none", border: "1px solid transparent", borderRadius: 4,
                              color: "#555", cursor: "pointer", padding: "4px 8px", fontSize: 12,
                              fontFamily: "'Space Mono', monospace"
                            }} onMouseEnter={e => (e.currentTarget.style.color = "#ccc")}
                              onMouseLeave={e => (e.currentTarget.style.color = "#555")}>✎</button>
                            <button onClick={() => deleteDoc(cat.id, doc.id)} style={{
                              background: "none", border: "1px solid transparent", borderRadius: 4,
                              color: "#555", cursor: "pointer", padding: "4px 8px", fontSize: 12,
                              fontFamily: "'Space Mono', monospace"
                            }} onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                              onMouseLeave={e => (e.currentTarget.style.color = "#555")}>✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button onClick={() => openAdd(cat.id)} style={{
                    width: "100%", padding: "10px 0", borderRadius: 5,
                    border: `1px solid ${pal.accent}45`, background: pal.dim,
                    color: pal.accent, cursor: "pointer", fontSize: 11,
                    fontFamily: "'Space Mono', monospace", letterSpacing: "0.15em"
                  }}>+ AGREGAR DOCUMENTO</button>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#383838", fontSize: 12 }}>
            Sin resultados para "{search}"
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "#0A0A0A", borderTop: "1px solid #1a1a1a",
        padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <span style={{ fontSize: 10, color: "#383838" }}>DocVault · {owner}</span>
        <span style={{ fontSize: 10, color: pal.accent }}>● {totalDocs} docs</span>
      </div>
    </div>
  );
}
