/* Devolve os números do painel. Protegido por senha (env PAINEL_SENHA). */
import { lerMes, senhaOk } from "./_dados.js";
import { lerMesDespesas } from "./_despesas.js";

const NOME_FORMA = { pix: "Pix", debito: "Cartão débito", credito: "Cartão crédito", dinheiro: "Dinheiro", outros: "Outros" };

const statusPgtoDe = (a) => (a.pagamento && a.pagamento.status) || "pendente";
/* "recebido" conta o valor que realmente entrou — pago OU parcial (sinal).
   Um pagamento parcial não é zero recebido (dinheiro entrou de verdade),
   mas também não é o total do serviço (só o que já caiu). */
const valorPagoDe = (a) => {
  const st = statusPgtoDe(a);
  return st === "pago" || st === "parcial" ? Number(a.pagamento && a.pagamento.valorPago) || 0 : 0;
};
const saldoPendenteDe = (a) => Math.max(0, (Number(a.total) || 0) - valorPagoDe(a));
/* cancelado e bloqueio (compromisso pessoal da Simone) não contam em
   faturamento/ranking/clientes/lembretes — só ocupam o horário */
const ativo = (a) => a.status !== "cancelado" && !a.bloqueio;
const soma = (lista) => lista.filter(ativo).reduce((t, a) => t + (Number(a.total) || 0), 0);
const somaRecebido = (lista) => lista.filter(ativo).reduce((t, a) => t + valorPagoDe(a), 0);
const somaPendente = (lista) => lista.filter(ativo).reduce((t, a) => t + saldoPendenteDe(a), 0);

const despesaAtiva = (d) => !d.excluido;
const somaDespesasPagas = (lista) =>
  lista.filter((d) => despesaAtiva(d) && d.status === "pago").reduce((t, d) => t + (Number(d.valor) || 0), 0);
const somaDespesasPendentes = (lista) =>
  lista.filter((d) => despesaAtiva(d) && d.status !== "pago").reduce((t, d) => t + (Number(d.valor) || 0), 0);
const somaSinais = (lista) =>
  lista.filter(ativo).reduce((t, a) => {
    const lancs = (a.pagamento && a.pagamento.lancamentos) || [];
    return t + lancs.filter((l) => l.tipo === "sinal").reduce((s, l) => s + (Number(l.valor) || 0), 0);
  }, 0);

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

    // mesmos meses, mas de despesas — em paralelo, mesmo padrão
    const [despesasDoMes, despesasDoMesAnterior, ...despesasOutros] = await Promise.all([
      lerMesDespesas(mes),
      lerMesDespesas(mesAnt),
      ...extras.map((m) => lerMesDespesas(m)),
    ]);
    const despesasPorMes = new Map([[mes, despesasDoMes], [mesAnt, despesasDoMesAnterior]]);
    extras.forEach((m, i) => despesasPorMes.set(m, despesasOutros[i]));

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

    /* formas de pagamento: soma por LANÇAMENTO (sinal/pagamento), não por
       atendimento — um atendimento pode ter sinal no Pix e saldo no
       cartão, por exemplo, então o mesmo atendimento pode somar em mais
       de uma forma. Estorno não entra (não é recebimento).
       Agendamentos antigos (de antes do sinal/pagamento parcial existir)
       não têm "lancamentos" — só um "forma" solto no pagamento. Pra esses,
       trata como um lançamento único equivalente, sem perder o histórico
       de quem já pagou. */
    const contForma = new Map();
    doMes.filter(ativo).forEach((a) => {
      const pg = a.pagamento || {};
      const lancs = pg.lancamentos && pg.lancamentos.length
        ? pg.lancamentos.filter((l) => l.tipo !== "estorno")
        : pg.status === "pago"
          ? [{ forma: pg.forma || "outros", valor: Number(pg.valorPago) || Number(a.total) || 0 }]
          : [];
      lancs.forEach((l) => {
        const f = l.forma || "outros";
        const at = contForma.get(f) || { forma: f, nome: NOME_FORMA[f] || "Outros", vezes: 0, total: 0 };
        at.vezes += 1;
        at.total += Number(l.valor) || 0;
        contForma.set(f, at);
      });
    });
    const formasPagamento = [...contForma.values()].sort((a, b) => b.total - a.total);

    // série diária (14 dias) — cruza no máximo o mês atual e o anterior
    const combinadoDias = [...doMes, ...doMesAnterior];
    const despesasCombinadoDias = [...despesasDoMes, ...despesasDoMesAnterior];
    const serieDiaria = ultimosDias(hoje, 14).map((dia) => {
      const lista = combinadoDias.filter((a) => a.data === dia);
      const despesasLista = despesasCombinadoDias.filter((d) => despesaAtiva(d) && d.status === "pago" && d.dataPagamento === dia);
      return {
        dia, total: soma(lista), recebido: somaRecebido(lista),
        despesa: despesasLista.reduce((t, d) => t + (Number(d.valor) || 0), 0),
      };
    });

    // série mensal (6 meses)
    const serieMensal = meses6.map((m) => {
      const lista = porMes.get(m) || [];
      const despesasLista = despesasPorMes.get(m) || [];
      return { mes: m, total: soma(lista), recebido: somaRecebido(lista), despesa: somaDespesasPagas(despesasLista) };
    });

    // despesas pagas do mês atual, por categoria (gráfico)
    const contCategoria = new Map();
    despesasDoMes.filter((d) => despesaAtiva(d) && d.status === "pago").forEach((d) => {
      const at = contCategoria.get(d.categoria) || { categoria: d.categoria, total: 0, vezes: 0 };
      at.total += Number(d.valor) || 0;
      at.vezes += 1;
      contCategoria.set(d.categoria, at);
    });
    const despesasPorCategoria = [...contCategoria.values()].sort((a, b) => b.total - a.total);

    const pagosMes = doMes.filter((a) => ativo(a) && statusPgtoDe(a) === "pago");
    const despesasPagasMes = somaDespesasPagas(despesasDoMes);

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
          bloqueio: !!a.bloqueio,
        })),
      totais: {
        atendimentosDia: doDia.filter(ativo).length,
        atendimentosMes: doMes.filter(ativo).length,
        clientesMes: clientesMes.size,
        faturamentoDia: soma(doDia),
        faturamentoMes: soma(doMes),
        /* ticket médio: só sobre atendimentos já pagos (recebido ÷ qtd paga) —
           antes considerava todos os ativos, pagos ou não */
        atendimentosPagosMes: pagosMes.length,
        ticketMedioMes: pagosMes.length ? somaRecebido(doMes) / pagosMes.length : 0,
        recebidoDia: somaRecebido(doDia),
        pendenteDia: somaPendente(doDia),
        recebidoMes: somaRecebido(doMes),
        pendenteMes: somaPendente(doMes),
        totalSinaisMes: somaSinais(doMes),
        despesasMes: despesasPagasMes,
        despesasPendentesMes: somaDespesasPendentes(despesasDoMes),
        lucroLiquidoMes: somaRecebido(doMes) - despesasPagasMes,
      },
      ranking,
      formasPagamento,
      despesasPorCategoria,
      serieDiaria,
      serieMensal,
      lembretesPendentes,
    });
  } catch (e) {
    console.error("erro no relatório:", e);
    return res.status(500).json({ erro: "falha ao gerar relatório", detalhe: String(e.message || e) });
  }
}
