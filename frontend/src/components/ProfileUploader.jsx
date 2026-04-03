import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CameraIcon, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { updateProfile } from "../lib/api";

const ProfileUploader = ({ authUser, sizeClass = "w-10" }) => {
  const fileInputRef = useRef(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      toast.success("Profile picture updated!");
      setIsUpdating(false);
    },
    onError: () => {
      toast.error("Failed to update profile picture");
      setIsUpdating(false);
    },
  });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      setIsUpdating(true);
      const base64Image = reader.result;
      mutate({ profilePic: base64Image });
    };
  };

  return (
    <div className="relative group cursor-pointer" onClick={() => !isUpdating && fileInputRef.current?.click()}>
      <div className={`avatar ${isUpdating ? "opacity-50" : ""}`}>
        <div className={`${sizeClass} rounded-full ring ring-primary ring-offset-base-100 ring-offset-2`}>
          <img src={authUser?.profilePic} alt="User Avatar" />
        </div>
      </div>
      
      {/* Upload Overlay */}
      <div className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isUpdating ? "opacity-100" : ""}`}>
        {isUpdating ? (
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        ) : (
          <CameraIcon className="w-5 h-5 text-white" />
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        hidden
        accept="image/*"
        onChange={handleImageChange}
      />
    </div>
  );
};

export default ProfileUploader;
