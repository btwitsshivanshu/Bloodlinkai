// ============================================================
// Chat Routes - Conversations & Messages
// ============================================================
const express = require('express');
const { body } = require('express-validator');
const chatController = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

// GET /api/chat/conversations - Get all conversations for user
router.get('/conversations', chatController.getConversations);

// POST /api/chat/conversations - Start a new conversation
router.post('/conversations', [
  body('participantId').notEmpty().withMessage('Participant ID is required'),
  validate,
], chatController.createConversation);

// GET /api/chat/conversations/:id/messages - Get messages for a conversation
router.get('/conversations/:id/messages', chatController.getMessages);

// POST /api/chat/conversations/:id/messages - Send a message
router.post('/conversations/:id/messages', [
  body('content').trim().notEmpty().withMessage('Message content is required'),
  validate,
], chatController.sendMessage);

// PUT /api/chat/conversations/:id/read - Mark messages as read
router.put('/conversations/:id/read', chatController.markAsRead);

module.exports = router;
