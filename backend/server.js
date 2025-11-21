const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 60000,
  socketTimeoutMS: 60000,
  family: 4
})
.then(() => console.log('✅ Conectado a MongoDB'))
.catch(err => {
  console.error('❌ Error conectando a MongoDB:', err.message);
  console.log('⚠️ El servidor continuará ejecutándose, pero las operaciones de BD fallarán');
});
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB desconectado. Intentando reconectar...');
});
mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconectado');
});
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/maps', require('./routes/maps'));
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  });
}
module.exports = app;
