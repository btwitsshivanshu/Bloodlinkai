// ============================================================
// Chat Message Model - Real-time messaging
// ============================================================
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    index: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  senderName: {
    type: String,
    required: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000,
  },
  read: {
    type: Boolean,
    default: false,
  },
  messageType: {
    type: String,
    enum: ['text', 'system', 'image'],
    default: 'text',
  },
}, {
  timestamps: true,
});

// Indexes for fast message retrieval
chatMessageSchema.index({ conversationId: 1, createdAt: 1 });
chatMessageSchema.index({ senderId: 1 });
chatMessageSchema.index({ receiverId: 1 });
chatMessageSchema.index({ read: 1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
