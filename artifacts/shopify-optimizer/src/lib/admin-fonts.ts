/** Fuentes que solo usan los estudios del panel: no se cargan en las páginas públicas. */
if (typeof document !== "undefined" && !document.getElementById("sc-admin-fonts")) {
  const l = document.createElement("link");
  l.id = "sc-admin-fonts";
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=DM+Sans:wght@400;500;600&family=Outfit:wght@400;600;800&display=swap";
  document.head.appendChild(l);
}
export {};
