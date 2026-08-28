/* Agendamento lançado pela própria clínica no painel (cliente que ligou, foi
   até o local, ou combinou fora do site). Mesmo formato de dados do
   /api/agendamento (usado pelo site), mas protegido por senha — só a
   Simone consegue lançar um agendamento manual. */
import { gravarAgendamento, senhaOk } from "./_dados.js";
import { mensagemConfirmacao } from "./_mensagens.js";
import { enviarWhatsApp } from "./_wasender.js";

function normalizarTelefoneBR(digits) {
  return digits.length >= 12 && digits.slice(0, 2) === "55" ? digits.slice(2) : digits;
}

function normaliza(b) {
  const servicos = Array.isArray(b.servicos) ? b.servicos : [];
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    criadoEm: new Date().toISOString(),
    data: String(b.data || "").slice(0, 10),
    hora: String(b.hora || "").slice(0, 5),
    cliente: String(b.cliente || "").slice(0, 80),
    telefone: normalizarTelefoneBR(String(b.telefone || "").replace(/\D/g, "")).slice(0, 15),
    profissional: String(b.profissional || "").slice(0, 60),
    servicos: servicos.slice(0, 30).map((s) => ({
      id: String(s.id || "").slice(0, 60),
      nome: String(s.nome || "").slice(0, 80),
      preco: num(s.preco),
      min: num(s.min),
    })),
    minutos: num(b.minutos),
    subtotal: num(b.subtotal),
    desconto: num(b.desconto),
    total: num(b.total),
    cupom: null,
    pagamento: { status: "pendente", forma: null, valorPago: 0, atualizadoEm: null },
    lembretes: { confirmacao: false, r24h: false, r2h: false },
    status: "confirmado",
    origem: "painel",
  };
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
    if (!corpo || typeof corpo !== "object") return res.status(400).json({ erro: "corpo inválido" });

    const item = normaliza(corpo);
    if (!item.data || !item.hora || !item.cliente || !item.servicos.length) {
      return res.status(400).json({ erro: "faltam cliente, data, hora ou serviços" });
    }

    /* mesma confirmação automática do agendamento feito pelo site — melhor-
       esforço, nunca trava o lançamento manual se o WASender falhar */
    if (item.telefone && process.env.WASENDER_API_KEY) {
      try {
        await enviarWhatsApp(item.telefone, mensagemConfirmacao(item));
        item.lembretes.confirmacao = true;
      } catch (e) {
        console.error("falha ao enviar confirmação (agendamento manual):", e);
      }
    }

    const total = await gravarAgendamento(item);
    return res.status(200).json({ ok: true, agendamento: item, gravados_no_mes: total });
  } catch (e) {
    console.error("erro ao gravar agendamento manual:", e);
    return res.status(500).json({ erro: "falha ao gravar", detalhe: String(e.message || e) });
  }
}
