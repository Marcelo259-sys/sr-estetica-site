/* Verifica agendamentos pendentes de lembrete (confirmação, 24h, 2h) e
   envia via WhatsApp (WASender), automaticamente. Protegido por um segredo
   próprio (env CRON_SECRET) em vez da senha do painel, porque quem chama
   este endpoint é um serviço de agendamento externo (cron), não a Simone.

   Processa os envios em sequência (um de cada vez, com await), nunca em
   paralelo: duas escritas simultâneas no mesmo arquivo do mês já causaram
   uma corrida de dados neste projeto (ver _dados.js). Com poucos
   agendamentos por dia isso é rápido; mesmo em dias cheios, cabe dentro do
   tempo máximo configurado para esta função (ver vercel.json). */
import { lerMes, atualizarLembrete } from "./_dados.js";
import { mensagemConfirmacao, mensagemR24h, mensagemR2h } from "./_mensagens.js";
import { enviarWhatsApp } from "./_wasender.js";

function mesAnterior(mes) {
  const [ano, m] = mes.split("-").map(Number);
  let a = ano, mm = m - 1;
  if (mm < 1) { mm = 12; a -= 1; }
  return `${a}-${String(mm).padStart(2, "0")}`;
}
function somaDias(diaISO, n) {
  const d = new Date(diaISO + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE");
}
/* minutos entre agora e o instante exato do agendamento. São Paulo é
   UTC-3 o ano todo (sem horário de verão desde 2019), então "-03:00" fixo
   dá o instante absoluto certo sem depender do fuso de onde a função roda. */
function faltamMinutos(dataISO, horaHHMM) {
  const alvo = new Date(`${dataISO}T${horaHHMM || "00:00"}:00-03:00`).getTime();
  return (alvo - Date.now()) / 60000;
}
/* bloqueio (compromisso pessoal da Simone) já nasce com lembretes marcados
   como enviados, mas exclui aqui também por clareza e defesa dupla */
const ativo = (a) => a.status !== "cancelado" && !a.bloqueio;

export default async function handler(req, res) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return res.status(503).json({ erro: "CRON_SECRET não configurado" });
  const url = new URL(req.url, "http://x");
  /* duas formas de autenticar: o cron nativo da Vercel manda sozinho o
     cabeçalho "Authorization: Bearer <CRON_SECRET>" (por isso o caminho em
     vercel.json não carrega mais o segredo na URL, visível no repositório
     público); o cron-job.org (externo) não tem esse recurso, então continua
     mandando por querystring/cabeçalho próprio, configurado manualmente lá. */
  const viaCabecalhoVercel = req.headers["authorization"] === `Bearer ${esperado}`;
  const recebido = url.searchParams.get("segredo") || req.headers["x-cron-secret"] || "";
  if (!viaCabecalhoVercel && recebido !== esperado) {
    return res.status(401).json({ erro: "não autorizado" });
  }

  try {
    const hojeReal = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const amanhaReal = somaDias(hojeReal, 1);
    const horaAgoraSP = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo", hour12: false, hour: "2-digit", minute: "2-digit",
    });
    const agoraMin = (() => { const [h, m] = horaAgoraSP.split(":").map(Number); return h * 60 + m; })();

    const mesHoje = hojeReal.slice(0, 7);
    const mesAmanha = amanhaReal.slice(0, 7);
    // cobre virada de mês: se "amanhã" cair no mês seguinte, carrega os dois
    const mesesUnicos = [...new Set([mesAnterior(mesHoje), mesHoje, mesAmanha])];

    const porMes = new Map();
    for (const m of mesesUnicos) porMes.set(m, await lerMes(m));

    const doHoje = (porMes.get(mesHoje) || []).filter((a) => a.data === hojeReal);
    const doAmanha = (porMes.get(mesAmanha) || []).filter((a) => a.data === amanhaReal);

    // confirmação: qualquer agendamento ativo de hoje em diante, nos meses já carregados
    const todasAtivas = mesesUnicos.flatMap((m) => (porMes.get(m) || []).map((a) => ({ ...a, __mes: m })));
    const pendConfirmacao = todasAtivas.filter(
      (a) => ativo(a) && a.data >= hojeReal && !(a.lembretes && a.lembretes.confirmacao)
    );
    /* antes mandava assim que a data virava "amanhã" — ou seja, sempre na
       virada da meia-noite, muito antes das 24h reais e num horário ruim
       pro cliente. Agora só manda quando faltam entre 3h e 25h pro horário
       marcado: cobre a janela de 24h de verdade (com folga pro cron de
       15 em 15 min) e nunca dispara logo após meia-noite pra um horário
       qualquer do dia seguinte. Abaixo de 3h já é território do lembrete
       de 2h, então não se sobrepõe. */
    const pend24h = doAmanha
      .filter((a) => {
        if (!ativo(a) || (a.lembretes && a.lembretes.r24h)) return false;
        const faltam = faltamMinutos(amanhaReal, a.hora);
        return faltam > 180 && faltam <= 1500;
      })
      .map((a) => ({ ...a, __mes: mesAmanha }));
    const pend2h = doHoje
      .filter((a) => {
        if (!ativo(a) || (a.lembretes && a.lembretes.r2h)) return false;
        const [hh, mm] = (a.hora || "00:00").split(":").map(Number);
        const faltam = hh * 60 + mm - agoraMin;
        return faltam >= -15 && faltam <= 180;
      })
      .map((a) => ({ ...a, __mes: mesHoje }));

    const tarefas = [
      ...pendConfirmacao.map((a) => ({ a, tipo: "confirmacao", texto: mensagemConfirmacao(a) })),
      ...pend24h.map((a) => ({ a, tipo: "r24h", texto: mensagemR24h(a) })),
      ...pend2h.map((a) => ({ a, tipo: "r2h", texto: mensagemR2h(a) })),
    ];

    /* a "account protection" do WASender bloqueia mais de 1 mensagem a cada
       5s (HTTP 429) — por isso a pausa entre cada envio da fila. Uma pausa
       bem maior (62s) foi usada temporariamente enquanto a conta estava no
       período de teste, limitado a 1 msg/min — removido depois do upgrade.
       Ainda assim, deixa de fora da execução quem não couber no tempo
       disponível, em vez de arriscar estourar o limite da função: fica
       pendente e é pego sozinho na verificação seguinte. */
    const ESPACAMENTO_MS = 5500;
    const LIMITE_EXECUCAO_MS = 200000; // deixa folga antes do maxDuration
    const inicio = Date.now();
    const enviados = [];
    const falhas = [];
    let precisaEsperar = false;
    for (const t of tarefas) {
      if (Date.now() - inicio > LIMITE_EXECUCAO_MS) {
        falhas.push({ id: t.a.id, tipo: t.tipo, erro: "sem tempo nesta execução, tenta na próxima verificação" });
        continue;
      }
      if (!t.a.telefone) {
        falhas.push({ id: t.a.id, tipo: t.tipo, erro: "sem telefone" });
        continue;
      }
      if (precisaEsperar) await new Promise((r) => setTimeout(r, ESPACAMENTO_MS));
      precisaEsperar = true;
      try {
        await enviarWhatsApp(t.a.telefone, t.texto);
        await atualizarLembrete(t.a.__mes, t.a.id, t.tipo, true);
        enviados.push({ id: t.a.id, tipo: t.tipo, cliente: t.a.cliente });
      } catch (e) {
        falhas.push({ id: t.a.id, tipo: t.tipo, erro: String(e.message || e) });
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      verificadoEm: new Date().toISOString(),
      totalTarefas: tarefas.length,
      enviados,
      falhas,
    });
  } catch (e) {
    console.error("erro no cron de lembretes:", e);
    return res.status(500).json({ erro: "falha ao processar lembretes", detalhe: String(e.message || e) });
  }
}
