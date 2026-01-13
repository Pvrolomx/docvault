'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const DOC_TYPES = [
  { id: 'ine', name: 'INE', icon: '🪪' },
  { id: 'rfc', name: 'RFC / Constancia SAT', icon: '📄' },
  { id: 'curp', name: 'CURP', icon: '📋' },
  { id: 'comprobante', name: 'Comprobante Domicilio', icon: '🏠' },
  { id: 'acta_nacimiento', name: 'Acta de Nacimiento', icon: '📜' },
  { id: 'pasaporte', name: 'Pasaporte', icon: '🛂' },
  { id: 'licencia', name: 'Licencia de Conducir', icon: '🚗' },
  { id: 'acta_matrimonio', name: 'Acta de Matrimonio', icon: '💍' },
  { id: 'otro', name: 'Otro Documento', icon: '📎' },
]

export default function Boveda() {
  const [perfil, setPerfil] = useState(null)
  const [perfiles, setPerfiles] = useState({ yo: { nombre: 'Yo', docs: {} }, esposa: { nombre: 'Esposa', docs: {} } })
  const [viewDoc, setViewDoc] = useState(null)
  const [editingName, setEditingName] = useState(false)
  const [tempName, setTempName] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadTarget, setUploadTarget] = useState(null)
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
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

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file || !uploadTarget) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const newPerfiles = { ...perfiles }
      newPerfiles[perfil].docs[uploadTarget] = {
        data: event.target.result,
        name: file.name,
        type: file.type,
        date: new Date().toISOString()
      }
      savePerfiles(newPerfiles)
      setUploadTarget(null)
      setShowUploadModal(false)
    }
    reader.readAsDataURL(file)
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

  // Modal de selección cámara/imagen
  const UploadModal = () => (
    <div style={styles.modalOverlay} onClick={() => setShowUploadModal(false)}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.modalTitle}>Agregar documento</h3>
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

  // Selección de perfil
  if (!perfil) {
    return (
      <div style={styles.container}>
        <h1 style={styles.mainTitle}>🔐 DocVault</h1>
        <p style={styles.selectText}>Selecciona un perfil</p>
        
        <div style={styles.profileGrid}>
          <button style={styles.profileCard} onClick={() => setPerfil('yo')}>
            <span style={styles.profileIcon}>👤</span>
            <span style={styles.profileName}>{perfiles.yo.nombre}</span>
            <span style={styles.docCount}>{Object.keys(perfiles.yo.docs).length} docs</span>
          </button>
          
          <button style={styles.profileCard} onClick={() => setPerfil('esposa')}>
            <span style={styles.profileIcon}>👩</span>
            <span style={styles.profileName}>{perfiles.esposa.nombre}</span>
            <span style={styles.docCount}>{Object.keys(perfiles.esposa.docs).length} docs</span>
          </button>
        </div>
        
        <button style={styles.logoutBtn} onClick={handleLogout}>
          🔒 Bloquear
        </button>
        
        <footer style={styles.footer}>Creado por C19 Sage | Colmena 2026</footer>
      </div>
    )
  }

  // Vista de documento
  if (viewDoc) {
    const doc = perfiles[perfil].docs[viewDoc]
    return (
      <div style={styles.viewContainer}>
        <div style={styles.viewHeader}>
          <button style={styles.backBtn} onClick={() => setViewDoc(null)}>← Volver</button>
          <span style={styles.viewTitle}>{DOC_TYPES.find(d => d.id === viewDoc)?.name}</span>
        </div>
        {doc?.type?.includes('pdf') ? (
          <iframe src={doc.data} style={styles.pdfViewer} title="PDF Viewer" />
        ) : (
          <img src={doc?.data} alt="Documento" style={styles.docImage} />
        )}
        <div style={styles.viewActions}>
          <a href={doc?.data} download={doc?.name} style={styles.downloadBtn}>
            📥 Descargar
          </a>
          <button style={styles.deleteBtn} onClick={() => { handleDeleteDoc(viewDoc); setViewDoc(null); }}>
            🗑️ Eliminar
          </button>
        </div>
      </div>
    )
  }

  // Lista de documentos
  const currentProfile = perfiles[perfil]
  
  return (
    <div style={styles.container}>
      {/* Input para cámara */}
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
      />
      {/* Input para galería/documentos */}
      <input
        type="file"
        ref={galleryInputRef}
        onChange={handleFileUpload}
        accept="image/*,.pdf"
        style={{ display: 'none' }}
      />
      
      {showUploadModal && <UploadModal />}
      
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => setPerfil(null)}>← Perfiles</button>
        {editingName ? (
          <div style={styles.editNameContainer}>
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              style={styles.nameInput}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && updateProfileName()}
            />
            <button onClick={updateProfileName} style={styles.saveNameBtn}>✓</button>
          </div>
        ) : (
          <h1 style={styles.profileTitle} onClick={() => { setEditingName(true); setTempName(currentProfile.nombre); }}>
            {perfil === 'yo' ? '👤' : '👩'} {currentProfile.nombre} ✏️
          </h1>
        )}
        <button style={styles.lockBtn} onClick={handleLogout}>🔒</button>
      </div>
      
      <div style={styles.docGrid}>
        {DOC_TYPES.map(docType => {
          const hasDoc = currentProfile.docs[docType.id]
          return (
            <div key={docType.id} style={styles.docCard}>
              <div style={styles.docIcon}>{docType.icon}</div>
              <div style={styles.docName}>{docType.name}</div>
              {hasDoc ? (
                <div style={styles.docActions}>
                  <button style={styles.viewBtn} onClick={() => setViewDoc(docType.id)}>
                    👁️ Ver
                  </button>
                  <button style={styles.replaceBtn} onClick={() => handleUploadClick(docType.id)}>
                    🔄
                  </button>
                </div>
              ) : (
                <button style={styles.uploadBtn} onClick={() => handleUploadClick(docType.id)}>
                  + Agregar
                </button>
              )}
              {hasDoc && (
                <div style={styles.docDate}>
                  {new Date(hasDoc.date).toLocaleDateString('es-MX')}
                </div>
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
  container: {
    minHeight: '100vh',
    padding: '1rem',
    paddingBottom: '4rem',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)'
  },
  mainTitle: { textAlign: 'center', fontSize: '2rem', marginBottom: '0.5rem', marginTop: '2rem' },
  selectText: { textAlign: 'center', color: '#888', marginBottom: '2rem' },
  profileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
    maxWidth: '400px',
    margin: '0 auto'
  },
  profileCard: {
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: '16px',
    padding: '2rem 1rem',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'border-color 0.2s'
  },
  profileIcon: { fontSize: '3rem' },
  profileName: { fontSize: '1.1rem', fontWeight: '600' },
  docCount: { color: '#888', fontSize: '0.85rem' },
  logoutBtn: {
    display: 'block',
    margin: '2rem auto',
    background: 'transparent',
    border: '1px solid #444',
    color: '#888',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    gap: '0.5rem'
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: '#4ade80',
    fontSize: '1rem',
    cursor: 'pointer'
  },
  profileTitle: {
    fontSize: '1.3rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  lockBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '1.3rem',
    cursor: 'pointer'
  },
  editNameContainer: { display: 'flex', gap: '0.5rem' },
  nameInput: {
    background: '#2a2a2a',
    border: '1px solid #4ade80',
    borderRadius: '8px',
    padding: '0.5rem',
    color: '#fff',
    fontSize: '1rem'
  },
  saveNameBtn: {
    background: '#4ade80',
    border: 'none',
    borderRadius: '8px',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  docGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '1rem'
  },
  docCard: {
    background: '#1a1a1a',
    borderRadius: '12px',
    padding: '1rem',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  docIcon: { fontSize: '2rem' },
  docName: { fontSize: '0.85rem', color: '#ccc', minHeight: '2.5rem' },
  docActions: { display: 'flex', gap: '0.5rem', justifyContent: 'center' },
  viewBtn: {
    background: '#4ade80',
    border: 'none',
    borderRadius: '6px',
    padding: '0.4rem 0.8rem',
    fontSize: '0.8rem',
    cursor: 'pointer',
    flex: 1
  },
  replaceBtn: {
    background: '#333',
    border: 'none',
    borderRadius: '6px',
    padding: '0.4rem',
    fontSize: '0.8rem',
    cursor: 'pointer'
  },
  uploadBtn: {
    background: '#333',
    border: '1px dashed #555',
    borderRadius: '6px',
    padding: '0.5rem',
    color: '#888',
    fontSize: '0.85rem',
    cursor: 'pointer'
  },
  docDate: { fontSize: '0.7rem', color: '#666' },
  viewContainer: {
    minHeight: '100vh',
    background: '#000',
    display: 'flex',
    flexDirection: 'column'
  },
  viewHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    background: '#1a1a1a'
  },
  viewTitle: { fontSize: '1.1rem' },
  docImage: {
    flex: 1,
    objectFit: 'contain',
    maxHeight: 'calc(100vh - 150px)',
    width: '100%'
  },
  pdfViewer: {
    flex: 1,
    width: '100%',
    border: 'none',
    minHeight: 'calc(100vh - 150px)'
  },
  viewActions: {
    display: 'flex',
    gap: '1rem',
    padding: '1rem',
    background: '#1a1a1a'
  },
  downloadBtn: {
    flex: 1,
    background: '#4ade80',
    color: '#000',
    textAlign: 'center',
    padding: '0.75rem',
    borderRadius: '8px',
    fontWeight: '600'
  },
  deleteBtn: {
    background: '#ef4444',
    border: 'none',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer'
  },
  footer: {
    textAlign: 'center',
    padding: '2rem',
    color: '#555',
    fontSize: '0.8rem',
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'linear-gradient(transparent, #0a0a0a)'
  },
  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    background: '#1a1a1a',
    borderRadius: '16px',
    padding: '1.5rem',
    width: '90%',
    maxWidth: '320px',
    textAlign: 'center'
  },
  modalTitle: {
    marginBottom: '1.5rem',
    fontSize: '1.1rem'
  },
  modalOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '1rem'
  },
  modalBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    background: '#2a2a2a',
    border: '1px solid #333',
    borderRadius: '12px',
    padding: '1rem',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer'
  },
  modalIcon: {
    fontSize: '1.5rem'
  },
  modalCancel: {
    background: 'transparent',
    border: 'none',
    color: '#888',
    padding: '0.75rem',
    cursor: 'pointer',
    width: '100%'
  }
}
