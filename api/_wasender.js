/* Cliente mínimo da API do WASender (wasenderapi.com).
   ATENÇÃO: WASender não é a API oficial da Meta — funciona ligando o
   WhatsApp real da clínica como "aparelho conectado". Isso pode violar os
   termos do WhatsApp e carrega risco real de banimento do número. Usado
   aqui por decisão explícita da dona da clínica, ciente do risco. */

function paraE164(telefoneLocal) {
  const d = String(telefoneLocal || "").replace(/\D/g, "");
  const semDDI = d.length >= 12 && d.slice(0, 2) === "55" ? d.slice(2) : d;
  return "+55" + semDDI;
}

export async function enviarWhatsApp(telefoneLocal, texto) {
  const chave = process.env.WASENDER_API_KEY;
  if (!chave) throw new Error("WASENDER_API_KEY não configurada");

  const r = await fetch("https://www.wasenderapi.com/api/send-message", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: paraE164(telefoneLocal), text: texto }),
  });

  let j = null;
  try { j = await r.json(); } catch {}

  if (!r.ok || !j || j.success !== true) {
    throw new Error(`WASender HTTP ${r.status}: ${(j && (j.message || JSON.stringify(j))) || "sem detalhe"}`);
  }
  return j.data;
}
