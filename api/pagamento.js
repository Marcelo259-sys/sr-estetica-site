/* Marca um agendamento como pago (com a forma) ou volta para pendente.
   Chamado pelo painel — protegido pela mesma senha do relatório. */
import { atualizarPagamento, senhaOk } from "./_dados.js";

const FORMAS_VALIDAS = new Set(["pix", "debito", "credito", "dinheiro"]);

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
    const { mes, id, status, forma, valorPago } = corpo || {};

    if (!mes || !id || (status !== "pago" && status !== "pendente")) {
      return res.status(400).json({ erro: "faltam mes, id ou status (pago | pendente)" });
    }
    if (status === "pago" && forma && !FORMAS_VALIDAS.has(forma)) {
      return res.status(400).json({ erro: "forma de pagamento inválida" });
    }

    const pagamento = {
      status,
      forma: status === "pago" ? forma || null : null,
      valorPago: status === "pago" ? Number(valorPago) || 0 : 0,
      atualizadoEm: new Date().toISOString(),
    };

    const atualizado = await atualizarPagamento(String(mes).slice(0, 7), String(id), pagamento);
    return res.status(200).json({ ok: true, agendamento: atualizado });
  } catch (e) {
    console.error("erro ao marcar pagamento:", e);
    return res.status(500).json({ erro: "falha ao gravar pagamento", detalhe: String(e.message || e) });
  }
}
