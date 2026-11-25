// Texte sans accents ni majuscules, pour comparer ; et identifiant (a-z, 0-9 et tirets) tiré d'un titre.
export const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
export const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
