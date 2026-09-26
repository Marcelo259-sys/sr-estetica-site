/* Correção única: agendamentos lançados pelo painel (origem "painel") foram
   gravados com os lembretes de 24h e 2h já marcados como enviados, por um
   erro. Reabre esses dois lembretes nos atendimentos reais que ainda vão
   acontecer, para o cron de lembretes enviar. Protegido pelo CRON_SECRET.
   Seguro de rodar mais de uma vez. */
import { put } from "@vercel/blob";
import { lerMes, caminhoDoMes } from "./_dados.js";

export default async function handler(req, res) {
  const esperado = process.env.CRON_SECRET;
  const url = new URL(req.url, "http://x");
  const recebido = url.searchParams.get("segredo") || "";
  if (!esperado || recebido !== esperado) return res.status(401).json({ erro: "não autorizado" });

  try {
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const [ano, mes] = hoje.slice(0, 7).split("-").map(Number);
    const meses = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(ano, mes - 1 + i, 1));
      meses.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    }

    const corrigidos = [];
    for (const m of meses) {
      const registros = await lerMes(m);
      let mudou = false;
      registros.forEach((a) => {
        if (a.origem !== "painel" || a.bloqueio || a.status === "cancelado" || a.data < hoje) return;
        const l = a.lembretes || {};
        if (l.r24h === true || l.r2h === true) {
          a.lembretes = { ...l, r24h: false, r2h: false };
          mudou = true;
          corrigidos.push({ mes: m, id: a.id, cliente: a.cliente, data: a.data, hora: a.hora });
        }
      });
      if (mudou) {
        await put(caminhoDoMes(m), JSON.stringify(registros), {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "application/json",
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, mesesVerificados: meses.length, corrigidos });
  } catch (e) {
    console.error("erro ao corrigir lembretes:", e);
    return res.status(500).json({ erro: "falha", detalhe: String(e.message || e) });
  }
}
