const express = require('express');
const router = express.Router();
const multer = require('multer');
const User = require('../models/User');

// Verificar si Cloudinary está configurado
const isCloudinaryConfigured = 
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET;

let upload;

if (isCloudinaryConfigured) {
  // Usar Cloudinary si está configurado
  const cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });

  const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'profiles',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      transformation: [{ width: 500, height: 500, crop: 'limit' }]
    }
  });

  upload = multer({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024 
    }
  });
} else {
  // Usar memoria temporal si Cloudinary no está configurado
  console.warn('⚠️ Cloudinary no configurado. Usando almacenamiento en memoria (no recomendado para producción)');
  
  const storage = multer.memoryStorage();
  
  upload = multer({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024 
    },
    fileFilter: function (req, file, cb) {
      const allowedTypes = /jpeg|jpg|png|gif|webp/;
      const mimetype = allowedTypes.test(file.mimetype);
      if (mimetype) {
        return cb(null, true);
      } else {
        cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
      }
    }
  });
}

router.post('/profile/:userId', upload.single('profileImage'), async (req, res) => {
  try {
    if (!isCloudinaryConfigured) {
      return res.status(503).json({ 
        message: 'Servicio de uploads no configurado. Por favor configura las variables de entorno de Cloudinary.',
        error: 'CLOUDINARY_NOT_CONFIGURED'
      });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No se subió ninguna imagen' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Si el usuario ya tiene una imagen, eliminarla de Cloudinary
    if (user.profileImage && user.profileImage.includes('cloudinary')) {
      try {
        const cloudinary = require('cloudinary').v2;
        // Extraer el public_id de la URL de Cloudinary
        const urlParts = user.profileImage.split('/');
        const publicIdWithExt = urlParts[urlParts.length - 1];
        const publicId = `profiles/${publicIdWithExt.split('.')[0]}`;
        await cloudinary.uploader.destroy(publicId);
      } catch (error) {
        console.error('Error al eliminar imagen anterior:', error);
      }
    }

    // Guardar la URL de Cloudinary
    user.profileImage = req.file.path;
    await user.save();

    res.json({ 
      message: 'Imagen subida exitosamente',
      imageUrl: req.file.path
    });
  } catch (error) {
    console.error('Error en upload:', error);
    res.status(500).json({ message: 'Error al subir imagen', error: error.message });
  }
});

module.exports = router;
