/* Textos das mensagens automáticas.
   Mesmo conteúdo usado nos botões manuais do painel — se mudar aqui,
   replique também em painel.html (lá é JS de navegador, cópia separada
   porque não dá para importar um módulo Node dentro do HTML do painel).
   Sem emoji de propósito: já vimos emoji virar "�" em mensagem de WhatsApp
   montada por link/API neste mesmo projeto. */
const NOME_CLINICA = "SR Estética e Bem Estar";

function fmtDataBR(iso) {
  const d = new Date(String(iso) + "T12:00:00");
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
}
function primeiroNome(nome) {
  return String(nome || "").trim().split(/\s+/)[0] || "";
}
function nomesServicos(servicos) {
  return (servicos || []).map((s) => (s && s.nome) || s).join(", ");
}

export function mensagemConfirmacao(a) {
  return [
    `*Agendamento confirmado — ${NOME_CLINICA}*`, "",
    `Olá, ${primeiroNome(a.cliente)}!`, "",
    `*Data:* ${fmtDataBR(a.data)}`,
    `*Horário:* ${a.hora}`,
    `*Serviço(s):* ${nomesServicos(a.servicos)}`, "",
    "Qualquer imprevisto, é só chamar por aqui.",
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
