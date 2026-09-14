/* Recebe o agendamento no momento em que a cliente aperta enviar no site.
   Chamado por navigator.sendBeacon, então precisa aceitar corpo em texto. */
import { gravarAgendamento } from "./_dados.js";
import { mensagemConfirmacao } from "./_mensagens.js";
import { enviarWhatsApp } from "./_wasender.js";
import { upsertCliente } from "./_clientes.js";

/* Se a cliente digitar o telefone já com o 55 na frente (comum — é assim
   que o WhatsApp mostra o próprio número), guardamos SEM o 55: é o formato
   que os links wa.me/55<numero> do painel esperam. Sem isso, o link fica
   com "55" duplicado e não abre a conversa certa. */
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
    cupom: b.cupom ? String(b.cupom).slice(0, 30) : null,
    /* pagamento entra sempre pendente: quem confirma que recebeu é a
       Simone, no painel — o site não sabe se o pagamento aconteceu */
    pagamento: { status: "pendente", forma: null, valorPago: 0, atualizadoEm: null },
    lembretes: { confirmacao: false, r24h: false, r2h: false },
    status: "confirmado",
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ erro: "use POST" });

  try {
    let corpo = req.body;
    if (typeof corpo === "string") corpo = JSON.parse(corpo);
    if (!corpo || typeof corpo !== "object") return res.status(400).json({ erro: "corpo inválido" });

    const item = normaliza(corpo);
    if (!item.data || !item.hora || !item.servicos.length) {
      return res.status(400).json({ erro: "faltam data, hora ou serviços" });
    }

    /* confirmação automática via WhatsApp (WASender), melhor-esforço: se
       falhar, o item.lembretes.confirmacao continua false e o /api/cron-
       lembretes pega esse agendamento como pendente na próxima verificação
       e tenta de novo — então isso nunca pode travar a reserva em si.
       Marca o flag ANTES de gravar (em vez de gravar e depois regravar só
       esse campo) para não fazer duas escritas seguidas no mesmo arquivo do
       mês, o que já causou uma corrida de dados neste projeto. */
    if (item.telefone && process.env.WASENDER_API_KEY) {
      try {
        await enviarWhatsApp(item.telefone, mensagemConfirmacao(item));
        item.lembretes.confirmacao = true;
      } catch (e) {
        console.error("falha ao enviar confirmação imediata:", e);
      }
    }

    const total = await gravarAgendamento(item);

    /* alimenta a agenda de clientes pro autocompletar do painel — melhor-
       esforço, nunca deve travar a reserva se falhar. Precisa ser esperado
       (await) e não "solto": numa função serverless, a execução pode ser
       congelada assim que a resposta é enviada, e uma promise pendente sem
       await nunca chegaria a terminar. */
    if (item.cliente) {
      try {
        await upsertCliente(item.cliente, item.telefone);
      } catch (e) {
        console.error("falha ao atualizar agenda de clientes:", e);
      }
    }

    return res.status(200).json({ ok: true, gravados_no_mes: total });
  } catch (e) {
    console.error("erro ao gravar agendamento:", e);
    return res.status(500).json({ erro: "falha ao gravar", detalhe: String(e.message || e) });
  }
}
