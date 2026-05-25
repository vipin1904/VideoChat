export const capitialize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

export const getAvatarUrl = (userId) => {
  if (!userId) return "";
  const base = import.meta.env.MODE === "development" ? "http://localhost:5001/api" : "/api";
  return `${base}/users/${userId}/avatar`;
};
