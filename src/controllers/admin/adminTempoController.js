const TempoTraveller = require('../../models/TempoTraveller');
const { getFileUrl } = require('../../middleware/upload');

exports.getAllTempos = async (req, res) => {
  try {
    const tempos = await TempoTraveller.find().sort({ showOnTop: -1, createdAt: -1 });
    res.json({ success: true, data: tempos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTempoById = async (req, res) => {
  try {
    const tempo = await TempoTraveller.findById(req.params.id);
    if (!tempo) return res.status(404).json({ success: false, message: 'Tempo not found' });
    res.json({ success: true, data: tempo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createTempo = async (req, res) => {
  try {
    const images = (req.files || []).map(getFileUrl).filter(Boolean);
    const tempo = new TempoTraveller({ ...req.body, images });
    await tempo.save();
    res.status(201).json({ success: true, data: tempo, message: 'Tempo Traveller added successfully' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Registration number already exists' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateTempo = async (req, res) => {
  try {
    const tempo = await TempoTraveller.findById(req.params.id);
    if (!tempo) return res.status(404).json({ success: false, message: 'Tempo not found' });

    const updates = { ...req.body };
    if (req.files && req.files.length > 0) {
      updates.images = req.files.map(getFileUrl).filter(Boolean);
    }
    Object.assign(tempo, updates);
    await tempo.save();
    res.json({ success: true, data: tempo, message: 'Tempo updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteTempo = async (req, res) => {
  try {
    const tempo = await TempoTraveller.findByIdAndDelete(req.params.id);
    if (!tempo) return res.status(404).json({ success: false, message: 'Tempo not found' });
    res.json({ success: true, message: 'Tempo deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.toggleTempoStatus = async (req, res) => {
  try {
    const tempo = await TempoTraveller.findById(req.params.id);
    if (!tempo) return res.status(404).json({ success: false, message: 'Tempo not found' });
    tempo.isActive = !tempo.isActive;
    await tempo.save();
    res.json({ success: true, data: { isActive: tempo.isActive }, message: `Tempo ${tempo.isActive ? 'shown' : 'hidden'}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
