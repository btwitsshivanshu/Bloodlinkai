// ============================================================
// Chat Controller - Real-time messaging
// ============================================================
const ChatMessage = require('../models/ChatMessage');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

/**
 * GET /api/chat/conversations - Get user's conversations
 */
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.userId,
    })
      .populate('participants', 'name email avatar')
      .sort({ lastMessageAt: -1 });

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
};

/**
 * POST /api/chat/conversations - Start new conversation
 */
exports.createConversation = async (req, res) => {
  try {
    const { participantId } = req.body;

    // Check if conversation already exists
    const existing = await Conversation.findOne({
      participants: { $all: [req.userId, participantId] },
    });

    if (existing) {
      return res.json({ conversation: existing, existing: true });
    }

    const otherUser = await User.findById(participantId);
    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const conversation = await Conversation.create({
      participants: [req.userId, participantId],
      participantNames: [req.user.name, otherUser.name],
      lastMessage: '',
      unreadCount: new Map([[req.userId.toString(), 0], [participantId.toString(), 0]]),
    });

    await conversation.populate('participants', 'name email avatar');

    res.status(201).json({ conversation });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
};

/**
 * GET /api/chat/conversations/:id/messages - Get messages
 */
exports.getMessages = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await ChatMessage.find({
      conversationId: req.params.id,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Return in chronological order
    messages.reverse();

    res.json({ messages });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

/**
 * POST /api/chat/conversations/:id/messages - Send a message
 */
exports.sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    const conversationId = req.params.id;

    // Verify user is part of conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const isParticipant = conversation.participants.some(
      p => p.toString() === req.userId.toString()
    );
    if (!isParticipant) {
      return res.status(403).json({ error: 'Not a participant of this conversation' });
    }

    // Find receiver (the other participant)
    const receiverId = conversation.participants.find(
      p => p.toString() !== req.userId.toString()
    );

    const message = await ChatMessage.create({
      conversationId,
      senderId: req.userId,
      senderName: req.user.name,
      receiverId,
      content,
    });

    // Update conversation
    conversation.lastMessage = content;
    conversation.lastMessageAt = new Date();
    // Increment unread count for receiver
    const currentUnread = conversation.unreadCount.get(receiverId.toString()) || 0;
    conversation.unreadCount.set(receiverId.toString(), currentUnread + 1);
    await conversation.save();

    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(receiverId.toString()).emit('new-message', {
        message,
        conversationId,
      });
    }

    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

/**
 * PUT /api/chat/conversations/:id/read - Mark messages as read
 */
exports.markAsRead = async (req, res) => {
  try {
    const conversationId = req.params.id;

    // Mark all messages in this conversation as read for the current user
    await ChatMessage.updateMany(
      {
        conversationId,
        receiverId: req.userId,
        read: false,
      },
      { $set: { read: true } }
    );

    // Reset unread count
    const conversation = await Conversation.findById(conversationId);
    if (conversation) {
      conversation.unreadCount.set(req.userId.toString(), 0);
      await conversation.save();
    }

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
};
