import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";

const Layout = ({ children, showSidebar = false }) => {
  return (
    <div className="min-h-[100dvh]">
      <div className="flex h-[100dvh]">
        {showSidebar && <Sidebar />}

        <div className="flex-1 flex flex-col relative w-full max-h-[100dvh]">
          <Navbar />

          {/* Add pb-16 to avoid bottom nav clipping on mobile when showSidebar is active */}
          <main className={`flex-1 overflow-y-auto w-full ${showSidebar ? "pb-16 lg:pb-0" : ""}`}>
            {children}
          </main>
          
          {showSidebar && <BottomNav />}
        </div>
      </div>
    </div>
  );
};
export default Layout;
