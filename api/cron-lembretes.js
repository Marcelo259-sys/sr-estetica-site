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
/* bloqueio (compromisso pessoal da Simone) já nasce com lembretes marcados
   como enviados, mas exclui aqui também por clareza e defesa dupla */
const ativo = (a) => a.status !== "cancelado" && !a.bloqueio;

export default async function handler(req, res) {
  const esperado = process.env.CRON_SECRET;
  if (!esperado) return res.status(503).json({ erro: "CRON_SECRET não configurado" });
  const url = new URL(req.url, "http://x");
  const recebido = url.searchParams.get("segredo") || req.headers["x-cron-secret"] || "";
  if (recebido !== esperado) return res.status(401).json({ erro: "não autorizado" });

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
    const pend24h = doAmanha
      .filter((a) => ativo(a) && !(a.lembretes && a.lembretes.r24h))
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

    /* A conta do WASender em uso agora (período de teste) só permite 1
       mensagem por minuto — bem mais restrito que o limite anterior (1 a
       cada 5s). Com esse espaçamento, tentar caber uma fila grande numa
       execução só estourou o tempo máximo da função mesmo com folga (erro
       FUNCTION_INVOCATION_TIMEOUT). Em vez de arriscar isso de novo, cada
       execução manda no máximo umas poucas mensagens; o que sobrar fica
       pendente (nunca é marcado como enviado até o envio realmente
       funcionar) e é pego sozinho na verificação seguinte, que roda a
       cada 15 minutos. */
    const ESPACAMENTO_MS = 62000;
    const MAX_ENVIOS_POR_EXECUCAO = 2;
    const enviados = [];
    const falhas = [];
    let precisaEsperar = false;
    for (const t of tarefas) {
      if (enviados.length >= MAX_ENVIOS_POR_EXECUCAO) {
        falhas.push({ id: t.a.id, tipo: t.tipo, erro: "fila cheia nesta execução, tenta na próxima verificação" });
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
