/* Cancela (ou reabre) um agendamento. Um agendamento cancelado libera o
   horário no site (ver api/horarios.js) e some do faturamento/ranking do
   painel (ver api/relatorio.js) — mas continua listado no dia, marcado. */
import { atualizarStatus, senhaOk } from "./_dados.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ erro: "use POST" });

  const auth = senhaOk(req);
  if (!auth.ok) {
    return res.status(auth.motivo.includes("não configurada") ? 503 : 401).json({ erro: auth.motivo });
  }

  try {
    let corpo = req.body;
    if (typeof corpo === "string") corpo = JSON.parse(corpo);
    const { mes, id, status } = corpo || {};

    if (!mes || !id || (status !== "cancelado" && status !== "confirmado")) {
      return res.status(400).json({ erro: "faltam mes, id ou status (cancelado | confirmado)" });
    }

    const atualizado = await atualizarStatus(String(mes).slice(0, 7), String(id), status);
    return res.status(200).json({ ok: true, agendamento: atualizado });
  } catch (e) {
    console.error("erro ao cancelar agendamento:", e);
    return res.status(500).json({ erro: "falha ao gravar", detalhe: String(e.message || e) });
  }
}
