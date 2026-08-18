/* Devolve os números do painel. Protegido por senha (env PAINEL_SENHA). */
import { lerMes, senhaOk } from "./_dados.js";

const NOME_FORMA = { pix: "Pix", debito: "Cartão débito", credito: "Cartão crédito", dinheiro: "Dinheiro" };

const statusDe = (a) => (a.pagamento && a.pagamento.status) || "pendente";
const valorPagoDe = (a) =>
  statusDe(a) === "pago" ? Number(a.pagamento && a.pagamento.valorPago) || Number(a.total) || 0 : 0;
const soma = (lista) => lista.reduce((t, a) => t + (Number(a.total) || 0), 0);
const somaRecebido = (lista) => lista.reduce((t, a) => t + valorPagoDe(a), 0);
const somaPendente = (lista) => lista.filter((a) => statusDe(a) !== "pago").reduce((t, a) => t + (Number(a.total) || 0), 0);

function mesAnterior(mes) {
  const [ano, m] = mes.split("-").map(Number);
  let a = ano, mm = m - 1;
  if (mm < 1) { mm = 12; a -= 1; }
  return `${a}-${String(mm).padStart(2, "0")}`;
}

function ultimosDias(hoje, n) {
  const out = [];
  const d = new Date(hoje + "T12:00:00");
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(x.toLocaleDateString("sv-SE"));
  }
  return out;
}

export default async function handler(req, res) {
  const auth = senhaOk(req);
  if (!auth.ok) {
    return res.status(auth.motivo.includes("não configurada") ? 503 : 401).json({ erro: auth.motivo });
  }

  try {
    const url = new URL(req.url, "http://x");
    const hoje = url.searchParams.get("dia") || new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const mes = url.searchParams.get("mes") || hoje.slice(0, 7);
    const mesAnt = mesAnterior(mes);

    // meses para a série de 6 meses (mais antigo primeiro)
    const meses6 = [];
    let cursor = mes;
    for (let i = 0; i < 6; i++) { meses6.unshift(cursor); cursor = mesAnterior(cursor); }
    const faltando6 = meses6.filter((m) => m !== mes && m !== mesAnt);

    const [doMes, doMesAnterior, ...outros] = await Promise.all([
      lerMes(mes),
      lerMes(mesAnt),
      ...faltando6.map((m) => lerMes(m)),
    ]);
    const porMes = new Map([[mes, doMes], [mesAnt, doMesAnterior]]);
    faltando6.forEach((m, i) => porMes.set(m, outros[i]));

    const doDia = doMes.filter((a) => a.data === hoje);

    const chave = (a) => a.telefone || (a.cliente || "").toLowerCase().trim();
    const clientesMes = new Set(doMes.map(chave).filter(Boolean));

    // ranking de serviços
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

    // formas de pagamento (só do que já foi confirmado como pago, no mês)
    const contForma = new Map();
    doMes.filter((a) => statusDe(a) === "pago").forEach((a) => {
      const f = (a.pagamento && a.pagamento.forma) || "outro";
      const at = contForma.get(f) || { forma: f, nome: NOME_FORMA[f] || "Não informado", vezes: 0, total: 0 };
      at.vezes += 1;
      at.total += valorPagoDe(a);
      contForma.set(f, at);
    });
    const formasPagamento = [...contForma.values()].sort((a, b) => b.total - a.total);

    // série diária (14 dias) — cruza no máximo o mês atual e o anterior
    const combinadoDias = [...doMes, ...doMesAnterior];
    const serieDiaria = ultimosDias(hoje, 14).map((dia) => {
      const lista = combinadoDias.filter((a) => a.data === dia);
      return { dia, total: soma(lista), recebido: somaRecebido(lista) };
    });

    // série mensal (6 meses)
    const serieMensal = meses6.map((m) => {
      const lista = porMes.get(m) || [];
      return { mes: m, total: soma(lista), recebido: somaRecebido(lista) };
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      hoje,
      mes,
      atendimentosDoDia: doDia
        .slice()
        .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""))
        .map((a) => ({
          id: a.id,
          hora: a.hora,
          minutos: a.minutos,
          cliente: a.cliente,
          telefone: a.telefone,
          total: a.total,
          servicos: (a.servicos || []).map((s) => s.nome),
          pagamento: a.pagamento || { status: "pendente", forma: null, valorPago: 0 },
        })),
      totais: {
        atendimentosDia: doDia.length,
        atendimentosMes: doMes.length,
        clientesMes: clientesMes.size,
        faturamentoDia: soma(doDia),
        faturamentoMes: soma(doMes),
        ticketMedioMes: doMes.length ? soma(doMes) / doMes.length : 0,
        recebidoDia: somaRecebido(doDia),
        pendenteDia: somaPendente(doDia),
        recebidoMes: somaRecebido(doMes),
        pendenteMes: somaPendente(doMes),
      },
      ranking,
      formasPagamento,
      serieDiaria,
      serieMensal,
    });
  } catch (e) {
    console.error("erro no relatório:", e);
    return res.status(500).json({ erro: "falha ao gerar relatório", detalhe: String(e.message || e) });
  }
}
