const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
router.get('/', async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener posts', error: error.message });
  }
});
router.get('/user/:userId', async (req, res) => {
  try {
    const posts = await Post.find({ author: req.params.userId })
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener posts del usuario', error: error.message });
  }
});
router.post('/', async (req, res) => {
  try {
    const { userId, content } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    const post = new Post({
      author: userId,
      authorUsername: user.username,
      content
    });
    await post.save();
    user.stats.postsCreated++;
    await user.save();
    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ message: 'Error al crear post', error: error.message });
  }
});
router.post('/:postId/like', async (req, res) => {
  try {
    const { userId } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post no encontrado' });
    }
    const alreadyLiked = post.likedBy.includes(userId);
    if (alreadyLiked) {
      post.likedBy = post.likedBy.filter(id => id.toString() !== userId);
      post.likes--;
    } else {
      post.likedBy.push(userId);
      post.likes++;
    }
    await post.save();
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Error al dar like', error: error.message });
  }
});
router.delete('/:postId', async (req, res) => {
  try {
    const { userId } = req.body;
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post no encontrado' });
    }
    if (post.author.toString() !== userId) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar este post' });
    }
    await Post.findByIdAndDelete(req.params.postId);
    const user = await User.findById(userId);
    if (user && user.stats.postsCreated > 0) {
      user.stats.postsCreated--;
      await user.save();
    }
    res.json({ message: 'Post eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar post', error: error.message });
  }
});
module.exports = router;
