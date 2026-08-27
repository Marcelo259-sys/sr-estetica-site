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

export function mensagemConfirmacao(a) {
  return [
    `✨ Olá, ${primeiroNome(a.cliente)}!`,
    `Passando para confirmar seu atendimento com a Simone Ribeiro – Estética e Bem-Estar.`, "",
    `⏰ ${diaSemanaEData(a.data)}, às ${a.hora}`,
    `*Serviço(s):* ${nomesServicos(a.servicos)}`,
    `📍 Local: Largo do Mercado, 19 - sala 2`,
    `(Referência na calçada do Pozitel Supermercado, em frente ao Mercado Municipal)`, "",
    `*Regras do agendamento:* sinal de 30% do valor do procedimento.`,
    `Pix: 15997133089`, "",
    `⚠️ Caso não consiga comparecer, avise com 24h de antecedência — devolvemos o valor pago. Sem aviso, o valor pago não é devolvido.`,
    `Tolerância de 15 minutos de atraso, para não prejudicar o próximo atendimento!`, "",
    `Estamos ansiosos para te receber e cuidar de você! 💖💆‍♀️`,
  ].join("\n");
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
