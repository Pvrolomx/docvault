'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const DOC_TYPES = [
  { id: 'ine', name: 'INE', icon: '🪪', dateType: 'vencimiento' },
  { id: 'rfc', name: 'RFC / Constancia SAT', icon: '📄', dateType: 'emision' },
  { id: 'curp', name: 'CURP', icon: '📋', dateType: null },
  { id: 'comprobante', name: 'Comprobante Domicilio', icon: '🏠', dateType: 'emision' },
  { id: 'acta_nacimiento', name: 'Acta de Nacimiento', icon: '📜', dateType: null },
  { id: 'pasaporte', name: 'Pasaporte', icon: '🛂', dateType: 'vencimiento' },
  { id: 'licencia', name: 'Licencia de Conducir', icon: '🚗', dateType: 'vencimiento' },
  { id: 'acta_matrimonio', name: 'Acta de Matrimonio', icon: '💍', dateType: null },
  { id: 'escrituras', name: 'Escrituras', icon: '🏡', dateType: null, multipage: true },
  { id: 'otro', name: 'Otro Documento', icon: '📎', dateType: null, multipage: true },
]

export default function Boveda() {
  const [perfil, setPerfil] = useState(null)
  const [perfiles, setPerfiles] = useState({ yo: { nombre: 'Yo', docs: {} }, esposa: { nombre: 'Esposa', docs: {} } })
  const [viewDoc, setViewDoc] = useState(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [editingName, setEditingName] = useState(false)
  const [tempName, setTempName] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showDateModal, setShowDateModal] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [uploadTarget, setUploadTarget] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const importInputRef = useRef(null)
  const router = useRouter()

  useEffect(() => {
    const pin = localStorage.getItem('docvault_pin')
    if (!pin) {
      router.push('/')
      return
    }
    const saved = localStorage.getItem('docvault_perfiles')
    if (saved) {
      setPerfiles(JSON.parse(saved))
    }
  }, [router])

  const savePerfiles = (newPerfiles) => {
    setPerfiles(newPerfiles)
    localStorage.setItem('docvault_perfiles', JSON.stringify(newPerfiles))
  }

  const getDocType = (id) => DOC_TYPES.find(d => d.id === id)

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    if (!files.length || !uploadTarget) return

    const docType = getDocType(uploadTarget)
    
    // Si es multipage, procesar todos los archivos
    if (docType?.multipage && files.length > 1) {
      const readers = files.map(file => {
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = (event) => resolve({
            data: event.target.result,
            name: file.name,
            type: file.type
          })
          reader.readAsDataURL(file)
        })
      })
      
      Promise.all(readers).then(results => {
        const newPerfiles = { ...perfiles }
        newPerfiles[perfil].docs[uploadTarget] = {
          pages: results,
          date: new Date().toISOString(),
          specialDate: null
        }
        savePerfiles(newPerfiles)
        setUploadTarget(null)
        setShowUploadModal(false)
      })
      return
    }

    // Single file
    const file = files[0]
    const reader = new FileReader()
    reader.onload = (event) => {
      const fileData = {
        data: event.target.result,
        name: file.name,
        type: file.type
      }
      
      // Si el doc tiene tipo de fecha, mostrar modal
      if (docType?.dateType) {
        setPendingFile(fileData)
        setShowUploadModal(false)
        setShowDateModal(true)
      } else {
        // Guardar directo
        saveDocument(fileData, null)
      }
    }
    reader.readAsDataURL(file)
  }

  const saveDocument = (fileData, specialDate) => {
    const newPerfiles = { ...perfiles }
    const existingDoc = newPerfiles[perfil].docs[uploadTarget]
    const docType = getDocType(uploadTarget)
    
    if (docType?.multipage && existingDoc?.pages) {
      // Agregar a páginas existentes
      existingDoc.pages.push(fileData)
      existingDoc.date = new Date().toISOString()
    } else if (docType?.multipage) {
      // Nueva doc multipage
      newPerfiles[perfil].docs[uploadTarget] = {
        pages: [fileData],
        date: new Date().toISOString(),
        specialDate
      }
    } else {
      // Doc simple
      newPerfiles[perfil].docs[uploadTarget] = {
        ...fileData,
        date: new Date().toISOString(),
        specialDate
      }
    }
    
    savePerfiles(newPerfiles)
    setUploadTarget(null)
    setPendingFile(null)
    setSelectedDate('')
    setShowDateModal(false)
  }

  const handleDateSubmit = () => {
    saveDocument(pendingFile, selectedDate || null)
  }

  const handleSkipDate = () => {
    saveDocument(pendingFile, null)
  }

  const handleUploadClick = (docType) => {
    setUploadTarget(docType)
    setShowUploadModal(true)
  }

  const handleCameraClick = () => {
    cameraInputRef.current?.click()
  }

  const handleGalleryClick = () => {
    galleryInputRef.current?.click()
  }

  const handleDeleteDoc = (docType) => {
    if (confirm('¿Eliminar este documento?')) {
      const newPerfiles = { ...perfiles }
      delete newPerfiles[perfil].docs[docType]
      savePerfiles(newPerfiles)
    }
  }

  const handleDeletePage = (pageIndex) => {
    if (confirm('¿Eliminar esta página?')) {
      const newPerfiles = { ...perfiles }
      const doc = newPerfiles[perfil].docs[viewDoc]
      doc.pages.splice(pageIndex, 1)
      if (doc.pages.length === 0) {
        delete newPerfiles[perfil].docs[viewDoc]
        setViewDoc(null)
      } else {
        setCurrentPage(Math.min(currentPage, doc.pages.length - 1))
      }
      savePerfiles(newPerfiles)
    }
  }

  const handleLogout = () => {
    router.push('/')
  }

  const updateProfileName = () => {
    if (tempName.trim()) {
      const newPerfiles = { ...perfiles }
      newPerfiles[perfil].nombre = tempName.trim()
      savePerfiles(newPerfiles)
    }
    setEditingName(false)
  }

  const handleExport = () => {
    const data = { perfiles, exported: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `docvault-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result)
        if (data.perfiles && confirm('¿Reemplazar todos los documentos?')) {
          savePerfiles(data.perfiles)
          alert('Importado correctamente')
          setShowSyncModal(false)
        }
      } catch { alert('Error al leer archivo') }
    }
    reader.readAsText(file)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const today = new Date()
    const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24))
    return diff
  }

  const getDateBadgeColor = (days) => {
    if (days === null) return null
    if (days < 0) return '#ef4444' // Vencido - rojo
    if (days <= 30) return '#f97316' // Próximo - naranja
    if (days <= 90) return '#eab308' // Advertencia - amarillo
    return '#22c55e' // OK - verde
  }

  // Modal de fecha
  const DateModal = () => {
    const docType = getDocType(uploadTarget)
    const isVencimiento = docType?.dateType === 'vencimiento'
    
    return (
      <div style={styles.modalOverlay} onClick={handleSkipDate}>
        <div style={styles.modal} onClick={e => e.stopPropagation()}>
          <h3 style={styles.modalTitle}>
            {isVencimiento ? '📅 Fecha de Vencimiento' : '📅 Fecha de Emisión'}
          </h3>
          <p style={styles.modalDesc}>
            {isVencimiento 
              ? 'Ingresa cuándo vence este documento'
              : 'Ingresa cuándo se emitió este documento'}
          </p>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={styles.dateInput}
          />
          <div style={styles.modalOptions}>
            <button style={styles.modalBtnPrimary} onClick={handleDateSubmit}>
              Guardar
            </button>
            <button style={styles.modalCancel} onClick={handleSkipDate}>
              Omitir
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Modal upload
  const UploadModal = () => {
    const docType = getDocType(uploadTarget)
    return (
      <div style={styles.modalOverlay} onClick={() => setShowUploadModal(false)}>
        <div style={styles.modal} onClick={e => e.stopPropagation()}>
          <h3 style={styles.modalTitle}>Agregar documento</h3>
          {docType?.multipage && (
            <p style={styles.modalDesc}>Puedes seleccionar múltiples imágenes</p>
          )}
          <div style={styles.modalOptions}>
            <button style={styles.modalBtn} onClick={handleCameraClick}>
              <span style={styles.modalIcon}>📷</span>
              <span>Cámara</span>
            </button>
            <button style={styles.modalBtn} onClick={handleGalleryClick}>
              <span style={styles.modalIcon}>🖼️</span>
              <span>Imagen / Documento</span>
            </button>
          </div>
          <button style={styles.modalCancel} onClick={() => setShowUploadModal(false)}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // Modal Sync
  const SyncModal = () => (
    <div style={styles.modalOverlay} onClick={() => setShowSyncModal(false)}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>Sincronizar</h3>
        <div style={styles.modalOptions}>
          <button style={styles.modalBtn} onClick={handleExport}>
            <span style={styles.modalIcon}>📤</span>
            <span>Exportar</span>
          </button>
          <button style={styles.modalBtn} onClick={() => importInputRef.current?.click()}>
            <span style={styles.modalIcon}>📥</span>
            <span>Importar</span>
          </button>
        </div>
        <button style={styles.modalCancel} onClick={() => setShowSyncModal(false)}>Cancelar</button>
      </div>
    </div>
  )

  // Selección de perfil
  if (!perfil) {
    return (
      <div style={styles.container}>
        <h1 style={styles.mainTitle}>🔐 DocVault</h1>
        <p style={styles.selectText}>Selecciona un perfil</p>
        <div style={styles.profileGrid}>
          <button style={styles.profileCard} onClick={() => setPerfil('yo')}>
            <img src="/cosota.png" alt="Yo" style={styles.profileImg} />
            <span style={styles.profileName}>{perfiles.yo.nombre}</span>
            <span style={styles.docCount}>{Object.keys(perfiles.yo.docs).length} docs</span>
          </button>
          <button style={styles.profileCard} onClick={() => setPerfil('esposa')}>
            <img src="/cosita.png" alt="Esposa" style={styles.profileImg} />
            <span style={styles.profileName}>{perfiles.esposa.nombre}</span>
            <span style={styles.docCount}>{Object.keys(perfiles.esposa.docs).length} docs</span>
          </button>
        </div>
        <div style={styles.bottomActions}>
          <button style={styles.syncBtn} onClick={() => setShowSyncModal(true)}>🔄 Sincronizar</button>
          <button style={styles.logoutBtn} onClick={handleLogout}>🔒 Bloquear</button>
        </div>
        {showSyncModal && <SyncModal />}
        <input type="file" ref={importInputRef} onChange={handleImport} accept=".json" style={{ display: 'none' }} />
        <footer style={styles.footer}>Creado por C19 Sage | Colmena 2026</footer>
      </div>
    )
  }

  // Vista de documento
  if (viewDoc) {
    const doc = perfiles[perfil].docs[viewDoc]
    const docType = getDocType(viewDoc)
    const isMultipage = doc?.pages?.length > 0
    const currentData = isMultipage ? doc.pages[currentPage] : doc
    const totalPages = isMultipage ? doc.pages.length : 1
    
    const days = docType?.dateType === 'vencimiento' ? getDaysUntil(doc?.specialDate) : null
    const badgeColor = getDateBadgeColor(days)
    
    return (
      <div style={styles.viewContainer}>
        <div style={styles.viewHeader}>
          <button style={styles.backBtn} onClick={() => { setViewDoc(null); setCurrentPage(0); }}>← Volver</button>
          <span style={styles.viewTitle}>{docType?.name}</span>
          {isMultipage && <span style={styles.pageIndicator}>{currentPage + 1}/{totalPages}</span>}
        </div>
        
        {/* Badge flotante de fecha */}
        {doc?.specialDate && (
          <div style={{
            ...styles.dateBadge,
            background: badgeColor || '#333'
          }}>
            {docType?.dateType === 'vencimiento' ? (
              <>
                <span style={styles.badgeLabel}>Vence:</span>
                <span style={styles.badgeDate}>{formatDate(doc.specialDate)}</span>
                {days !== null && (
                  <span style={styles.badgeDays}>
                    {days < 0 ? `¡Vencido hace ${Math.abs(days)} días!` : 
                     days === 0 ? '¡Vence hoy!' : 
                     `${days} días restantes`}
                  </span>
                )}
              </>
            ) : (
              <>
                <span style={styles.badgeLabel}>Emitido:</span>
                <span style={styles.badgeDate}>{formatDate(doc.specialDate)}</span>
              </>
            )}
          </div>
        )}
        
        {/* Carrusel */}
        <div style={styles.carouselContainer}>
          {isMultipage && currentPage > 0 && (
            <button style={{...styles.carouselBtn, left: '10px'}} onClick={() => setCurrentPage(p => p - 1)}>
              ‹
            </button>
          )}
          
          {currentData?.type?.includes('pdf') ? (
            <iframe src={currentData.data} style={styles.pdfViewer} title="PDF" />
          ) : (
            <img src={currentData?.data} alt="Documento" style={styles.docImage} />
          )}
          
          {isMultipage && currentPage < totalPages - 1 && (
            <button style={{...styles.carouselBtn, right: '10px'}} onClick={() => setCurrentPage(p => p + 1)}>
              ›
            </button>
          )}
        </div>
        
        {/* Dots del carrusel */}
        {isMultipage && totalPages > 1 && (
          <div style={styles.carouselDots}>
            {doc.pages.map((_, i) => (
              <div 
                key={i} 
                style={{
                  ...styles.dot,
                  background: i === currentPage ? '#4ade80' : '#555'
                }}
                onClick={() => setCurrentPage(i)}
              />
            ))}
          </div>
        )}
        
        <div style={styles.viewActions}>
          <a href={currentData?.data} download={currentData?.name || 'documento'} style={styles.downloadBtn}>
            📥 Descargar
          </a>
          {isMultipage && (
            <button style={styles.addPageBtn} onClick={() => handleUploadClick(viewDoc)}>
              ➕ Página
            </button>
          )}
          <button 
            style={styles.deleteBtn} 
            onClick={() => isMultipage ? handleDeletePage(currentPage) : (handleDeleteDoc(viewDoc), setViewDoc(null))}
          >
            🗑️
          </button>
        </div>
      </div>
    )
  }

  // Lista de documentos
  const currentProfile = perfiles[perfil]
  const avatarSrc = perfil === 'yo' ? '/cosota.png' : '/cosita.png'
  
  return (
    <div style={styles.container}>
      <input type="file" ref={cameraInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" style={{ display: 'none' }} />
      <input type="file" ref={galleryInputRef} onChange={handleFileUpload} accept="image/*,.pdf" multiple style={{ display: 'none' }} />
      <input type="file" ref={importInputRef} onChange={handleImport} accept=".json" style={{ display: 'none' }} />
      
      {showUploadModal && <UploadModal />}
      {showDateModal && <DateModal />}
      {showSyncModal && <SyncModal />}
      
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => setPerfil(null)}>← Perfiles</button>
        {editingName ? (
          <div style={styles.editNameContainer}>
            <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} style={styles.nameInput} autoFocus onKeyDown={(e) => e.key === 'Enter' && updateProfileName()} />
            <button onClick={updateProfileName} style={styles.saveNameBtn}>✓</button>
          </div>
        ) : (
          <div style={styles.profileHeader} onClick={() => { setEditingName(true); setTempName(currentProfile.nombre); }}>
            <img src={avatarSrc} alt="" style={styles.headerAvatar} />
            <span>{currentProfile.nombre} ✏️</span>
          </div>
        )}
        <button style={styles.lockBtn} onClick={handleLogout}>🔒</button>
      </div>
      
      <div style={styles.docGrid}>
        {DOC_TYPES.map(docType => {
          const doc = currentProfile.docs[docType.id]
          const hasDoc = !!doc
          const days = docType.dateType === 'vencimiento' ? getDaysUntil(doc?.specialDate) : null
          const badgeColor = getDateBadgeColor(days)
          
          return (
            <div key={docType.id} style={styles.docCard}>
              <div style={styles.docIcon}>{docType.icon}</div>
              <div style={styles.docName}>{docType.name}</div>
              
              {/* Mini badge de vencimiento en tarjeta */}
              {hasDoc && doc?.specialDate && docType.dateType === 'vencimiento' && (
                <div style={{...styles.miniBadge, background: badgeColor}}>
                  {days < 0 ? 'Vencido' : days <= 30 ? `${days}d` : formatDate(doc.specialDate)?.split(' ')[0] + ' ' + formatDate(doc.specialDate)?.split(' ')[1]}
                </div>
              )}
              
              {hasDoc ? (
                <div style={styles.docActions}>
                  <button style={styles.viewBtn} onClick={() => setViewDoc(docType.id)}>
                    👁️ Ver {doc?.pages?.length > 1 ? `(${doc.pages.length})` : ''}
                  </button>
                  <button style={styles.replaceBtn} onClick={() => handleUploadClick(docType.id)}>
                    {docType.multipage ? '➕' : '🔄'}
                  </button>
                </div>
              ) : (
                <button style={styles.uploadBtn} onClick={() => handleUploadClick(docType.id)}>
                  + Agregar
                </button>
              )}
            </div>
          )
        })}
      </div>
      
      <footer style={styles.footer}>Creado por C19 Sage | Colmena 2026</footer>
    </div>
  )
}

const styles = {
  container: { minHeight: '100vh', padding: '1rem', paddingBottom: '4rem', background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)' },
  mainTitle: { textAlign: 'center', fontSize: '2rem', marginBottom: '0.5rem', marginTop: '2rem' },
  selectText: { textAlign: 'center', color: '#888', marginBottom: '2rem' },
  profileGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', maxWidth: '400px', margin: '0 auto' },
  profileCard: { background: '#1a1a1a', border: '2px solid #333', borderRadius: '16px', padding: '1.5rem 1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' },
  profileImg: { width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #4ade80' },
  profileName: { fontSize: '1.1rem', fontWeight: '600' },
  docCount: { color: '#888', fontSize: '0.85rem' },
  bottomActions: { display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem' },
  syncBtn: { background: '#2563eb', border: 'none', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' },
  logoutBtn: { background: 'transparent', border: '1px solid #444', color: '#888', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' },
  backBtn: { background: 'transparent', border: 'none', color: '#4ade80', fontSize: '1rem', cursor: 'pointer' },
  profileHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '1.2rem' },
  headerAvatar: { width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' },
  lockBtn: { background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer' },
  editNameContainer: { display: 'flex', gap: '0.5rem' },
  nameInput: { background: '#2a2a2a', border: '1px solid #4ade80', borderRadius: '8px', padding: '0.5rem', color: '#fff', fontSize: '1rem' },
  saveNameBtn: { background: '#4ade80', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 'bold' },
  docGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' },
  docCard: { background: '#1a1a1a', borderRadius: '12px', padding: '1rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' },
  docIcon: { fontSize: '2rem' },
  docName: { fontSize: '0.85rem', color: '#ccc', minHeight: '2.5rem' },
  miniBadge: { position: 'absolute', top: '8px', right: '8px', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold', color: '#fff' },
  docActions: { display: 'flex', gap: '0.5rem', justifyContent: 'center' },
  viewBtn: { background: '#4ade80', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.8rem', cursor: 'pointer', flex: 1 },
  replaceBtn: { background: '#333', border: 'none', borderRadius: '6px', padding: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' },
  uploadBtn: { background: '#333', border: '1px dashed #555', borderRadius: '6px', padding: '0.5rem', color: '#888', fontSize: '0.85rem', cursor: 'pointer' },
  viewContainer: { minHeight: '100vh', background: '#000', display: 'flex', flexDirection: 'column' },
  viewHeader: { display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#1a1a1a' },
  viewTitle: { fontSize: '1.1rem', flex: 1 },
  pageIndicator: { background: '#333', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' },
  dateBadge: { margin: '0.5rem 1rem', padding: '0.75rem 1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  badgeLabel: { fontSize: '0.75rem', opacity: 0.8 },
  badgeDate: { fontSize: '1.1rem', fontWeight: 'bold' },
  badgeDays: { fontSize: '0.8rem', marginTop: '2px' },
  carouselContainer: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  carouselBtn: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', fontSize: '2rem', padding: '1rem 0.5rem', cursor: 'pointer', zIndex: 10, borderRadius: '8px' },
  carouselDots: { display: 'flex', justifyContent: 'center', gap: '8px', padding: '0.5rem' },
  dot: { width: '8px', height: '8px', borderRadius: '50%', cursor: 'pointer' },
  docImage: { maxHeight: 'calc(100vh - 250px)', maxWidth: '100%', objectFit: 'contain' },
  pdfViewer: { flex: 1, width: '100%', border: 'none', minHeight: 'calc(100vh - 200px)' },
  viewActions: { display: 'flex', gap: '0.5rem', padding: '1rem', background: '#1a1a1a' },
  downloadBtn: { flex: 1, background: '#4ade80', color: '#000', textAlign: 'center', padding: '0.75rem', borderRadius: '8px', fontWeight: '600', textDecoration: 'none' },
  addPageBtn: { background: '#2563eb', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', color: '#fff', cursor: 'pointer' },
  deleteBtn: { background: '#ef4444', border: 'none', padding: '0.75rem 1rem', borderRadius: '8px', color: '#fff', cursor: 'pointer' },
  footer: { textAlign: 'center', padding: '2rem', color: '#555', fontSize: '0.8rem', position: 'fixed', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, #0a0a0a)' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#1a1a1a', borderRadius: '16px', padding: '1.5rem', width: '90%', maxWidth: '320px', textAlign: 'center' },
  modalTitle: { marginBottom: '0.5rem', fontSize: '1.1rem' },
  modalDesc: { color: '#888', fontSize: '0.85rem', marginBottom: '1rem' },
  modalOptions: { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' },
  modalBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', background: '#2a2a2a', border: '1px solid #333', borderRadius: '12px', padding: '1rem', color: '#fff', fontSize: '1rem', cursor: 'pointer' },
  modalBtnPrimary: { background: '#4ade80', border: 'none', borderRadius: '12px', padding: '1rem', color: '#000', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' },
  modalIcon: { fontSize: '1.5rem' },
  modalCancel: { background: 'transparent', border: 'none', color: '#888', padding: '0.75rem', cursor: 'pointer', width: '100%' },
  dateInput: { width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid #333', background: '#2a2a2a', color: '#fff', fontSize: '1rem', marginBottom: '1rem' }
}
