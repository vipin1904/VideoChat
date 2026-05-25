import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getStreamToken, getMessages, sendMessage } from "../controllers/chat.controller.js";

const router = express.Router();

router.get("/token", protectRoute, getStreamToken);
router.get("/messages/:id", protectRoute, getMessages);
router.post("/messages/send/:id", protectRoute, sendMessage);

export default router;
