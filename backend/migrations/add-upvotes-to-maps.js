const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB'))
  .catch(err => {
    process.exit(1);
  });
const Map = require('../models/Map');
async function migrateUpvotes() {
  try {
    const mapsWithoutUpvotes = await Map.countDocuments({
      upvotes: { $exists: false }
    });
    if (mapsWithoutUpvotes === 0) {
      process.exit(0);
    }
    const result = await Map.updateMany(
      { upvotes: { $exists: false } },
      { 
        $set: { 
          upvotes: 0,
          upvotedBy: []
        }
      }
    );
    const totalMaps = await Map.countDocuments();
    const mapsWithUpvotes = await Map.countDocuments({
      upvotes: { $exists: true }
    });
    if (totalMaps === mapsWithUpvotes) {
    } else {
    }
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}
migrateUpvotes();
