/* Textos das mensagens automáticas, enviadas via API do WASender (JSON, não
   link wa.me) — por isso podem ter emoji sem risco de corromper, ao
   contrário dos botões manuais do painel (painel.html tem sua própria
   cópia em JS de navegador, aqueles continuam sem emoji porque saem por
   link wa.me aberto no WhatsApp Desktop, onde já vimos emoji virar "�"). */
const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function fmtDataBR(iso) {
  const d = new Date(String(iso) + "T12:00:00");
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
}
function diaSemanaEData(iso) {
  const d = new Date(String(iso) + "T12:00:00");
  return `${DIAS_SEMANA[d.getDay()]}, dia ${fmtDataBR(iso)}`;
}
function primeiroNome(nome) {
  return String(nome || "").trim().split(/\s+/)[0] || "";
}
function nomesServicos(servicos) {
  return (servicos || []).map((s) => (s && s.nome) || s).join(", ");
}
function money(n) {
  return "R$ " + (Number(n) || 0).toFixed(2).replace(".", ",");
}

/* sinal de 30% só é exigido a partir de R$50 no total do agendamento
   (era R$100 — reduzido a pedido em 2026-10-22). Abaixo disso, confirma
   sem pedir sinal nem Pix. */
const PISO_SINAL = 50;

export function mensagemConfirmacao(a) {
  const exigeSinal = Number(a.total) >= PISO_SINAL;
  const linhas = [
    `✨ Olá, ${primeiroNome(a.cliente)}!`,
    `Passando para confirmar seu atendimento com a Simone Ribeiro – Estética e Bem-Estar.`, "",
    `⏰ ${diaSemanaEData(a.data)}, às ${a.hora}`,
    `*Serviço(s):* ${nomesServicos(a.servicos)}`,
    `📍 Local: Rua Rafino, 51 - Chácara Junqueira`, "",
  ];
  if (exigeSinal) {
    const valorSinal = Number(a.total) * 0.3;
    linhas.push(
      `*Regras do agendamento:* sinal de 30% do valor do procedimento (*${money(valorSinal)}*).`,
      `Pix: 15997133089`, "",
      `⚠️ Caso não consiga comparecer, avise com 24h de antecedência — devolvemos o valor pago. Sem aviso, o valor pago não é devolvido.`,
    );
  } else {
    linhas.push(`⚠️ Caso não consiga comparecer, avise com 24h de antecedência, por favor.`);
  }
  linhas.push(
    `Tolerância de 15 minutos de atraso, para não prejudicar o próximo atendimento!`, "",
    `Estamos ansiosos para te receber e cuidar de você! 💖💆‍♀️`,
  );
  return linhas.join("\n");
}

export function mensagemR24h(a) {
  return [
    `Olá, ${primeiroNome(a.cliente)}! Passando para lembrar que seu atendimento é amanhã, ${fmtDataBR(a.data)}, às ${a.hora}.`, "",
    `*Serviço(s):* ${nomesServicos(a.servicos)}`, "",
    "Podemos confirmar seu horário?",
  ].join("\n");
}

export function mensagemR2h(a) {
  return `Olá, ${primeiroNome(a.cliente)}! Seu atendimento é hoje às ${a.hora}. Estamos te esperando!`;
}
