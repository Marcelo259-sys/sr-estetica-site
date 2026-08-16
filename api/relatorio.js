/* Devolve os números do painel. Protegido por senha (env PAINEL_SENHA). */
import { lerMes, senhaOk } from "./_dados.js";

export default async function handler(req, res) {
  const auth = senhaOk(req);
  if (!auth.ok) {
    return res.status(auth.motivo.includes("não configurada") ? 503 : 401).json({ erro: auth.motivo });
  }

  try {
    const url = new URL(req.url, "http://x");
    const hoje = url.searchParams.get("dia") || new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const mes = url.searchParams.get("mes") || hoje.slice(0, 7);

    const doMes = await lerMes(mes);
    const doDia = doMes.filter((a) => a.data === hoje);

    /* clientes únicos pelo telefone; sem telefone, cai no nome */
    const chave = (a) => a.telefone || (a.cliente || "").toLowerCase().trim();
    const clientesMes = new Set(doMes.map(chave).filter(Boolean));

    /* ranking de serviços */
    const cont = new Map();
    doMes.forEach((a) =>
      (a.servicos || []).forEach((s) => {
        const k = s.nome || s.id;
        if (!k) return;
        const at = cont.get(k) || { nome: k, vezes: 0, receita: 0 };
        at.vezes += 1;
        at.receita += Number(s.preco) || 0;
        cont.set(k, at);
      })
    );
    const ranking = [...cont.values()].sort((a, b) => b.vezes - a.vezes).slice(0, 10);

    const soma = (lista) => lista.reduce((t, a) => t + (Number(a.total) || 0), 0);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      hoje,
      mes,
      atendimentosDoDia: doDia
        .slice()
        .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""))
        .map((a) => ({
          hora: a.hora,
          minutos: a.minutos,
          cliente: a.cliente,
          telefone: a.telefone,
          total: a.total,
          servicos: (a.servicos || []).map((s) => s.nome),
        })),
      totais: {
        atendimentosDia: doDia.length,
        atendimentosMes: doMes.length,
        clientesMes: clientesMes.size,
        faturamentoDia: soma(doDia),
        faturamentoMes: soma(doMes),
        ticketMedioMes: doMes.length ? soma(doMes) / doMes.length : 0,
      },
      ranking,
    });
  } catch (e) {
    console.error("erro no relatório:", e);
    return res.status(500).json({ erro: "falha ao gerar relatório", detalhe: String(e.message || e) });
  }
}
