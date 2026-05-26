import { Link, useLocation } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { BellIcon, LogOutIcon, ShipWheelIcon } from "lucide-react";
import ThemeSelector from "./ThemeSelector";
import useLogout from "../hooks/useLogout";

const Navbar = () => {
  const { authUser } = useAuthUser();
  const location = useLocation();
  const { logoutMutation } = useLogout();

  const isChatPage = location.pathname?.startsWith("/chat");

  return (
    <nav className="bg-base-200 border-b border-base-300 sticky top-0 z-30 h-16 flex items-center w-full">
      <div className="w-full px-3 sm:px-6">
        <div className="flex items-center justify-between w-full gap-3">

          {/* LEFT — Logo (hidden on chat page, sidebar shows it on desktop) */}
          {!isChatPage && (
            <Link to="/" className="flex items-center gap-2 lg:hidden">
              <ShipWheelIcon className="size-7 text-primary shrink-0" />
              <span className="text-xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
                VideoChat
              </span>
            </Link>
          )}

          {/* Spacer so right group hugs right edge */}
          <div className="flex-1" />

          {/* RIGHT — actions */}
          <div className="flex items-center gap-1 sm:gap-2">

            {/* Notifications */}
            <Link to="/notifications">
              <button className="btn btn-ghost btn-circle btn-sm sm:btn-md" title="Notifications">
                <BellIcon className="h-5 w-5 sm:h-6 sm:w-6 text-base-content opacity-70" />
              </button>
            </Link>

            {/* Theme toggle */}
            <ThemeSelector />

            {/* Avatar */}
            <div className="avatar shrink-0">
              <div className="w-8 sm:w-9 rounded-full">
                <img src={authUser?.profilePic} alt="User Avatar" />
              </div>
            </div>

            {/* Logout */}
            <button
              className="btn btn-ghost btn-circle btn-sm sm:btn-md"
              onClick={logoutMutation}
              title="Logout"
            >
              <LogOutIcon className="h-5 w-5 sm:h-6 sm:w-6 text-base-content opacity-70" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
