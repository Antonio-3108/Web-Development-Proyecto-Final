const express = require('express');
const router = express.Router();
const User = require('../models/User');
router.get('/test', (req, res) => {
  res.json({ message: 'Users route working!' });
});
router.get('/username/:username', async (req, res) => {
  try {
    const user = await User.findOne({ 
      username: { $regex: new RegExp(`^${req.params.username}$`, 'i') }
    }).select('-password -email');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuario', error: error.message });
  }
});
router.get('/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuario', error: error.message });
  }
});
router.put('/:userId', async (req, res) => {
  try {
    const { username, email, bio } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { username, email, bio },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar usuario', error: error.message });
  }
});
router.patch('/:userId/stats', async (req, res) => {
  try {
    const { gamesPlayed, wins, mapsCreated, postsCreated } = req.body;
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    if (gamesPlayed !== undefined) user.stats.gamesPlayed = gamesPlayed;
    if (wins !== undefined) user.stats.wins = wins;
    if (mapsCreated !== undefined) user.stats.mapsCreated = mapsCreated;
    if (postsCreated !== undefined) user.stats.postsCreated = postsCreated;
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar estadísticas', error: error.message });
  }
});
module.exports = router;
