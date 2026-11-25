// Envoi d'une demande au service de réception (worker/). Adresse vide : les boutons de proposition sont masqués.
export const DEMANDES_URL = import.meta.env.VITE_DEMANDES_URL

export async function sendDemande(proposal, website) {
  let res
  try {
    res = await fetch(`${DEMANDES_URL}/demandes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...proposal, website }),
    })
  } catch {
    throw new Error('Le service est injoignable. Vérifiez votre connexion et réessayez.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || "La demande n'a pas pu être envoyée.")
}
