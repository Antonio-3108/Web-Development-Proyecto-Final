
const express = require('express');
const router = express.Router();
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');

// Configure Cloudinary from env (if present)
const isCloudinaryConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Use memory storage so we DON'T try to create folders on disk (Vercel is read-only)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Route para subir imagen de perfil
// Espera un campo multipart/form-data llamado "profile"
router.post('/profile', upload.single('profile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se recibió ningún archivo.' });
    }

    // Si Cloudinary está configurado, subimos ahí desde el buffer
    if (isCloudinaryConfigured) {
      const streamUpload = (buffer) => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'profiles' },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );
          streamifier.createReadStream(buffer).pipe(stream);
        });
      };

      const result = await streamUpload(req.file.buffer);

      // Guardar URL en usuario (ajusta según tu modelo)
      const userId = req.body.userId;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

      user.profileImage = result.secure_url;
      await user.save();

      return res.json({
        message: 'Imagen subida exitosamente a Cloudinary',
        imageUrl: result.secure_url,
        raw: result
      });
    }

    // Si Cloudinary NO está configurado, devolvemos error con instrucciones
    return res.status(500).json({
      message:
        'No hay un servicio de almacenamiento configurado. En Vercel no se permite escribir en el filesystem. ' +
        'Configura Cloudinary, S3 o similar. Ejemplo: set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.'
    });
  } catch (error) {
    console.error('Error en /upload/profile:', error);
    res.status(500).json({ message: 'Error al subir imagen', error: error.message });
  }
});

module.exports = router;
