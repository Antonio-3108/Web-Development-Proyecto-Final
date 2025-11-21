const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  bio: { type: String, default: '' },
  profileImage: { type: String, default: '' }, 
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    mapsCreated: { type: Number, default: 0 },
    postsCreated: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('User', userSchema, 'players');
