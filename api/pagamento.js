/* Lança um pagamento (sinal, quitação do saldo, ou estorno) num
   agendamento. Chamado pelo painel — protegido pela mesma senha do
   relatório.

   Em vez de substituir o pagamento inteiro de uma vez, soma um lançamento
   ao histórico (api/_dados.js::lancarPagamento) e deriva o status a
   partir do valor total x valorPago acumulado. Isso permite sinal +
   saldo em dois lançamentos separados, sem duplicar nem sobrescrever o
   que já foi recebido. Se o lançamento faria o valorPago passar do total
   do agendamento, recusa e pede confirmação explícita (confirmarExcedente). */
import { lerMes, lancarPagamento, senhaOk } from "./_dados.js";

const FORMAS_VALIDAS = new Set(["pix", "debito", "credito", "dinheiro", "outros"]);
const TIPOS_VALIDOS = new Set(["sinal", "pagamento", "estorno"]);

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
    const { mes, id, lancamento, confirmarExcedente } = corpo || {};

    if (!mes || !id || !lancamento) return res.status(400).json({ erro: "faltam mes, id ou lancamento" });
    if (!TIPOS_VALIDOS.has(lancamento.tipo)) {
      return res.status(400).json({ erro: "tipo de lançamento inválido (sinal | pagamento | estorno)" });
    }
    if (lancamento.forma && !FORMAS_VALIDAS.has(lancamento.forma)) {
      return res.status(400).json({ erro: "forma de pagamento inválida" });
    }
    const valor = Number(lancamento.valor);
    if (!valor || (lancamento.tipo !== "estorno" && valor <= 0) || (lancamento.tipo === "estorno" && valor >= 0)) {
      return res.status(400).json({ erro: "valor do lançamento inválido" });
    }

    const mesLimpo = String(mes).slice(0, 7);
    const idLimpo = String(id);

    /* checagem de saldo: usa a leitura mais recente disponível para avisar
       cedo, sem esperar a escrita — a escrita em si recalcula de novo em
       cima do dado fresco daquele momento (ver lancarPagamento) */
    const atuais = await lerMes(mesLimpo);
    const atual = atuais.find((a) => a.id === idLimpo);
    if (!atual) return res.status(404).json({ erro: "agendamento não encontrado" });

    const valorPagoAtual = Number(atual.pagamento?.valorPago) || 0;
    const total = Number(atual.total) || 0;
    const novoValorPago = Math.max(0, valorPagoAtual + valor);
    if (novoValorPago > total && !confirmarExcedente) {
      return res.status(409).json({
        erro: "o lançamento passa do saldo devido",
        saldoDevido: Math.max(0, total - valorPagoAtual),
        excedente: Number((novoValorPago - total).toFixed(2)),
        precisaConfirmar: true,
      });
    }

    const atualizado = await lancarPagamento(mesLimpo, idLimpo, {
      tipo: lancamento.tipo, valor, forma: lancamento.forma || null, obs: lancamento.obs || "",
    });
    return res.status(200).json({ ok: true, agendamento: atualizado });
  } catch (e) {
    console.error("erro ao lançar pagamento:", e);
    return res.status(500).json({ erro: "falha ao gravar pagamento", detalhe: String(e.message || e) });
  }
}
