const HomepageContent = require('../models/HomepageContent');
const Event            = require('../models/Event');

/** Singleton helper — always returns the one homepage document, creating it if needed */
const getDoc = async () => {
  let doc = await HomepageContent.findOne();
  if (!doc) doc = await HomepageContent.create({ portfolio: [] });
  return doc;
};

// ── GET /homepage ── (public)
exports.getContent = async (req, res) => {
  try {
    const doc = await getDoc();
    res.json({ success: true, content: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /homepage/reviews ── (public)
// Client feedback the admin has chosen to feature — never every rating
// automatically, since a client's comment isn't reviewed before it's written.
exports.getReviews = async (req, res) => {
  try {
    const events = await Event.find({ 'feedback.featured': true, 'feedback.rating': { $exists: true } })
      .populate('client', 'name')
      .select('eventName eventCategory feedback client')
      .sort({ 'feedback.submittedAt': -1 })
      .limit(24);

    const reviews = events.map(e => ({
      id:            e._id,
      clientName:    e.client?.name || 'Client',
      eventName:     e.eventName,
      eventCategory: e.eventCategory,
      rating:        e.feedback.rating,
      comment:       e.feedback.comment,
      submittedAt:   e.feedback.submittedAt,
    }));

    res.json({ success: true, reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /homepage/video ── (admin)
exports.updateVideo = async (req, res) => {
  try {
    const doc = await getDoc();
    const { isActive, url, title, subtitle } = req.body;
    if (isActive  !== undefined) doc.featuredVideo.isActive = isActive;
    if (url       !== undefined) doc.featuredVideo.url      = url;
    if (title     !== undefined) doc.featuredVideo.title    = title;
    if (subtitle  !== undefined) doc.featuredVideo.subtitle = subtitle;
    await doc.save();
    res.json({ success: true, content: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /homepage/portfolio ── (admin)
exports.addProject = async (req, res) => {
  try {
    const doc = await getDoc();
    const maxOrder = doc.portfolio.reduce((m, p) => Math.max(m, p.order ?? 0), -1);
    doc.portfolio.push({ ...req.body, order: maxOrder + 1 });
    await doc.save();
    res.json({ success: true, content: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /homepage/portfolio/reorder ── (admin)
// Body: { order: [{ id: '...', order: 0 }, ...] }
exports.reorderProjects = async (req, res) => {
  try {
    const { order } = req.body;
    const doc = await getDoc();
    (order || []).forEach(({ id, order: ord }) => {
      const proj = doc.portfolio.id(id);
      if (proj) proj.order = ord;
    });
    await doc.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PUT /homepage/portfolio/:projectId ── (admin)
exports.updateProject = async (req, res) => {
  try {
    const doc  = await getDoc();
    const proj = doc.portfolio.id(req.params.projectId);
    if (!proj) return res.status(404).json({ success: false, message: 'Project not found' });
    Object.assign(proj, req.body);
    await doc.save();
    res.json({ success: true, content: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE /homepage/portfolio/:projectId ── (admin)
exports.deleteProject = async (req, res) => {
  try {
    const doc = await getDoc();
    doc.portfolio.pull({ _id: req.params.projectId });
    await doc.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};