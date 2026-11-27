// Backend address. The app never holds the Anthropic key — only this shared app token for your own server.
export const DEFAULT_SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL ?? "http://192.168.1.20:8787";
export const DEFAULT_APP_TOKEN = process.env.EXPO_PUBLIC_APP_TOKEN ?? "";

/** Default facts the characters remember (editable in Settings). */
export const DEFAULT_LIFE_FACTS = [
  "Es de Omán y habla árabe del Golfo.",
  "Tiene hijos.",
  "Es madridista.",
  "Conoce a Toby, el perro de Doña Carmen.",
];
