import { Link, useLocation } from "react-router";
import { BellIcon, HomeIcon, UsersIcon } from "lucide-react";

const BottomNav = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="btm-nav lg:hidden z-40 bg-base-200/80 backdrop-blur-lg backdrop-saturate-150 border-t border-base-300">
      <Link to="/" className={`${currentPath === "/" ? "active text-primary" : "text-base-content/70"}`}>
        <HomeIcon className="w-6 h-6" />
        <span className="btm-nav-label text-xs">Home</span>
      </Link>
      
      <Link to="/friends" className={`${currentPath === "/friends" ? "active text-primary" : "text-base-content/70"}`}>
        <UsersIcon className="w-6 h-6" />
        <span className="btm-nav-label text-xs">Friends</span>
      </Link>
      
      <Link to="/notifications" className={`${currentPath === "/notifications" ? "active text-primary" : "text-base-content/70"}`}>
        <BellIcon className="w-6 h-6" />
        <span className="btm-nav-label text-xs">Notifs</span>
      </Link>
    </div>
  );
};

export default BottomNav;
