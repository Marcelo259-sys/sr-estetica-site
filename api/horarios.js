/* Endpoint público (sem senha): diz quais horários já estão ocupados num
   dia, para o site não deixar duas pessoas escolherem o mesmo horário.
   Não devolve nome, telefone nem serviço — só o necessário para calcular
   disponibilidade. */
import { lerMes, mesDe } from "./_dados.js";

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://x");
    const dia = String(url.searchParams.get("dia") || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) {
      return res.status(400).json({ erro: "parâmetro dia inválido (use AAAA-MM-DD)" });
    }

    const doMes = await lerMes(mesDe(dia));
    const ocupados = doMes
      .filter((a) => a.data === dia && a.status !== "cancelado")
      .map((a) => ({ hora: a.hora, minutos: Number(a.minutos) || 30 }));

    return res.status(200).json({ dia, ocupados });
  } catch (e) {
    console.error("erro em /api/horarios:", e);
    // falha aberta: um erro aqui nunca deve travar o agendamento
    return res.status(200).json({ dia: null, ocupados: [] });
  }
}
