const cloudinary = require('cloudinary').v2;
const multerCloudinary = require('multer-storage-cloudinary');
const CloudinaryStorage = multerCloudinary.CloudinaryStorage || multerCloudinary;

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Storage para imágenes de perfil
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit' }]
  }
});

// Storage para imágenes de mapas
const mapImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'maps/images',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
  }
});

// Storage para archivos de mapas (JSON)
const mapFileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'maps/files',
    allowed_formats: ['json'],
    resource_type: 'raw'
  }
});

module.exports = {
  cloudinary,
  profileStorage,
  mapImageStorage,
  mapFileStorage
};
