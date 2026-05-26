import { generateStreamToken, upsertStreamUser } from "../lib/stream.js";
import User from "../models/User.js";

export async function getStreamToken(req, res) {
  try {
    // 1. Ensure current user is registered in Stream
    await upsertStreamUser({
      id: req.user.id.toString(),
      name: req.user.fullName,
      image: req.user.profilePic || "",
    });

    // 2. Ensure target user is registered in Stream if specified
    const { targetUserId } = req.query;
    if (targetUserId) {
      try {
        const targetUser = await User.findById(targetUserId);
        if (targetUser) {
          await upsertStreamUser({
            id: targetUser._id.toString(),
            name: targetUser.fullName,
            image: targetUser.profilePic || "",
          });
          console.log(`Stream user upserted for chat partner: ${targetUser.fullName}`);
        }
      } catch (err) {
        console.error("Error upserting target chat user in Stream:", err.message);
      }
    }

    const token = generateStreamToken(req.user.id);

    res.status(200).json({ token });
  } catch (error) {
    console.log("Error in getStreamToken controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
