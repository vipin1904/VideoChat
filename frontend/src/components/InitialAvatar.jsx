/**
 * InitialAvatar — exactly like WhatsApp
 *
 * If the user has a real profile photo → shows it.
 * Otherwise → shows a colored circle with the user's initials.
 *
 * Props:
 *   src        – profile pic URL (may be empty / null / undefined)
 *   name       – full name used to derive initials + background color
 *   size       – Tailwind size string applied to width & height (default "10")
 *   className  – extra classes on the outer wrapper
 */

const COLORS = [
  "#E53935", "#D81B60", "#8E24AA", "#5E35B1",
  "#3949AB", "#1E88E5", "#039BE5", "#00ACC1",
  "#00897B", "#43A047", "#7CB342", "#C0CA33",
  "#FDD835", "#FFB300", "#FB8C00", "#F4511E",
  "#6D4C41", "#546E7A",
];

/** Deterministic color index from the name string */
function colorFromName(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

/** "John Doe" → "JD"  |  "Alice" → "A" */
function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Check whether a URL is a real image (not empty/placeholder API) */
function isRealPhoto(src) {
  if (!src) return false;
  // treat the generic Iran-liara placeholder as "no photo"
  if (src.includes("avatar.iran.liara.run")) return false;
  return true;
}

const InitialAvatar = ({ src, name = "", size = "10", className = "" }) => {
  const bg = colorFromName(name);
  const initials = getInitials(name);

  const dim = `w-${size} h-${size}`;

  if (isRealPhoto(src)) {
    return (
      <img
        src={src}
        alt={name || "User"}
        className={`${dim} rounded-full object-cover ${className}`}
        onError={(e) => {
          // if the image fails to load, fall back to initials
          e.currentTarget.style.display = "none";
          if (e.currentTarget.nextSibling) {
            e.currentTarget.nextSibling.style.display = "flex";
          }
        }}
      />
    );
  }

  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center select-none font-bold text-white ${className}`}
      style={{ backgroundColor: bg, fontSize: `calc(var(--tw-spacing, 0.25rem) * ${size} * 0.38)` }}
      title={name}
    >
      {initials}
    </div>
  );
};

export default InitialAvatar;
export { getInitials, colorFromName };
