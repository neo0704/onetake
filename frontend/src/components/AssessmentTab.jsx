import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, Users, FileText } from 'lucide-react';
import { RATE_CARD, SERVICE_LABELS } from '../utils/rateCard';

// Packages in the "Additional Services" group are add-ons, not main packages.
// A main package is limited to one; additional services are unlimited.
const ADDITIONAL_IDS = new Set(
  RATE_CARD.filter(g => /additional/i.test(g.group)).flatMap(g => g.packages.map(p => p.id))
);

export default function AssessmentTab({ event, saving, onSave }) {
  const [oldMultiCount, setOldMultiCount] = useState(0);
  const [form, setForm] = useState({
    attendees:       '',
    videoType:       '',
    specialRequests: '',
    notes:           '',
    selectedPackages:[],
    customItems:     [],
  });

  // Pre-fill from existing assessment if already saved
  useEffect(() => {
    if (event?.needsAssessment) {
      const na = event.needsAssessment;
      // Older assessments may have saved several packages. Only one is allowed now,
      // so start empty and make the admin pick one instead of guessing.
      const savedPkgs  = na.selectedPackages || [];
      const savedMains = savedPkgs.filter(id => !ADDITIONAL_IDS.has(id));
      setOldMultiCount(savedMains.length > 1 ? savedMains.length : 0);
      setForm({
        attendees:        na.attendees       || event.attendees || '',
        videoType:        na.videoType       || event.videoType || '',
        specialRequests:  na.specialRequests || event.specialRequests || '',
        notes:            na.notes           || '',
        selectedPackages: savedMains.length > 1 ? savedPkgs.filter(id => ADDITIONAL_IDS.has(id)) : savedPkgs,
        customItems:      na.customItems     || [],
      });
    } else {
      setForm(f => ({
        ...f,
        attendees:       event?.attendees       || '',
        specialRequests: event?.specialRequests || '',
      }));
    }
  }, [event?._id]);

  // ONE main package (picking another replaces it) + any number of additional services.
  const togglePackage = (pkgId) => {
    if (!ADDITIONAL_IDS.has(pkgId)) setOldMultiCount(0);
    setForm(f => {
      const cur = f.selectedPackages;
      if (cur.includes(pkgId)) return { ...f, selectedPackages: cur.filter(id => id !== pkgId) };
      if (ADDITIONAL_IDS.has(pkgId)) return { ...f, selectedPackages: [...cur, pkgId] };
      return { ...f, selectedPackages: [pkgId, ...cur.filter(id => ADDITIONAL_IDS.has(id))] };
    });
  };

  const addCustomItem = () => setForm(f => ({
    ...f, customItems: [...f.customItems, { name: '', description: '' }]
  }));
  const updateCustomItem = (i, key, val) => setForm(f => ({
    ...f, customItems: f.customItems.map((ci, idx) => idx === i ? { ...ci, [key]: val } : ci)
  }));
  const removeCustomItem = (i) => setForm(f => ({
    ...f, customItems: f.customItems.filter((_, idx) => idx !== i)
  }));


  // Client's originally requested services (from inquiry)
  const clientServices = Object.entries(event?.services || {})
    .filter(([, v]) => v)
    .map(([k]) => SERVICE_LABELS[k] || k);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.selectedPackages.filter(id => !ADDITIONAL_IDS.has(id)).length > 1) return; // safety net
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Client's requested services (read-only) ── */}
      {clientServices.length > 0 && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Client requested services (from inquiry)
          </p>
          <div className="flex flex-wrap gap-2">
            {clientServices.map(svc => (
              <span key={svc} className="badge bg-blue-500/20 text-blue-300 text-xs">{svc}</span>
            ))}
          </div>
          {event?.specialRequests && (
            <p className="text-white/50 text-xs mt-2 italic">
              Special requests: "{event.specialRequests}"
            </p>
          )}
        </div>
      )}

      {/* ── Meeting details ── */}
      <div className="card">
        <h3 className="section-title mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" /> Meeting Details
        </h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="label">Confirmed Attendees *</label>
            <input type="number" min="1" className="input" placeholder="e.g. 200"
              value={form.attendees}
              onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} required />
          </div>
          
        </div>
        <div className="mt-3">
          <label className="label">Special Requirements Confirmed</label>
          <textarea className="input min-h-[70px]" placeholder="Requirements confirmed in the meeting..."
            value={form.specialRequests}
            onChange={e => setForm(f => ({ ...f, specialRequests: e.target.value }))} />
        </div>
        <div className="mt-3">
          <label className="label">Meeting Notes</label>
          <textarea className="input min-h-[80px]" placeholder="Key decisions, client preferences, technical notes from the call..."
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </div>

      {/* ── Package selection ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title">Package &amp; Additional Services Agreed in Meeting</h3>
            <p className="text-white/40 text-xs mt-0.5">
              Choose one main package, then add any additional services — they will auto-fill the quotation
            </p>
          </div>
          {form.selectedPackages.length > 0 && (
            <span className="badge bg-primary/20 text-primary">{form.selectedPackages.length} selected</span>
          )}
        </div>
        {oldMultiCount > 1 && (
          <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
            <p className="text-yellow-400 text-xs">
              This assessment previously had {oldMultiCount} main packages, but only one is allowed now. Please choose one below (additional services are kept).
            </p>
          </div>
        )}
</div>
        <div className="space-y-5">
          {RATE_CARD.map((group) => (
            <div key={group.group}>
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">{group.group}</p>
              <div className="space-y-2">
                {group.packages.map(pkg => {
                  const selected = form.selectedPackages.includes(pkg.id);
                  return (
                    <div key={pkg.id}
                      onClick={() => togglePackage(pkg.id)}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                        ${selected
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors
                        ${selected ? 'border-primary bg-primary' : 'border-white/30'}`}>
                        {selected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold leading-snug ${selected ? 'text-white' : 'text-white/70'}`}>
                          {pkg.name}
                        </p>
                        {selected && (
                          <ul className="mt-1.5 space-y-0.5">
                            {pkg.inclusions.map((inc, i) => (
                              <li key={i} className="text-white/50 text-xs flex items-start gap-1.5">
                                <span className="text-primary/60 flex-shrink-0 mt-0.5">✔</span>
                                <span>{inc}</span>
                              </li>
                            ))}
                            {pkg.note && <li className="text-yellow-400/70 text-xs mt-1 italic">{pkg.note}</li>}
                          </ul>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Custom/non-standard items from meeting */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/60 text-sm font-semibold">Custom / Non-Standard Items</p>
              <p className="text-white/30 text-xs">Add-ons or custom setups agreed in the meeting not in the standard rate card</p>
            </div>
            <button type="button" onClick={addCustomItem} className="btn-ghost text-sm">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          {form.customItems.length === 0 && (
            <p className="text-white/30 text-sm text-center py-3">No custom items</p>
          )}
          {form.customItems.map((ci, i) => (
            <div key={i} className="flex gap-2 mb-2 items-start">
              <div className="flex-1 space-y-1.5">
                <input className="input text-sm" placeholder="Item name (e.g. Extra Camera Operator)"
                  value={ci.name}
                  onChange={e => updateCustomItem(i, 'name', e.target.value)} />
                <input className="input text-sm" placeholder="Description or details"
                  value={ci.description}
                  onChange={e => updateCustomItem(i, 'description', e.target.value)} />
              </div>
              <button type="button" onClick={() => removeCustomItem(i)}
                className="text-white/20 hover:text-red-400 transition-colors p-2 flex-shrink-0 mt-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

      {/* Auto-fill notice */}
      {form.selectedPackages.length > 0 && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-2">
          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-400 text-sm">
            <span className="font-semibold">{form.selectedPackages.length} item{form.selectedPackages.length !== 1 ? 's' : ''} selected.</span>
            {' '}When you create the quotation, they will be automatically loaded — no need to re-select them.
          </p>
        </div>
      )}

      <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-3">
        {saving ? 'Saving...' : '✓ Save & Complete Assessment'}
      </button>
    </form>
  );
}