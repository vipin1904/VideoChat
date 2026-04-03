import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CameraIcon, Loader2, ImagePlusIcon, Wand2Icon, ShuffleIcon } from "lucide-react";
import toast from "react-hot-toast";
import { updateProfile } from "../lib/api";
import { generateInitialsAvatar, generateRandomAvatar } from "../lib/avatarGenerator";

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
      document.getElementById('avatar_selector_modal').close();
    };
  };

  const handleGenerateInitials = () => {
    setIsUpdating(true);
    mutate({ profilePic: generateInitialsAvatar(authUser?.fullName || "User") });
    document.getElementById('avatar_selector_modal').close();
  };

  const handleRandomize = () => {
    setIsUpdating(true);
    mutate({ profilePic: generateRandomAvatar() });
    document.getElementById('avatar_selector_modal').close();
  };

  return (
    <>
    <div className="relative group cursor-pointer" onClick={() => !isUpdating && document.getElementById('avatar_selector_modal').showModal()}>
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
    </div>

    {/* DaisyUI Profile Selector Modal */}
    <dialog id="avatar_selector_modal" className="modal modal-bottom sm:modal-middle text-base-content">
      <div className="modal-box p-6 shadow-2xl">
        <h3 className="font-bold text-xl mb-6 text-center">Update Profile Picture</h3>
        <p className="text-sm opacity-70 mb-6 text-center">Opt for a photo, generate a lightweight initials profile, or randomize aesthetics!</p>
        
        <div className="flex flex-col gap-3">
          <button 
            className="btn btn-outline justify-start gap-4 hover:bg-base-200 hover:text-base-content text-lg h-14"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlusIcon className="w-5 h-5 text-primary" />
            Upload Custom Photo
          </button>
          
          <button 
            className="btn btn-outline justify-start gap-4 hover:bg-base-200 hover:text-base-content text-lg h-14"
            onClick={handleGenerateInitials}
          >
            <Wand2Icon className="w-5 h-5 text-secondary" />
            Generate from Name
          </button>

          <button 
            className="btn btn-outline justify-start gap-4 hover:bg-base-200 hover:text-base-content text-lg h-14"
            onClick={handleRandomize}
          >
            <ShuffleIcon className="w-5 h-5 text-accent" />
            Randomize Gradient Avatar
          </button>
        </div>

        <div className="modal-action mt-6">
          <form method="dialog" className="w-full">
            <button className="btn btn-block btn-ghost bg-base-200">Cancel</button>
          </form>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <input
      type="file"
      ref={fileInputRef}
      hidden
      accept="image/*"
      onChange={handleImageChange}
    />
    </>
  );
};

export default ProfileUploader;
