const Settings = require('../../models/Settings');

const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findById('global');
    if (!settings) settings = await Settings.create({ _id: 'global' });
    return res.json({ success: true, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const settings = await Settings.findByIdAndUpdate(
      'global',
      { $set: req.body },
      { new: true, upsert: true, runValidators: true }
    );
    return res.json({ success: true, data: settings, message: 'Settings saved successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to save settings' });
  }
};

module.exports = { getSettings, updateSettings };
