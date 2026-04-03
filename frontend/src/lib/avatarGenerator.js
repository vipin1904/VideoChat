const COLORS = [
  '#dc2f2f', '#d25400', '#f39c12', '#27ae60', 
  '#16a085', '#2980b9', '#8e44ad', '#2c3e50',
  '#e84393', '#e17055', '#00cec9', '#0984e3'
];

export function generateInitialsAvatar(name = "User") {
  // Extract initials (first letter of first and last name, or first two letters)
  const names = name.trim().split(' ').filter(Boolean);
  let initials = "U";
  if (names.length >= 2) {
    initials = (names[0][0] + names[names.length - 1][0]).toUpperCase();
  } else if (names.length === 1 && names[0].length >= 2) {
    initials = names[0].substring(0, 2).toUpperCase();
  } else if (names.length === 1) {
    initials = names[0][0].toUpperCase();
  }

  // Consistent pseudo-random color based on name string
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % COLORS.length;
  const backgroundColor = COLORS[colorIndex];

  // Raw Mathematical SVG Definition (Zero-bytes image size)
  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <rect width="100" height="100" fill="${backgroundColor}"/>
      <text x="50" y="50" dominant-baseline="central" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="40" font-weight="600" fill="#ffffff">
        ${initials}
      </text>
    </svg>
  `.trim().replace(/\n/g, '').replace(/\s+/g, ' ');

  // Convert pure SVG to standard Base64 Data URI matching browser file upload structures
  return `data:image/svg+xml;base64,${btoa(svgString)}`;
}

export function generateRandomAvatar() {
  const hashString = Math.random().toString(36).substring(7);
  return generateInitialsAvatar(hashString);
}
