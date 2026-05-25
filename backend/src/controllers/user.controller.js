import User from "../models/User.js";
import FriendRequest from "../models/FriendRequest.js";

export async function getRecommendedUsers(req, res) {
  try {
    const currentUserId = req.user.id;
    const currentUser = req.user;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const nativeLanguage = req.query.nativeLanguage || "";
    const learningLanguage = req.query.learningLanguage || "";
    const location = req.query.location || "";

    const query = {
      $and: [
        { _id: { $ne: currentUserId } }, //exclude current user
        { _id: { $nin: currentUser.friends } }, // exclude current user's friends
        { isOnboarded: true },
      ],
    };

    if (search) {
      query.$and.push({
        $or: [
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ]
      });
    }

    if (nativeLanguage) {
      query.$and.push({ nativeLanguage: nativeLanguage.toLowerCase() });
    }

    if (learningLanguage) {
      query.$and.push({ learningLanguage: learningLanguage.toLowerCase() });
    }

    if (location) {
      query.$and.push({ location: { $regex: location, $options: "i" } });
    }

    const recommendedUsers = await User.find(query)
      .select("-profilePic")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const totalUsers = await User.countDocuments(query);

    res.status(200).json({
      users: recommendedUsers,
      total: totalUsers,
      page,
      pages: Math.ceil(totalUsers / limit)
    });
  } catch (error) {
    console.error("Error in getRecommendedUsers controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getMyFriends(req, res) {
  try {
    const user = await User.findById(req.user.id)
      .select("friends")
      .populate("friends", "fullName nativeLanguage learningLanguage");

    // Friends sync to Stream Chat to prevent "Member does not exist" errors
    try {
      const { upsertStreamUser, getBackendAvatarUrl } = await import("../lib/stream.js");
      for (const friend of user.friends) {
        try {
          await upsertStreamUser({
            id: friend._id.toString(),
            name: friend.fullName,
            image: getBackendAvatarUrl(friend._id),
          });
        } catch (err) {
          console.error(`Error syncing friend ${friend.fullName} to stream:`, err.message);
        }
      }
    } catch (importErr) {
      console.error("Failed to import stream helpers:", importErr.message);
    }

    res.status(200).json(user.friends);
  } catch (error) {
    console.error("Error in getMyFriends controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function sendFriendRequest(req, res) {
  try {
    const myId = req.user.id;
    const { id: recipientId } = req.params;

    // prevent sending req to yourself
    if (myId === recipientId) {
      return res.status(400).json({ message: "You can't send friend request to yourself" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    // check if user is already friends
    if (recipient.friends.includes(myId)) {
      return res.status(400).json({ message: "You are already friends with this user" });
    }

    // check if a req already exists
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: myId, recipient: recipientId },
        { sender: recipientId, recipient: myId },
      ],
    });

    if (existingRequest) {
      return res
        .status(400)
        .json({ message: "A friend request already exists between you and this user" });
    }

    const friendRequest = await FriendRequest.create({
      sender: myId,
      recipient: recipientId,
    });

    res.status(201).json(friendRequest);
  } catch (error) {
    console.error("Error in sendFriendRequest controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function acceptFriendRequest(req, res) {
  try {
    const { id: requestId } = req.params;

    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ message: "Friend request not found" });
    }

    // Verify the current user is the recipient
    if (friendRequest.recipient.toString() !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to accept this request" });
    }

    friendRequest.status = "accepted";
    await friendRequest.save();

    // add each user to the other's friends array
    // $addToSet: adds elements to an array only if they do not already exist.
    await User.findByIdAndUpdate(friendRequest.sender, {
      $addToSet: { friends: friendRequest.recipient },
    });

    await User.findByIdAndUpdate(friendRequest.recipient, {
      $addToSet: { friends: friendRequest.sender },
    });

    res.status(200).json({ message: "Friend request accepted" });
  } catch (error) {
    console.log("Error in acceptFriendRequest controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function withdrawFriendRequest(req, res) {
  try {
    const myId = req.user.id;
    const { id: recipientId } = req.params;

    const request = await FriendRequest.findOneAndDelete({
      sender: myId,
      recipient: recipientId,
      status: "pending"
    });

    if (!request) {
      return res.status(404).json({ message: "Friend request not found or already accepted" });
    }

    res.status(200).json({ message: "Friend request withdrawn successfully" });
  } catch (error) {
    console.error("Error in withdrawFriendRequest controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getFriendRequests(req, res) {
  try {
    const incomingReqs = await FriendRequest.find({
      recipient: req.user.id,
      status: "pending",
    }).populate("sender", "fullName nativeLanguage learningLanguage");

    const acceptedReqs = await FriendRequest.find({
      sender: req.user.id,
      status: "accepted",
    }).populate("recipient", "fullName");

    res.status(200).json({ incomingReqs, acceptedReqs });
  } catch (error) {
    console.log("Error in getPendingFriendRequests controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function getOutgoingFriendReqs(req, res) {
  try {
    const outgoingRequests = await FriendRequest.find({
      sender: req.user.id,
      status: "pending",
    }).populate("recipient", "fullName nativeLanguage learningLanguage");

    res.status(200).json(outgoingRequests);
  } catch (error) {
    console.log("Error in getOutgoingFriendReqs controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function updateProfile(req, res) {
  try {
    const { profilePic, fullName, email, bio, location, nativeLanguage, learningLanguage } = req.body;
    const userId = req.user.id;

    const updateData = {};
    if (profilePic !== undefined) updateData.profilePic = profilePic;
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;
    if (nativeLanguage !== undefined) updateData.nativeLanguage = nativeLanguage;
    if (learningLanguage !== undefined) updateData.learningLanguage = learningLanguage;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    );

    // Also update stream-chat user
    try {
      const { upsertStreamUser, getBackendAvatarUrl } = await import("../lib/stream.js");
      await upsertStreamUser({
        id: updatedUser._id.toString(),
        name: updatedUser.fullName,
        image: getBackendAvatarUrl(updatedUser._id),
      });
    } catch (e) {
      console.log("Error updating stream profile:", e);
    }

    const userResponse = updatedUser.toObject();
    delete userResponse.profilePic;

    res.status(200).json({ success: true, user: userResponse });
  } catch (error) {
    console.log("Error in updateProfile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function getAvatar(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("profilePic fullName");
    if (!user || !user.profilePic) {
      const initials = user ? user.fullName.substring(0, 2).toUpperCase() : "U";
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#2c3e50"/><text x="50" y="50" dominant-baseline="central" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="40" font-weight="600" fill="#ffffff">${initials}</text></svg>`.trim().replace(/\n/g, '').replace(/\s+/g, ' ');
      res.set("Content-Type", "image/svg+xml");
      return res.send(svg);
    }

    const matches = user.profilePic.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches) {
      const type = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      res.set("Content-Type", type);
      res.set("Cache-Control", "public, max-age=86400"); // cache for 1 day
      return res.send(buffer);
    }

    if (user.profilePic.startsWith("http")) {
      return res.redirect(user.profilePic);
    }

    const svgFallback = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" fill="#2c3e50"/><text x="50" y="50" dominant-baseline="central" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="40" font-weight="600" fill="#ffffff">${user.fullName.substring(0, 2).toUpperCase()}</text></svg>`.trim().replace(/\n/g, '').replace(/\s+/g, ' ');
    res.set("Content-Type", "image/svg+xml");
    return res.send(svgFallback);
  } catch (error) {
    console.error("Error in getAvatar:", error.message);
    res.status(500).send("Error loading avatar");
  }
}

