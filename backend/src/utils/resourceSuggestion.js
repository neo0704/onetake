const suggestResources = ({ attendees, videoType, services = {} }) => {
  const equipment = [];
  const manpower = [];
  const count = attendees || 50;

  // ── 1. Multi-Camera Live Event Coverage & Live Streaming ──────────────────
  if (services.liveStreaming) {
    equipment.push({ name: 'Cinema Camera (4K)', quantity: 3, category: 'video' });
    equipment.push({ name: 'Camera Tripod / Fluid Head', quantity: 3, category: 'video' });
    equipment.push({ name: 'Video Switcher / Mixer', quantity: 1, category: 'video' });
    equipment.push({ name: 'Live Streaming Encoder', quantity: 1, category: 'video' });
    equipment.push({ name: 'Laptop (Streaming)', quantity: 1, category: 'video' });
    equipment.push({ name: 'Wireless Microphone', quantity: 4, category: 'sounds' });
    equipment.push({ name: 'LED Video Light', quantity: 4, category: 'lights' });

    if (count > 200) {
      equipment.push({ name: 'Cinema Camera (4K)', quantity: 2, category: 'video' });
      equipment.push({ name: 'Jib / Crane Arm', quantity: 1, category: 'video' });
    }

    manpower.push({ role: 'Lead Videographer', quantity: 1 });
    manpower.push({ role: 'Camera Operator', quantity: count <= 100 ? 2 : 3 });
    manpower.push({ role: 'Live Stream Director / Encoder', quantity: 1 });
    manpower.push({ role: 'Production Assistant', quantity: 2 });
  }

  // ── 2. Events Digital Documentation (Photo & Video) ───────────────────────
  if (services.documentation) {
    equipment.push({ name: 'Cinema Camera (4K)', quantity: 2, category: 'video' });
    equipment.push({ name: 'DSLR / Mirrorless Camera', quantity: 2, category: 'photography' });
    equipment.push({ name: 'Camera Lens Set', quantity: 2, category: 'photography' });
    equipment.push({ name: 'Flash Speedlight', quantity: 3, category: 'photography' });
    equipment.push({ name: 'Gimbal Stabilizer', quantity: 1, category: 'video' });
    equipment.push({ name: 'LED Video Light', quantity: 2, category: 'lights' });

    manpower.push({ role: 'Lead Photographer', quantity: 1 });
    manpower.push({ role: 'Videographer', quantity: 1 });
    if (count > 150) {
      manpower.push({ role: 'Assistant Photographer', quantity: 1 });
    }
    manpower.push({ role: 'Production Assistant', quantity: 1 });
  }

  // ── 3. Wedding, Debut & Birthday Coverage with Livestream ─────────────────
  if (services.weddingDebut) {
    equipment.push({ name: 'Cinema Camera (4K)', quantity: 2, category: 'video' });
    equipment.push({ name: 'DSLR / Mirrorless Camera', quantity: 2, category: 'photography' });
    equipment.push({ name: 'Camera Lens Set', quantity: 2, category: 'photography' });
    equipment.push({ name: 'Gimbal Stabilizer', quantity: 1, category: 'video' });
    equipment.push({ name: 'Drone Camera', quantity: 1, category: 'video' });
    equipment.push({ name: 'Flash Speedlight', quantity: 4, category: 'photography' });
    equipment.push({ name: 'LED Video Light', quantity: 3, category: 'lights' });
    equipment.push({ name: 'Laptop (Editing / SDE)', quantity: 1, category: 'video' });
    equipment.push({ name: 'Live Streaming Encoder', quantity: 1, category: 'video' });

    manpower.push({ role: 'Lead Photographer', quantity: 1 });
    manpower.push({ role: 'Lead Videographer / SDE Editor', quantity: 1 });
    manpower.push({ role: 'Camera Operator', quantity: 1 });
    manpower.push({ role: 'Drone Pilot', quantity: 1 });
    manpower.push({ role: 'Live Stream Operator', quantity: 1 });
    manpower.push({ role: 'Production Assistant', quantity: 2 });
  }

  // ── 4. Video Production Services ──────────────────────────────────────────
  if (services.videoProduction) {
    equipment.push({ name: 'Cinema Camera (4K)', quantity: 2, category: 'video' });
    equipment.push({ name: 'Camera Lens Set (Cinema)', quantity: 1, category: 'video' });
    equipment.push({ name: 'Gimbal Stabilizer', quantity: 1, category: 'video' });
    equipment.push({ name: 'Slider / Dolly', quantity: 1, category: 'video' });
    equipment.push({ name: 'LED Video Light', quantity: 4, category: 'lights' });
    equipment.push({ name: 'Wireless Microphone', quantity: 2, category: 'sounds' });
    equipment.push({ name: 'Boom Microphone', quantity: 1, category: 'sounds' });
    equipment.push({ name: 'Laptop (Editing)', quantity: 1, category: 'video' });
    equipment.push({ name: 'Portable Monitor', quantity: 1, category: 'video' });

    manpower.push({ role: 'Director / Director of Photography', quantity: 1 });
    manpower.push({ role: 'Camera Operator', quantity: 1 });
    manpower.push({ role: 'Video Editor', quantity: 1 });
    manpower.push({ role: 'Lighting Technician', quantity: 1 });
    manpower.push({ role: 'Production Assistant', quantity: 2 });
  }

  // De-duplicate manpower roles
  const manpowerMap = {};
  manpower.forEach(({ role, quantity }) => {
    manpowerMap[role] = (manpowerMap[role] || 0) + quantity;
  });
  const dedupedManpower = Object.entries(manpowerMap).map(([role, quantity]) => ({ role, quantity }));

  return { equipment, manpower: dedupedManpower };
};

module.exports = { suggestResources };
