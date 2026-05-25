import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      default: "",
    },
    file: {
      type: String, // base64 string
      default: "",
    },
    fileType: {
      type: String, // 'image' | 'video' | 'file'
      default: "",
    },
    fileName: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// Indexes for fast history queries
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
