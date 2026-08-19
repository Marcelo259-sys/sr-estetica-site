/* Camada de acesso aos agendamentos.
   Guardamos um arquivo JSON por mês no Vercel Blob: agendamentos/AAAA-MM.json
   Um arquivo por mês (e não por agendamento) para o painel ler tudo de uma vez. */
import { put, list } from "@vercel/blob";

const PASTA = "agendamentos";
const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN;

export function mesDe(iso) {
  return String(iso || "").slice(0, 7);
}

export function caminhoDoMes(mes) {
  return `${PASTA}/${mes}.json`;
}

/* Descobre a URL do arquivo do mês, se ele já existir. */
async function urlDoMes(mes) {
  const { blobs } = await list({ prefix: caminhoDoMes(mes), token: TOKEN() });
  const alvo = blobs.find((b) => b.pathname === caminhoDoMes(mes));
  return alvo ? alvo.downloadUrl || alvo.url : null;
}

/* O blob é privado: a leitura precisa do token no cabeçalho.
   O parâmetro de tempo evita cópia em cache da CDN — mas não resolve tudo:
   o próprio armazenamento pode levar segundos (às vezes dezenas de
   segundos) para uma escrita ficar visível numa leitura separada. */
async function baixar(url) {
  const semCache = url + (url.includes("?") ? "&" : "?") + "_=" + Date.now();
  const opc = { cache: "no-store", headers: { "cache-control": "no-cache" } };
  let r = await fetch(semCache, { ...opc, headers: { ...opc.headers, authorization: `Bearer ${TOKEN()}` } });
  if (!r.ok) r = await fetch(semCache, opc);
  if (!r.ok) throw new Error(`falha ao ler o arquivo do mês: HTTP ${r.status}`);
  return r.json();
}

export async function lerMes(mes) {
  const url = await urlDoMes(mes);
  if (!url) return [];
  try {
    const dados = await baixar(url);
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

export async function gravarAgendamento(item) {
  const mes = mesDe(item.data) || mesDe(new Date().toISOString());
  const atuais = await lerMes(mes);
  atuais.push(item);
  await put(caminhoDoMes(mes), JSON.stringify(atuais), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: TOKEN(),
  });
  return atuais.length;
}

/* Reescreve um campo de um agendamento já gravado (pagamento, lembretes,
   status...). A receita é ler o mês inteiro, trocar só aquele registro e
   regravar o arquivo — o que expõe uma corrida real: se duas chamadas
   mexerem no MESMO mês em sequência rápida, a segunda pode ler uma cópia
   ainda sem a mudança da primeira (o armazenamento demora a propagar) e
   regravar por cima, apagando a primeira mudança sem erro nenhum.
   Testado e confirmado: cancelar dois agendamentos em sequência rápida fez
   um deles voltar sozinho para "confirmado".
   Mitigação: depois de escrever, espera um pouco e lê de novo para
   conferir se a mudança pegou; se não pegou, regrava. Não elimina o risco
   por completo (o atraso já chegou a passar de 40s em casos extremos), mas
   cobre a janela mais provável sem deixar o usuário esperando demais. */
async function atualizarCampo(mes, id, montarPatch, tentativas = 2) {
  let resultado = null;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const atuais = await lerMes(mes);
    const idx = atuais.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("agendamento não encontrado neste mês");

    const patch = typeof montarPatch === "function" ? montarPatch(atuais[idx]) : montarPatch;
    atuais[idx] = { ...atuais[idx], ...patch };
    resultado = atuais[idx];

    await put(caminhoDoMes(mes), JSON.stringify(atuais), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token: TOKEN(),
    });

    if (tentativa === tentativas) break;

    await new Promise((r) => setTimeout(r, 1500));
    const conferido = await lerMes(mes);
    const item = conferido.find((a) => a.id === id);
    const bateu = item && Object.keys(patch).every((k) => JSON.stringify(item[k]) === JSON.stringify(patch[k]));
    if (bateu) break;
    // não bateu: a próxima volta lê de novo (já deve incluir a 1ª escrita) e regrava
  }
  return resultado;
}

export async function atualizarPagamento(mes, id, pagamento) {
  return atualizarCampo(mes, id, { pagamento });
}

/* tipo: "confirmacao" | "r24h" | "r2h" — marca (ou desmarca) que aquele
   lembrete já foi enviado, sem mexer nos outros dois */
export async function atualizarLembrete(mes, id, tipo, valor) {
  return atualizarCampo(mes, id, (atual) => {
    const base = atual.lembretes || { confirmacao: false, r24h: false, r2h: false };
    return { lembretes: { ...base, [tipo]: !!valor } };
  });
}

/* status: "confirmado" | "cancelado" */
export async function atualizarStatus(mes, id, status) {
  return atualizarCampo(mes, id, { status });
}

/* Confere a senha do painel. Sem senha configurada, o painel fica fechado. */
export function senhaOk(req) {
  const esperada = process.env.PAINEL_SENHA;
  if (!esperada) return { ok: false, motivo: "PAINEL_SENHA não configurada no projeto" };
  const url = new URL(req.url, "http://x");
  const enviada = url.searchParams.get("senha") || req.headers["x-senha"] || "";
  if (enviada !== esperada) return { ok: false, motivo: "senha incorreta" };
  return { ok: true };
}
