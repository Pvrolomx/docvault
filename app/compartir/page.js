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
  { id: 'escrituras', name: 'Escrituras', icon: '🏡' },
  { id: 'otro', name: 'Otro Documento', icon: '📎' },
]

export default function Compartir() {
  const [perfil, setPerfil] = useState(null)
  const [tipoDoc, setTipoDoc] = useState(null)
  const [archivo, setArchivo] = useState(null)
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [perfiles, setPerfiles] = useState({ yo: { nombre: 'Yo', docs: {} }, esposa: { nombre: 'Esposa', docs: {} } })
  const fileInputRef = useRef(null)
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

    // Intentar obtener archivo compartido del SW cache
    if ('caches' in window) {
      caches.open('docvault-share').then(cache => {
        cache.match('/shared-file').then(response => {
          if (response) {
            response.blob().then(blob => {
              const file = new File([blob], 'documento-compartido', { type: blob.type })
              setArchivo(file)
              const url = URL.createObjectURL(blob)
              setPreview(url)
            })
            cache.delete('/shared-file')
          }
        })
      })
    }
  }, [router])

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      setArchivo(file)
      const url = URL.createObjectURL(file)
      setPreview(url)
    }
  }

  const handleSave = async () => {
    if (!perfil || !tipoDoc || !archivo) return
    
    setSaving(true)
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const newPerfiles = { ...perfiles }
      const docType = DOC_TYPES.find(d => d.id === tipoDoc)
      
      if (docType && (tipoDoc === 'escrituras' || tipoDoc === 'otro')) {
        // Multipage
        if (newPerfiles[perfil].docs[tipoDoc]?.pages) {
          newPerfiles[perfil].docs[tipoDoc].pages.push({
            data: event.target.result,
            name: archivo.name,
            type: archivo.type
          })
        } else {
          newPerfiles[perfil].docs[tipoDoc] = {
            pages: [{
              data: event.target.result,
              name: archivo.name,
              type: archivo.type
            }],
            date: new Date().toISOString()
          }
        }
      } else {
        newPerfiles[perfil].docs[tipoDoc] = {
          data: event.target.result,
          name: archivo.name,
          type: archivo.type,
          date: new Date().toISOString()
        }
      }
      
      localStorage.setItem('docvault_perfiles', JSON.stringify(newPerfiles))
      setSaving(false)
      router.push('/boveda')
    }
    reader.readAsDataURL(archivo)
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>📥 Guardar Documento</h1>
      
      {/* Preview o selector de archivo */}
      <div style={styles.previewArea}>
        {preview ? (
          <img src={preview} alt="Preview" style={styles.preview} />
        ) : (
          <button style={styles.selectBtn} onClick={() => fileInputRef.current?.click()}>
            📎 Seleccionar archivo
          </button>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,.pdf"
          style={{ display: 'none' }}
        />
      </div>
      
      {/* Selector de perfil */}
      <div style={styles.section}>
        <p style={styles.label}>¿Para quién es?</p>
        <div style={styles.options}>
          <button
            style={{...styles.optionBtn, ...(perfil === 'yo' ? styles.optionSelected : {})}}
            onClick={() => setPerfil('yo')}
          >
            <img src="/cosota.png" alt="" style={styles.optionImg} />
            <span>{perfiles.yo.nombre}</span>
          </button>
          <button
            style={{...styles.optionBtn, ...(perfil === 'esposa' ? styles.optionSelected : {})}}
            onClick={() => setPerfil('esposa')}
          >
            <img src="/cosita.png" alt="" style={styles.optionImg} />
            <span>{perfiles.esposa.nombre}</span>
          </button>
        </div>
      </div>
      
      {/* Selector de tipo */}
      <div style={styles.section}>
        <p style={styles.label}>Tipo de documento</p>
        <div style={styles.docTypes}>
          {DOC_TYPES.map(doc => (
            <button
              key={doc.id}
              style={{...styles.docTypeBtn, ...(tipoDoc === doc.id ? styles.docTypeSelected : {})}}
              onClick={() => setTipoDoc(doc.id)}
            >
              <span>{doc.icon}</span>
              <span style={styles.docTypeName}>{doc.name}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Botones de acción */}
      <div style={styles.actions}>
        <button
          style={{...styles.saveBtn, opacity: (perfil && tipoDoc && archivo) ? 1 : 0.5}}
          onClick={handleSave}
          disabled={!perfil || !tipoDoc || !archivo || saving}
        >
          {saving ? '⏳ Guardando...' : '💾 Guardar en DocVault'}
        </button>
        <button style={styles.cancelBtn} onClick={() => router.push('/boveda')}>
          Cancelar
        </button>
      </div>
      
      <footer style={styles.footer}>Creado por C19 Sage | Colmena 2026</footer>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: '1rem',
    paddingBottom: '6rem',
    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)'
  },
  title: {
    textAlign: 'center',
    fontSize: '1.5rem',
    marginBottom: '1.5rem',
    marginTop: '1rem'
  },
  previewArea: {
    background: '#1a1a1a',
    borderRadius: '12px',
    padding: '1rem',
    marginBottom: '1.5rem',
    minHeight: '150px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  preview: {
    maxWidth: '100%',
    maxHeight: '200px',
    borderRadius: '8px',
    objectFit: 'contain'
  },
  selectBtn: {
    background: '#2a2a2a',
    border: '2px dashed #444',
    borderRadius: '12px',
    padding: '2rem 3rem',
    color: '#888',
    fontSize: '1rem',
    cursor: 'pointer'
  },
  section: {
    marginBottom: '1.5rem'
  },
  label: {
    color: '#888',
    marginBottom: '0.75rem',
    fontSize: '0.9rem'
  },
  options: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem'
  },
  optionBtn: {
    background: '#1a1a1a',
    border: '2px solid #333',
    borderRadius: '12px',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer',
    color: '#fff'
  },
  optionSelected: {
    borderColor: '#4ade80',
    background: '#1a2a1a'
  },
  optionImg: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    objectFit: 'cover'
  },
  docTypes: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem'
  },
  docTypeBtn: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '0.75rem 0.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    cursor: 'pointer',
    color: '#fff',
    fontSize: '1.2rem'
  },
  docTypeSelected: {
    borderColor: '#4ade80',
    background: '#1a2a1a'
  },
  docTypeName: {
    fontSize: '0.65rem',
    color: '#aaa',
    textAlign: 'center'
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginTop: '2rem'
  },
  saveBtn: {
    background: '#4ade80',
    border: 'none',
    borderRadius: '12px',
    padding: '1rem',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    color: '#000'
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: '12px',
    padding: '0.75rem',
    color: '#888',
    cursor: 'pointer'
  },
  footer: {
    textAlign: 'center',
    padding: '1rem',
    color: '#555',
    fontSize: '0.8rem',
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0
  }
}
