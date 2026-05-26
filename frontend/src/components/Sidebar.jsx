import { Link, useLocation } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { BellIcon, HomeIcon, ShipWheelIcon, UsersIcon } from "lucide-react";
import InitialAvatar from "./InitialAvatar";

const Sidebar = () => {
  const { authUser } = useAuthUser();
  const location = useLocation();
  const p = location.pathname;

  const links = [
    { to: "/",             label: "Home",          Icon: HomeIcon  },
    { to: "/friends",      label: "Friends",        Icon: UsersIcon },
    { to: "/notifications",label: "Notifications",  Icon: BellIcon  },
  ];

  return (
    <aside className="w-64 bg-base-200 border-r border-base-300 hidden lg:flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-5 border-b border-base-300">
        <Link to="/" className="flex items-center gap-2.5">
          <ShipWheelIcon className="size-9 text-primary" />
          <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
            VideoChat
          </span>
        </Link>
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className={`btn btn-ghost justify-start w-full gap-3 px-3 normal-case ${
              p === to ? "btn-active" : ""
            }`}
          >
            <Icon className="size-5 text-base-content opacity-70" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* User profile */}
      <div className="p-4 border-t border-base-300 mt-auto">
        <div className="flex items-center gap-3">
          <InitialAvatar src={authUser?.profilePic} name={authUser?.fullName || ""} size="10" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{authUser?.fullName}</p>
            <p className="text-xs text-success flex items-center gap-1">
              <span className="size-2 rounded-full bg-success inline-block" />
              Online
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
