import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Plus, Trash2, Save, Edit3, X, Video, Image as ImageIcon,
  Eye, EyeOff, ChevronUp, ChevronDown, Star,
  StarOff, ExternalLink, AlertTriangle, Check, Film,
  Upload, Link as LinkIcon, Loader,
} from 'lucide-react';
import api from '../../services/api';
import { PageHeader, Modal } from '../../components/shared';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getYTThumb(url) {
  const m = (url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}
function isValidUrl(s) { try { new URL(s); return true; } catch { return false; } }
function toDisplay(url) {
  if (!url) return null;
  return url.startsWith('/uploads') ? `${API_BASE}${url}` : url;
}

// ── Tag chip input ─────────────────────────────────────────────────────────────
function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('');
  const add = () => {
    const t = input.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/15 text-primary border border-primary/30 rounded-full text-xs font-medium">
            {t}
            <button onClick={() => onChange(tags.filter((_, j) => j !== i))} className="text-primary/50 hover:text-red-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="input flex-1 text-sm" placeholder="Add a tag and press Enter…"
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button onClick={add} className="btn-secondary px-3 text-sm">Add</button>
      </div>
    </div>
  );
}

// ── Image upload + URL editor ──────────────────────────────────────────────────
function ImageListEditor({ images, onChange }) {
  const [urlInput,     setUrlInput]     = useState('');
  const [captionInput, setCaptionInput] = useState('');
  const [uploading,    setUploading]    = useState(false);
  const [uploadMode,   setUploadMode]   = useState('file');
  const [dragOver,     setDragOver]     = useState(false);
  const fileInputRef = useRef(null);

  const uploadFiles = useCallback(async (files) => {
    const imgs = [...files].filter(f => f.type.startsWith('image/'));
    if (!imgs.length) { toast.error('Only image files accepted'); return; }
    setUploading(true);
    try {
      const form = new FormData();
      imgs.forEach(f => form.append('images', f));
      const { data } = await api.post('/upload?folder=portfolio', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (data.success) {
        onChange([...images, ...data.urls.map(url => ({ url, caption: '' }))]);
        toast.success(`${data.urls.length} image${data.urls.length > 1 ? 's' : ''} uploaded`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [images, onChange]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  }, [uploadFiles]);

  const addByUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!isValidUrl(url)) { toast.error('Invalid URL'); return; }
    onChange([...images, { url, caption: captionInput.trim() }]);
    setUrlInput('');
    setCaptionInput('');
  };

  const removeImage = async (i) => {
    const img = images[i];
    if (img.url.startsWith('/uploads')) {
      try { await api.delete('/upload', { data: { url: img.url } }); } catch {}
    }
    onChange(images.filter((_, j) => j !== i));
  };

  const moveUp   = (i) => { if (i === 0) return; const n = [...images]; [n[i-1], n[i]] = [n[i], n[i-1]]; onChange(n); };
  const moveDown = (i) => { if (i === images.length - 1) return; const n = [...images]; [n[i], n[i+1]] = [n[i+1], n[i]]; onChange(n); };

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button onClick={() => setUploadMode('file')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border transition-all
            ${uploadMode === 'file' ? 'bg-primary/20 text-primary border-primary/40' : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20'}`}>
          <Upload className="w-3.5 h-3.5" /> Upload File
        </button>
        <button onClick={() => setUploadMode('url')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border transition-all
            ${uploadMode === 'url' ? 'bg-primary/20 text-primary border-primary/40' : 'bg-white/5 text-white/40 border-white/10 hover:border-white/20'}`}>
          <LinkIcon className="w-3.5 h-3.5" /> Paste URL
        </button>
      </div>

      {/* Drop zone */}
      {uploadMode === 'file' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all select-none
            ${dragOver ? 'border-primary bg-primary/10 scale-[1.01]' : 'border-white/15 bg-white/[0.02] hover:border-white/30 hover:bg-white/5'}
            ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
            multiple className="hidden" onChange={e => uploadFiles(e.target.files)} />
          {uploading ? (
            <>
              <Loader className="w-8 h-8 text-primary animate-spin" />
              <p className="text-white/50 text-sm">Uploading…</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-white/40" />
              </div>
              <div className="text-center">
                <p className="text-white/70 text-sm font-medium">
                  Drop images here or <span className="text-primary underline underline-offset-2">click to browse</span>
                </p>
                <p className="text-white/30 text-xs mt-1">JPG, PNG, WebP, GIF · up to 10 MB · multiple files OK</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* URL input */}
      {uploadMode === 'url' && (
        <div className="space-y-2 p-3 bg-white/5 rounded-xl border border-white/10">
          <input className="input text-sm font-mono" placeholder="https://… (direct image URL)"
            value={urlInput} onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addByUrl(); } }} />
          <div className="flex gap-2">
            <input className="input flex-1 text-sm" placeholder="Caption (optional)"
              value={captionInput} onChange={e => setCaptionInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addByUrl(); } }} />
            <button onClick={addByUrl} className="btn-secondary px-3 text-sm flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>
      )}

      {/* Image list */}
      {images.length > 0 && (
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {images.map((img, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-white/5 rounded-xl border border-white/10">
              <div className="w-14 h-10 rounded-lg overflow-hidden bg-white/10 flex-shrink-0 border border-white/10">
                <img src={toDisplay(img.url)} alt="" className="w-full h-full object-cover"
                  onError={e => { e.target.style.display = 'none'; }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/50 text-xs font-mono truncate">{img.url}</p>
                {img.caption && <p className="text-white/30 text-xs truncate">{img.caption}</p>}
                <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md
                  ${img.url.startsWith('/uploads') ? 'bg-green-500/15 text-green-400' : 'bg-blue-500/15 text-blue-400'}`}>
                  {img.url.startsWith('/uploads') ? 'uploaded' : 'url'}
                </span>
              </div>
              <button onClick={() => moveUp(i)}   disabled={i === 0}               className="p-1 text-white/30 hover:text-white disabled:opacity-20 transition-colors"><ChevronUp   className="w-3.5 h-3.5" /></button>
              <button onClick={() => moveDown(i)} disabled={i === images.length-1} className="p-1 text-white/30 hover:text-white disabled:opacity-20 transition-colors"><ChevronDown className="w-3.5 h-3.5" /></button>
              <button onClick={() => removeImage(i)} className="p-1 text-white/30 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
      {images.length === 0 && <p className="text-white/20 text-xs text-center py-2 italic">No images yet</p>}
    </div>
  );
}

const EMPTY_PROJ = { client: '', title: '', tags: [], description: '', coverImage: '', images: [], featured: false, isActive: true };

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminHomepage() {
  const [content,     setContent]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState('portfolio');
  const [videoForm,   setVideoForm]   = useState({ isActive: false, url: '', title: '', subtitle: '' });
  const [savingVideo, setSavingVideo] = useState(false);
  const [videoDirty,  setVideoDirty]  = useState(false);
  const [showProj,    setShowProj]    = useState(false);
  const [editingProj, setEditingProj] = useState(null);
  const [projForm,    setProjForm]    = useState({ ...EMPTY_PROJ });
  const [savingProj,  setSavingProj]  = useState(false);
  const [delTarget,   setDelTarget]   = useState(null);
  const [deleting,    setDeleting]    = useState(false);

  const fetchContent = async () => {
    try {
      const { data } = await api.get('/homepage');
      setContent(data.content);
      const v = data.content?.featuredVideo || {};
      setVideoForm({ isActive: v.isActive || false, url: v.url || '', title: v.title || '', subtitle: v.subtitle || '' });
    } catch { toast.error('Failed to load homepage content'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchContent(); }, []);

  const saveVideo = async () => {
    setSavingVideo(true);
    try {
      await api.put('/homepage/video', videoForm);
      toast.success('Featured video saved');
      setVideoDirty(false);
      fetchContent();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
    finally { setSavingVideo(false); }
  };
  const setVF = (key, val) => { setVideoForm(f => ({ ...f, [key]: val })); setVideoDirty(true); };

  const openNew = () => { setEditingProj(null); setProjForm({ ...EMPTY_PROJ }); setShowProj(true); };
  const openEdit = (proj) => {
    setEditingProj(proj);
    setProjForm({
      client: proj.client || '', title: proj.title || '', tags: proj.tags || [],
      description: proj.description || '', coverImage: proj.coverImage || '',
      images: proj.images || [], featured: proj.featured || false,
      isActive: proj.isActive !== false,
    });
    setShowProj(true);
  };

  const saveProject = async () => {
    if (!projForm.client.trim() || !projForm.title.trim()) { toast.error('Client and title are required'); return; }
    setSavingProj(true);
    try {
      if (editingProj) await api.put(`/homepage/portfolio/${editingProj._id}`, projForm);
      else             await api.post('/homepage/portfolio', projForm);
      toast.success(editingProj ? 'Project updated' : 'Project added');
      setShowProj(false);
      fetchContent();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to save project'); }
    finally { setSavingProj(false); }
  };

  const deleteProject = async () => {
    setDeleting(true);
    try {
      await api.delete(`/homepage/portfolio/${delTarget._id}`);
      toast.success('Project deleted');
      setDelTarget(null);
      fetchContent();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
    finally { setDeleting(false); }
  };

  const toggleActive   = async (proj) => {
    try { await api.put(`/homepage/portfolio/${proj._id}`, { ...proj, isActive: !proj.isActive }); toast.success(proj.isActive ? 'Hidden from public' : 'Now visible'); fetchContent(); }
    catch { toast.error('Failed'); }
  };
  const toggleFeatured = async (proj) => {
    try { await api.put(`/homepage/portfolio/${proj._id}`, { ...proj, featured: !proj.featured }); toast.success(proj.featured ? 'Removed from featured' : 'Pinned as featured hero'); fetchContent(); }
    catch { toast.error('Failed'); }
  };
  const moveOrder = async (proj, dir) => {
    const sorted = [...(content?.portfolio || [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    const idx = sorted.findIndex(p => p._id === proj._id);
    if (!sorted[idx + dir]) return;
    const order = sorted.map((p, i) => ({ id: p._id, order: i }));
    const tmp = order[idx].order; order[idx].order = order[idx + dir].order; order[idx + dir].order = tmp;
    try { await api.put('/homepage/portfolio/reorder', { order }); fetchContent(); }
    catch { toast.error('Failed to reorder'); }
  };

  const projects = [...(content?.portfolio || [])].sort((a, b) => {
    if (b.featured !== a.featured) return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
    return (a.order ?? 99) - (b.order ?? 99);
  });

  const getCover = (proj) => toDisplay(proj.coverImage || proj.images?.[0]?.url || null);
  const ytThumb  = getYTThumb(videoForm.url);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Homepage Manager"
        subtitle="Manage portfolio projects and the featured video section"
        action={
          <a href="/" target="_blank" rel="noreferrer" className="btn-secondary flex items-center gap-2 text-sm">
            <ExternalLink className="w-4 h-4" /> Preview Site
          </a>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {[
          { key: 'portfolio', label: 'Portfolio Projects', icon: <ImageIcon className="w-4 h-4" /> },
          { key: 'video',     label: 'Featured Video',    icon: <Film      className="w-4 h-4" /> },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px
              ${tab === t.key ? 'text-primary border-primary' : 'text-white/50 border-transparent hover:text-white'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ══ PORTFOLIO TAB ══ */}
      {tab === 'portfolio' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-white/40 text-sm">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
            <button onClick={openNew} className="btn-primary"><Plus className="w-4 h-4" /> Add Project</button>
          </div>

          {projects.length === 0 && (
            <div className="card flex flex-col items-center gap-3 py-16">
              <ImageIcon className="w-10 h-10 text-white/15" />
              <p className="text-white/40 text-sm">No portfolio projects yet.</p>
              <button onClick={openNew} className="btn-primary">Add Your First Project</button>
            </div>
          )}

          {projects.map((proj, idx) => (
            <div key={proj._id}
              className={`card flex gap-4 items-start transition-all
                ${!proj.isActive ? 'opacity-50' : ''}
                ${proj.featured ? 'border border-primary/30 bg-primary/5' : ''}`}>

              {/* Thumbnail */}
              <div className="w-24 h-16 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
                {getCover(proj)
                  ? <img src={getCover(proj)} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs font-bold">{proj.client?.[0] || '?'}</div>}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {proj.featured && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-semibold">
                      <Star className="w-3 h-3" /> Featured
                    </span>
                  )}
                  {!proj.isActive && <span className="px-2 py-0.5 bg-white/10 text-white/40 rounded-full text-xs">Hidden</span>}
                  <span className="text-white/30 text-xs font-mono">#{idx + 1}</span>
                </div>
                <p className="text-white font-semibold text-sm">{proj.title}</p>
                <p className="text-white/40 text-xs">{proj.client}</p>
                {proj.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {proj.tags.slice(0, 4).map((t, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white/5 text-white/40 rounded-full text-xs">{t}</span>
                    ))}
                    {proj.tags.length > 4 && <span className="text-white/25 text-xs">+{proj.tags.length - 4} more</span>}
                  </div>
                )}
                <p className="text-white/25 text-xs mt-1">{proj.images?.length || 0} image{proj.images?.length !== 1 ? 's' : ''}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button onClick={() => openEdit(proj)}
                  className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => toggleFeatured(proj)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5
                    ${proj.featured ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20' : 'bg-white/5 text-white/40 border-white/10 hover:text-white hover:border-white/20'}`}>
                  {proj.featured ? <><StarOff className="w-3.5 h-3.5" /> Unfeature</> : <><Star className="w-3.5 h-3.5" /> Feature</>}
                </button>
                <button onClick={() => toggleActive(proj)}
                  className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
                  {proj.isActive ? <><EyeOff className="w-3.5 h-3.5" /> Hide</> : <><Eye className="w-3.5 h-3.5" /> Show</>}
                </button>
                <button onClick={() => setDelTarget(proj)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
                <div className="flex gap-1">
                  <button onClick={() => moveOrder(proj, -1)} disabled={idx === 0}
                    className="flex-1 btn-ghost text-xs py-1 disabled:opacity-20"><ChevronUp   className="w-3.5 h-3.5 mx-auto" /></button>
                  <button onClick={() => moveOrder(proj,  1)} disabled={idx === projects.length - 1}
                    className="flex-1 btn-ghost text-xs py-1 disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5 mx-auto" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ VIDEO TAB ══ */}
      {tab === 'video' && (
        <div className="card space-y-5">
          {/* Toggle */}
          <div onClick={() => setVF('isActive', !videoForm.isActive)}
            className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all
              ${videoForm.isActive ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-white/10'}`}>
            <div className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 ${videoForm.isActive ? 'bg-primary' : 'bg-white/20'}`}>
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${videoForm.isActive ? 'left-6' : 'left-0.5'}`} />
            </div>
            <div>
              <p className={`font-semibold text-sm ${videoForm.isActive ? 'text-primary' : 'text-white/60'}`}>
                {videoForm.isActive ? 'Video section visible on homepage' : 'Video section hidden'}
              </p>
              <p className="text-white/30 text-xs mt-0.5">Toggle to show or hide the featured video section</p>
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="label">Video URL</label>
            <input className="input" placeholder="https://youtube.com/watch?v=… or https://vimeo.com/… or direct .mp4 URL"
              value={videoForm.url} onChange={e => setVF('url', e.target.value)} />
            <p className="text-white/30 text-xs mt-1">Supports YouTube, Vimeo, or direct MP4 links</p>
          </div>

          {/* Preview */}
          {videoForm.url && (
            <div>
              <p className="label">Preview</p>
              {ytThumb ? (
                <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video max-w-sm">
                  <img src={ytThumb} alt="YouTube thumbnail" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-12 h-12 bg-red-500/90 rounded-full flex items-center justify-center">
                      <Video className="w-5 h-5 text-white ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-0 right-0 text-center">
                    <span className="text-xs text-white/60 bg-black/50 px-2 py-0.5 rounded-md">YouTube detected</span>
                  </div>
                </div>
              ) : isValidUrl(videoForm.url) ? (
                <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/10">
                  <Film className="w-5 h-5 text-white/40" />
                  <span className="text-white/50 text-sm font-mono truncate flex-1">{videoForm.url}</span>
                  <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-red-400 text-sm">Invalid URL</span>
                </div>
              )}
            </div>
          )}

          {/* Title / Subtitle */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Section Title</label>
              <input className="input" placeholder="BEHIND THE LENS" value={videoForm.title} onChange={e => setVF('title', e.target.value)} />
            </div>
            <div>
              <label className="label">Subtitle</label>
              <input className="input" placeholder="See how we bring your events to life." value={videoForm.subtitle} onChange={e => setVF('subtitle', e.target.value)} />
            </div>
          </div>

          {videoDirty
            ? <button onClick={saveVideo} disabled={savingVideo} className="btn-primary w-full justify-center">
                <Save className="w-4 h-4" /> {savingVideo ? 'Saving…' : 'Save Video Settings'}
              </button>
            : <p className="text-center text-white/25 text-xs">No unsaved changes</p>}
        </div>
      )}

      {/* ══ PROJECT MODAL ══ */}
      <Modal isOpen={showProj} onClose={() => setShowProj(false)} title={editingProj ? 'Edit Project' : 'Add New Project'}>
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Client Name *</label>
              <input className="input" placeholder="e.g. Metrobank"
                value={projForm.client} onChange={e => setProjForm(f => ({ ...f, client: e.target.value }))} />
            </div>
            <div>
              <label className="label">Project Title *</label>
              <input className="input" placeholder="e.g. Analysts' Briefing"
                value={projForm.title} onChange={e => setProjForm(f => ({ ...f, title: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={3} placeholder="Brief description of the project…"
              value={projForm.description} onChange={e => setProjForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div>
            <label className="label">Tags / Services</label>
            <TagInput tags={projForm.tags} onChange={tags => setProjForm(f => ({ ...f, tags }))} />
          </div>

          <div>
            <label className="label">
              Cover Image URL <span className="text-white/30 font-normal text-xs">(optional — auto-uses first gallery image)</span>
            </label>
            <input className="input font-mono text-sm" placeholder="https://…"
              value={projForm.coverImage} onChange={e => setProjForm(f => ({ ...f, coverImage: e.target.value }))} />
          </div>

          {(projForm.coverImage || projForm.images?.[0]?.url) && (
            <div className="w-full aspect-video rounded-xl overflow-hidden border border-white/10 max-h-36">
              <img src={toDisplay(projForm.coverImage || projForm.images[0]?.url)}
                alt="Cover preview" className="w-full h-full object-cover"
                onError={e => { e.target.style.opacity = 0.2; }} />
            </div>
          )}

          <div>
            <label className="label">Gallery Images</label>
            <ImageListEditor
              images={projForm.images}
              onChange={images => setProjForm(f => ({ ...f, images }))}
            />
          </div>

          {/* Toggles */}
          <div className="flex gap-3">
            <div onClick={() => setProjForm(f => ({ ...f, featured: !f.featured }))}
              className={`flex-1 flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                ${projForm.featured ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-white/10'}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                ${projForm.featured ? 'border-primary bg-primary' : 'border-white/30'}`}>
                {projForm.featured && <span className="text-white text-[9px] font-bold">✓</span>}
              </div>
              <div>
                <p className={`text-xs font-medium ${projForm.featured ? 'text-primary' : 'text-white/60'}`}>Pin as Featured Hero</p>
                <p className="text-white/30 text-[10px]">Shows as the large top card</p>
              </div>
            </div>
            <div onClick={() => setProjForm(f => ({ ...f, isActive: !f.isActive }))}
              className={`flex-1 flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
                ${projForm.isActive ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                ${projForm.isActive ? 'border-green-400 bg-green-400' : 'border-white/30'}`}>
                {projForm.isActive && <span className="text-white text-[9px] font-bold">✓</span>}
              </div>
              <div>
                <p className={`text-xs font-medium ${projForm.isActive ? 'text-green-400' : 'text-white/60'}`}>
                  {projForm.isActive ? 'Visible on site' : 'Hidden from public'}
                </p>
                <p className="text-white/30 text-[10px]">Toggle visibility</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1 border-t border-white/10">
            <button onClick={() => setShowProj(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={saveProject} disabled={savingProj} className="btn-primary flex-1 justify-center">
              <Save className="w-4 h-4" /> {savingProj ? 'Saving…' : editingProj ? 'Save Changes' : 'Add Project'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ══ DELETE CONFIRM ══ */}
      <Modal isOpen={!!delTarget} onClose={() => setDelTarget(null)} title="Delete Project?">
        {delTarget && (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 font-semibold text-sm">"{delTarget.title}"</p>
              <p className="text-white/40 text-xs mt-1">Permanently removes this project and cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDelTarget(null)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={deleteProject} disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}