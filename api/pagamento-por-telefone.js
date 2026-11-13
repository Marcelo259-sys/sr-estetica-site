/* Marca o sinal como pago automaticamente quando o robô do WhatsApp (Atendente
   24h) confirma, na conversa, que recebeu o comprovante da cliente. Chamado
   pelo n8n — nunca pela Simone, por isso usa um segredo próprio (PONTE_SECRET),
   nunca a senha do painel nem o CRON_SECRET.

   Diferença para api/pagamento.js: aquele exige mes+id (a Simone está vendo o
   agendamento na tela). Este só recebe telefone+valor — o robô não sabe o id,
   só com quem está falando — e por isso PROCURA o agendamento certo: entre os
   ativos e ainda não pagos deste telefone, pega o mais próximo de acontecer
   (hoje ou no futuro). Sem isso, api/cron-lembretes.js continua achando que
   não foi pago e repete o pedido do sinal mesmo depois do comprovante.

   Não achar agendamento não é erro (pode ser comprovante de algo que a Simone
   vai lançar à mão mesmo, como um pacote fechado por fora): devolve ok:false
   para o robô seguir normalmente, sem travar o atendimento. */
import { lerMes, lancarPagamento } from "./_dados.js";

function normalizarTelefoneBR(digits) {
  return digits.length >= 12 && digits.slice(0, 2) === "55" ? digits.slice(2) : digits;
}

function mesSeguinte(mes) {
  const [ano, m] = mes.split("-").map(Number);
  let a = ano, mm = m + 1;
  if (mm > 12) { mm = 1; a += 1; }
  return `${a}-${String(mm).padStart(2, "0")}`;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ erro: "use POST" });

  const esperado = process.env.PONTE_SECRET;
  if (!esperado) return res.status(503).json({ erro: "PONTE_SECRET não configurado" });
  if (req.headers["x-ponte-secret"] !== esperado) {
    return res.status(401).json({ erro: "não autorizado" });
  }

  try {
    let corpo = req.body;
    if (typeof corpo === "string") corpo = JSON.parse(corpo);
    const { telefone, valor } = corpo || {};
    const valorNum = Number(valor);
    if (!telefone || !valorNum || valorNum <= 0) {
      return res.status(400).json({ erro: "faltam telefone ou valor" });
    }
    const tel = normalizarTelefoneBR(String(telefone).replace(/\D/g, ""));

    const hojeReal = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const mesHoje = hojeReal.slice(0, 7);
    const mesesParaChecar = [mesHoje, mesSeguinte(mesHoje)];

    // entre os candidatos deste telefone, fica com o agendamento mais
    // próximo de acontecer — é o que o sinal recém-chegado mais provavelmente
    // paga
    let candidato = null;
    for (const mes of mesesParaChecar) {
      const itens = await lerMes(mes);
      for (const a of itens) {
        if (a.telefone !== tel) continue;
        if (a.status === "cancelado" || a.bloqueio) continue;
        if (a.data < hojeReal) continue;
        if (a.pagamento && a.pagamento.status === "pago") continue;
        if (!candidato || a.data < candidato.a.data) candidato = { a, mes };
      }
    }

    if (!candidato) {
      return res.status(200).json({ ok: false, motivo: "nenhum agendamento pendente encontrado para este telefone" });
    }

    const atualizado = await lancarPagamento(candidato.mes, candidato.a.id, {
      tipo: "sinal",
      valor: valorNum,
      forma: "pix",
      obs: "Confirmado por comprovante enviado no WhatsApp (robô)",
    });

    return res.status(200).json({ ok: true, agendamento: atualizado });
  } catch (e) {
    console.error("erro na ponte de pagamento:", e);
    return res.status(500).json({ erro: "falha ao registrar pagamento", detalhe: String(e.message || e) });
  }
}
