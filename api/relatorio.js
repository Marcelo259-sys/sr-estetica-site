/* Devolve os números do painel. Protegido por senha (env PAINEL_SENHA). */
import { lerMes, senhaOk } from "./_dados.js";

const NOME_FORMA = { pix: "Pix", debito: "Cartão débito", credito: "Cartão crédito", dinheiro: "Dinheiro" };

const statusPgtoDe = (a) => (a.pagamento && a.pagamento.status) || "pendente";
const valorPagoDe = (a) =>
  statusPgtoDe(a) === "pago" ? Number(a.pagamento && a.pagamento.valorPago) || Number(a.total) || 0 : 0;
const ativo = (a) => a.status !== "cancelado"; // cancelado não conta em faturamento/ranking/clientes
const soma = (lista) => lista.filter(ativo).reduce((t, a) => t + (Number(a.total) || 0), 0);
const somaRecebido = (lista) => lista.filter(ativo).reduce((t, a) => t + valorPagoDe(a), 0);
const somaPendente = (lista) =>
  lista.filter((a) => ativo(a) && statusPgtoDe(a) !== "pago").reduce((t, a) => t + (Number(a.total) || 0), 0);

function mesAnterior(mes) {
  const [ano, m] = mes.split("-").map(Number);
  let a = ano, mm = m - 1;
  if (mm < 1) { mm = 12; a -= 1; }
  return `${a}-${String(mm).padStart(2, "0")}`;
}
function mesSeguinte(mes) {
  const [ano, m] = mes.split("-").map(Number);
  let a = ano, mm = m + 1;
  if (mm > 12) { mm = 1; a += 1; }
  return `${a}-${String(mm).padStart(2, "0")}`;
}
function somaDias(diaISO, n) {
  const d = new Date(diaISO + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE");
}
function ultimosDias(hoje, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(somaDias(hoje, -i));
  return out;
}

function resumoLembrete(a, mesOrigem) {
  return {
    id: a.id,
    mes: mesOrigem,
    data: a.data,
    hora: a.hora,
    cliente: a.cliente,
    telefone: a.telefone,
    servicos: (a.servicos || []).map((s) => s.nome),
    minutos: a.minutos,
    lembretes: a.lembretes || { confirmacao: false, r24h: false, r2h: false },
  };
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

    /* "agora" de verdade, para os lembretes — independe da data que a Simone
       esteja navegando no seletor de dia do painel */
    const hojeReal = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const amanhaReal = somaDias(hojeReal, 1);
    const horaAgoraSP = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo", hour12: false, hour: "2-digit", minute: "2-digit",
    });
    const agoraMin = (() => { const [h, m] = horaAgoraSP.split(":").map(Number); return h * 60 + m; })();
    const mesHojeReal = hojeReal.slice(0, 7);
    const mesAmanhaReal = amanhaReal.slice(0, 7);

    // meses para a série de 6 meses (mais antigo primeiro)
    const meses6 = [];
    let cursor = mes;
    for (let i = 0; i < 6; i++) { meses6.unshift(cursor); cursor = mesAnterior(cursor); }

    const jaTem = new Set([mes, mesAnt]);
    const extras = [...new Set([...meses6, mesHojeReal, mesAmanhaReal])].filter((m) => !jaTem.has(m));

    const [doMes, doMesAnterior, ...outros] = await Promise.all([
      lerMes(mes),
      lerMes(mesAnt),
      ...extras.map((m) => lerMes(m)),
    ]);
    const porMes = new Map([[mes, doMes], [mesAnt, doMesAnterior]]);
    extras.forEach((m, i) => porMes.set(m, outros[i]));

    const doDia = doMes.filter((a) => a.data === hoje);
    const doHojeReal = (porMes.get(mesHojeReal) || []).filter((a) => a.data === hojeReal);
    const doAmanhaReal = (porMes.get(mesAmanhaReal) || []).filter((a) => a.data === amanhaReal);

    const chave = (a) => a.telefone || (a.cliente || "").toLowerCase().trim();
    const clientesMes = new Set(doMes.filter(ativo).map(chave).filter(Boolean));

    // ranking de serviços
    const cont = new Map();
    doMes.filter(ativo).forEach((a) =>
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
    doMes.filter((a) => ativo(a) && statusPgtoDe(a) === "pago").forEach((a) => {
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

    /* lembretes pendentes — confirmação olha o mês inteiro (a partir de hoje),
       24h olha só amanhã, 2h olha só hoje e dentro de uma janela próxima */
    const lembretesPendentes = {
      confirmacao: doMes
        .filter((a) => ativo(a) && a.data >= hojeReal && !(a.lembretes && a.lembretes.confirmacao))
        .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
        .map((a) => resumoLembrete(a, mes)),
      r24h: doAmanhaReal
        .filter((a) => ativo(a) && !(a.lembretes && a.lembretes.r24h))
        .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""))
        .map((a) => resumoLembrete(a, mesAmanhaReal)),
      r2h: doHojeReal
        .filter((a) => {
          if (!ativo(a)) return false;
          if (a.lembretes && a.lembretes.r2h) return false;
          const [hh, mm] = (a.hora || "00:00").split(":").map(Number);
          const faltam = hh * 60 + mm - agoraMin;
          return faltam >= -15 && faltam <= 180; // até 15min depois do horário até 3h antes
        })
        .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""))
        .map((a) => resumoLembrete(a, mesHojeReal)),
    };

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
          lembretes: a.lembretes || { confirmacao: false, r24h: false, r2h: false },
          status: a.status || "confirmado",
        })),
      totais: {
        atendimentosDia: doDia.filter(ativo).length,
        atendimentosMes: doMes.filter(ativo).length,
        clientesMes: clientesMes.size,
        faturamentoDia: soma(doDia),
        faturamentoMes: soma(doMes),
        ticketMedioMes: doMes.filter(ativo).length ? soma(doMes) / doMes.filter(ativo).length : 0,
        recebidoDia: somaRecebido(doDia),
        pendenteDia: somaPendente(doDia),
        recebidoMes: somaRecebido(doMes),
        pendenteMes: somaPendente(doMes),
      },
      ranking,
      formasPagamento,
      serieDiaria,
      serieMensal,
      lembretesPendentes,
    });
  } catch (e) {
    console.error("erro no relatório:", e);
    return res.status(500).json({ erro: "falha ao gerar relatório", detalhe: String(e.message || e) });
  }
}
