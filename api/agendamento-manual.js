/* Agendamento lançado pela própria clínica no painel: um atendimento real
   (cliente que ligou, foi até o local, ou combinou fora do site) OU um
   bloqueio de agenda para compromisso pessoal da Simone (bloqueio:true),
   que não é um atendimento — só ocupa o horário pra ninguém agendar por
   cima pelo site. Mesmo formato de dados do /api/agendamento (usado pelo
   site), mas protegido por senha — só a Simone consegue lançar. */
import { gravarAgendamento, senhaOk } from "./_dados.js";
import { mensagemConfirmacao } from "./_mensagens.js";
import { enviarWhatsApp } from "./_wasender.js";
import { upsertCliente } from "./_clientes.js";

function normalizarTelefoneBR(digits) {
  return digits.length >= 12 && digits.slice(0, 2) === "55" ? digits.slice(2) : digits;
}

function normaliza(b) {
  const bloqueio = !!b.bloqueio;
  const servicos = bloqueio ? [] : Array.isArray(b.servicos) ? b.servicos : [];
  const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    criadoEm: new Date().toISOString(),
    data: String(b.data || "").slice(0, 10),
    hora: String(b.hora || "").slice(0, 5),
    cliente: String(b.cliente || "").slice(0, 80),
    telefone: bloqueio ? "" : normalizarTelefoneBR(String(b.telefone || "").replace(/\D/g, "")).slice(0, 15),
    profissional: String(b.profissional || "").slice(0, 60),
    servicos: servicos.slice(0, 30).map((s) => ({
      id: String(s.id || "").slice(0, 60),
      nome: String(s.nome || "").slice(0, 80),
      preco: num(s.preco),
      min: num(s.min),
    })),
    minutos: num(b.minutos),
    subtotal: bloqueio ? 0 : num(b.subtotal),
    desconto: bloqueio ? 0 : num(b.desconto),
    total: bloqueio ? 0 : num(b.total),
    cupom: null,
    pagamento: { status: "pendente", forma: null, valorPago: 0, atualizadoEm: null },
    /* pré-marcado como enviado: um bloqueio não tem cliente pra confirmar
       nem lembrar de nada — isso evita que o cron de lembretes fique
       tentando (e falhando por "sem telefone") pra sempre */
    lembretes: { confirmacao: true, r24h: true, r2h: true },
    status: "confirmado",
    origem: "painel",
    bloqueio,
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
    if (item.bloqueio) {
      if (!item.data || !item.hora || !item.cliente || !item.minutos) {
        return res.status(400).json({ erro: "faltam data, hora, motivo ou duração do bloqueio" });
      }
    } else if (!item.data || !item.hora || !item.cliente || !item.servicos.length) {
      return res.status(400).json({ erro: "faltam cliente, data, hora ou serviços" });
    }

    /* mesma confirmação automática do agendamento feito pelo site — melhor-
       esforço, nunca trava o lançamento manual se o WASender falhar. Um
       bloqueio nunca tem telefone, então isso já fica pulado sozinho. */
    if (!item.bloqueio && item.telefone && process.env.WASENDER_API_KEY) {
      try {
        await enviarWhatsApp(item.telefone, mensagemConfirmacao(item));
        item.lembretes.confirmacao = true;
      } catch (e) {
        console.error("falha ao enviar confirmação (agendamento manual):", e);
      }
    }

    const total = await gravarAgendamento(item);

    /* alimenta a agenda de clientes pro autocompletar — nunca para um
       bloqueio, cujo "cliente" é só o motivo digitado, não uma pessoa real */
    if (!item.bloqueio && item.cliente) {
      try {
        await upsertCliente(item.cliente, item.telefone);
      } catch (e) {
        console.error("falha ao atualizar agenda de clientes:", e);
      }
    }

    return res.status(200).json({ ok: true, agendamento: item, gravados_no_mes: total });
  } catch (e) {
    console.error("erro ao gravar agendamento manual:", e);
    return res.status(500).json({ erro: "falha ao gravar", detalhe: String(e.message || e) });
  }
}
