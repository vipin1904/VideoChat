import { generateStreamToken } from "../lib/stream.js";
import Message from "../models/Message.js";

export async function getStreamToken(req, res) {
  try {
    const token = generateStreamToken(req.user._id);

    res.status(200).json({ token });
  } catch (error) {
    console.log("Error in getStreamToken controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getMessages(req, res) {
  try {
    const { id: targetUserId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function sendMessage(req, res) {
  try {
    const { id: receiverId } = req.params;
    const { text, file, fileType, fileName } = req.body;
    const senderId = req.user._id;

    const hasText = text && text.trim() !== "";
    const hasFile = file && file.trim() !== "";

    if (!hasText && !hasFile) {
      return res.status(400).json({ message: "Message content or file is required" });
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      text: text ? text.trim() : "",
      file: file || "",
      fileType: fileType || "",
      fileName: fileName || "",
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
