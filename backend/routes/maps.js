const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Map = require('../models/Map');
const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');
const CloudinaryStorage = require('multer-storage-cloudinary').CloudinaryStorage;

// Storage dinámico que cambia según el fieldname
const dynamicStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: (req, file) => {
    if (file.fieldname === 'mapFile') {
      return {
        folder: 'maps/files',
        allowed_formats: ['json'],
        resource_type: 'raw'
      };
    } else if (file.fieldname === 'mapImage') {
      return {
        folder: 'maps/images',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        resource_type: 'image'
      };
    }
  }
});

const upload = multer({
  storage: dynamicStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.fieldname === 'mapFile') {
      const allowedExts = ['.json', '.map'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedExts.includes(ext) || file.mimetype === 'application/json') {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos .json o .map'));
      }
    } else if (file.fieldname === 'mapImage') {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Solo se permiten archivos de imagen'));
      }
    } else {
      cb(new Error('Campo de archivo no válido'));
    }
  }
});
router.get('/', async (req, res) => {
  try {
    const maps = await Map.find()
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(maps);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener mapas', error: error.message });
  }
});
router.get('/popular', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const maps = await Map.find()
      .sort({ upvotes: -1, plays: -1 })
      .limit(limit);
    res.json(maps);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener mapas populares', error: error.message });
  }
});
router.get('/:mapId', async (req, res) => {
  try {
    const map = await Map.findById(req.params.mapId);
    if (!map) {
      return res.status(404).json({ message: 'Mapa no encontrado' });
    }
    res.json(map);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener mapa', error: error.message });
  }
});
router.get('/user/:userId', async (req, res) => {
  try {
    const maps = await Map.find({ author: req.params.userId })
      .sort({ createdAt: -1 });
    res.json(maps);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener mapas del usuario', error: error.message });
  }
});
router.post('/upload', upload.fields([
  { name: 'mapFile', maxCount: 1 },
  { name: 'mapImage', maxCount: 1 }
]), async (req, res) => {
  try {
    const { userId, name, description } = req.body;
    
    if (!req.files || !req.files.mapFile || !req.files.mapImage) {
      return res.status(400).json({ message: 'Se requieren ambos archivos: mapa e imagen' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const map = new Map({
      name,
      description: description || '',
      author: userId,
      authorUsername: user.username,
      mapFile: req.files.mapFile[0].path,
      mapImage: req.files.mapImage[0].path
    });
    
    await map.save();
    user.stats.mapsCreated++;
    await user.save();
    
    res.status(201).json(map);
  } catch (error) {
    res.status(500).json({ message: 'Error al subir mapa', error: error.message });
  }
});
router.post('/:mapId/play', async (req, res) => {
  try {
    const map = await Map.findById(req.params.mapId);
    if (!map) {
      return res.status(404).json({ message: 'Mapa no encontrado' });
    }
    map.plays++;
    await map.save();
    res.json(map);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar jugadas', error: error.message });
  }
});
router.post('/:mapId/rate', async (req, res) => {
  try {
    const { userId, rating } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'La calificación debe estar entre 1 y 5' });
    }
    const map = await Map.findById(req.params.mapId);
    if (!map) {
      return res.status(404).json({ message: 'Mapa no encontrado' });
    }
    const existingRating = map.ratings.find(r => r.user.toString() === userId);
    if (existingRating) {
      existingRating.value = rating;
    } else {
      map.ratings.push({ user: userId, value: rating });
    }
    map.calculateAverageRating();
    await map.save();
    res.json(map);
  } catch (error) {
    res.status(500).json({ message: 'Error al calificar mapa', error: error.message });
  }
});
router.put('/:mapId', async (req, res) => {
  try {
    const { userId, name, description } = req.body;
    const mapId = req.params.mapId;
    if (!userId) {
      return res.status(400).json({ message: 'userId es requerido' });
    }
    const map = await Map.findById(mapId);
    if (!map) {
      return res.status(404).json({ message: 'Mapa no encontrado' });
    }
    if (map.author.toString() !== userId) {
      return res.status(403).json({ message: 'No tienes permiso para editar este mapa' });
    }
    if (name !== undefined && name.trim()) {
      map.name = name.trim();
    }
    if (description !== undefined) {
      map.description = description.trim();
    }
    await map.save();
    res.json({
      message: 'Mapa actualizado exitosamente',
      map
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al editar mapa', error: error.message });
  }
});
router.post('/:mapId/upvote', async (req, res) => {
  try {
    const mapId = req.params.mapId;
    const map = await Map.findById(mapId);
    if (!map) {
      return res.status(404).json({ message: 'Mapa no encontrado' });
    }
    map.upvotes++;
    await map.save();
    res.json({
      upvotes: map.upvotes,
      message: 'Upvote agregado'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al dar upvote', error: error.message });
  }
});
router.post('/:mapId/downvote', async (req, res) => {
  try {
    const mapId = req.params.mapId;
    const map = await Map.findById(mapId);
    if (!map) {
      return res.status(404).json({ message: 'Mapa no encontrado' });
    }
    if (map.upvotes > 0) {
      map.upvotes--;
    }
    await map.save();
    res.json({
      upvotes: map.upvotes,
      message: 'Upvote removido'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al quitar upvote', error: error.message });
  }
});
router.delete('/:mapId', async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: 'userId es requerido' });
    }
    
    const map = await Map.findById(req.params.mapId);
    if (!map) {
      return res.status(404).json({ message: 'Mapa no encontrado' });
    }
    
    if (map.author.toString() !== userId) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar este mapa' });
    }
    
    // Eliminar archivos de Cloudinary
    try {
      if (map.mapFile && map.mapFile.includes('cloudinary')) {
        const publicId = map.mapFile.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
      }
      if (map.mapImage && map.mapImage.includes('cloudinary')) {
        const publicId = map.mapImage.split('/').slice(-2).join('/').split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      }
    } catch (err) {
      console.log('Error eliminando archivos de Cloudinary:', err.message);
    }
    
    await Map.findByIdAndDelete(req.params.mapId);
    
    const user = await User.findById(userId);
    if (user && user.stats.mapsCreated > 0) {
      user.stats.mapsCreated--;
      await user.save();
    }
    
    res.json({ message: 'Mapa eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar mapa', error: error.message });
  }
});
module.exports = router;
