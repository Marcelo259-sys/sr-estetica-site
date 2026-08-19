/* Marca (ou desmarca) que um lembrete já foi enviado para a cliente.
   Chamado pelo painel — protegido pela mesma senha do relatório. */
import { atualizarLembrete, senhaOk } from "./_dados.js";

const TIPOS_VALIDOS = new Set(["confirmacao", "r24h", "r2h"]);

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
    const { mes, id, tipo, valor } = corpo || {};

    if (!mes || !id || !TIPOS_VALIDOS.has(tipo)) {
      return res.status(400).json({ erro: "faltam mes, id ou tipo (confirmacao | r24h | r2h)" });
    }

    const atualizado = await atualizarLembrete(String(mes).slice(0, 7), String(id), tipo, valor !== false);
    return res.status(200).json({ ok: true, agendamento: atualizado });
  } catch (e) {
    console.error("erro ao marcar lembrete:", e);
    return res.status(500).json({ erro: "falha ao gravar lembrete", detalhe: String(e.message || e) });
  }
}
