// One table of real materials and ground surfaces for the whole site: the server's MuJoCo scenes (lib/physics-scenes.js)
// and the live 3D world (public/world/physics.js) read the same numbers, so a rubber ball bounces the same in both.
// rho = density (kg/m³) · mu = friction · e = restitution (the share of the speed kept in a bounce)
// breakV = the impact speed (m/s) that breaks it (glass ≈ a 25 cm drop onto concrete) · hollow = shell thickness share
export const MATERIALS = {
  wood: { rho: 600, mu: 0.6, e: 0.35, color: "#a8743f", en: "wooden", ar: "خشبي" },
  metal: { rho: 7800, mu: 0.45, e: 0.18, color: "#9aa3ab", en: "steel", ar: "فولاذي" },
  rubber: { rho: 1100, mu: 1.0, e: 0.78, color: "#2e2e30", en: "rubber", ar: "مطاطي", hollow: 0.12 },
  glass: { rho: 2500, mu: 0.4, e: 0.25, color: "#bfe3ea", en: "glass", ar: "زجاجي", breakV: 2.2 },
  stone: { rho: 2600, mu: 0.7, e: 0.12, color: "#8d8a83", en: "stone", ar: "حجري" },
  foam: { rho: 40, mu: 0.8, e: 0.3, color: "#f2d16b", en: "foam", ar: "إسفنجي" },
  plastic: { rho: 950, mu: 0.4, e: 0.5, color: "#e05a4f", en: "plastic", ar: "بلاستيكي", hollow: 0.1 },
  ice: { rho: 917, mu: 0.04, e: 0.15, color: "#dff3fb", en: "ice", ar: "جليدي", breakV: 3.2 }
};
export const SURFACES = {
  concrete: { mu: 0.9, color: "#9b9890", en: "concrete", ar: "الخرسانة" }, asphalt: { mu: 1.0, color: "#3a3d40", en: "dry asphalt", ar: "الأسفلت الجاف" },
  wet: { mu: 0.6, color: "#2a2f35", en: "wet asphalt", ar: "الأسفلت المبلل" }, gravel: { mu: 0.55, color: "#8a7e6b", en: "gravel", ar: "الحصى" },
  grass: { mu: 0.55, color: "#5f8a3c", en: "grass", ar: "العشب", soft: 1 }, sand: { mu: 0.75, color: "#d8c08a", en: "sand", ar: "الرمل", soft: 1 },
  snow: { mu: 0.3, color: "#eef3f6", en: "snow", ar: "الثلج", soft: 1 }, ice: { mu: 0.06, color: "#d7eef7", en: "ice", ar: "الجليد" },
  wood: { mu: 0.6, color: "#b98a58", en: "a wooden floor", ar: "أرضية خشبية" }
};
export const G = 9.81, RHO_WATER = 1000, RHO_AIR = 1.2;
