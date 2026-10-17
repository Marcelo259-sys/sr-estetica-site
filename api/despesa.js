/* Edita, marca como paga/pendente, ou exclui (soft-delete) uma despesa.
   Protegido por senha (painel). */
import { atualizarDespesa, excluirDespesa } from "./_despesas.js";
import { senhaOk } from "./_dados.js";
import { CATEGORIAS } from "./despesas.js";

const FORMAS_VALIDAS = new Set(["pix", "debito", "credito", "dinheiro", "outros"]);

function hojeSP() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

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
    const { mes, id, acao } = corpo || {};
    if (!mes || !id || !acao) return res.status(400).json({ erro: "faltam mes, id ou acao" });
    const mesLimpo = String(mes).slice(0, 7);
    const idLimpo = String(id);

    if (acao === "excluir") {
      const atualizado = await excluirDespesa(mesLimpo, idLimpo);
      return res.status(200).json({ ok: true, despesa: atualizado });
    }

    if (acao === "pagar") {
      const forma = corpo.forma && FORMAS_VALIDAS.has(corpo.forma) ? corpo.forma : null;
      const atualizado = await atualizarDespesa(mesLimpo, idLimpo, {
        status: "pago", dataPagamento: hojeSP(), forma,
      });
      return res.status(200).json({ ok: true, despesa: atualizado });
    }

    if (acao === "reabrir") {
      const atualizado = await atualizarDespesa(mesLimpo, idLimpo, {
        status: "pendente", dataPagamento: null,
      });
      return res.status(200).json({ ok: true, despesa: atualizado });
    }

    if (acao === "editar") {
      const patch = {};
      if (typeof corpo.descricao === "string") patch.descricao = corpo.descricao.trim().slice(0, 140);
      if (CATEGORIAS.includes(corpo.categoria)) patch.categoria = corpo.categoria;
      if (Number(corpo.valor) > 0) patch.valor = Number(corpo.valor);
      if (typeof corpo.vencimento === "string") patch.vencimento = corpo.vencimento.slice(0, 10);
      if (typeof corpo.observacoes === "string") patch.observacoes = corpo.observacoes.slice(0, 300);
      if (corpo.recorrencia === "mensal" || corpo.recorrencia === null) patch.recorrencia = corpo.recorrencia;
      if (!Object.keys(patch).length) return res.status(400).json({ erro: "nada para editar" });

      const atualizado = await atualizarDespesa(mesLimpo, idLimpo, patch);
      return res.status(200).json({ ok: true, despesa: atualizado });
    }

    return res.status(400).json({ erro: "acao inválida (pagar | reabrir | editar | excluir)" });
  } catch (e) {
    console.error("erro ao atualizar despesa:", e);
    return res.status(500).json({ erro: "falha ao atualizar despesa", detalhe: String(e.message || e) });
  }
}
