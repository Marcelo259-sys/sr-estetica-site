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
   O parâmetro de tempo evita cópia em cache da CDN — sem ele, gravações
   seguidas liam uma versão velha e um agendamento sobrescrevia o outro. */
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
   status...). Sempre a mesma receita: lê o mês, troca o registro, regrava
   o arquivo inteiro. */
async function atualizarCampo(mes, id, patch) {
  const atuais = await lerMes(mes);
  const idx = atuais.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error("agendamento não encontrado neste mês");
  atuais[idx] = { ...atuais[idx], ...patch };
  await put(caminhoDoMes(mes), JSON.stringify(atuais), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: TOKEN(),
  });
  return atuais[idx];
}

export async function atualizarPagamento(mes, id, pagamento) {
  return atualizarCampo(mes, id, { pagamento });
}

/* tipo: "confirmacao" | "r24h" | "r2h" — marca (ou desmarca) que aquele
   lembrete já foi enviado, sem mexer nos outros dois */
export async function atualizarLembrete(mes, id, tipo, valor) {
  const atuais = await lerMes(mes);
  const idx = atuais.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error("agendamento não encontrado neste mês");
  const atual = atuais[idx].lembretes || { confirmacao: false, r24h: false, r2h: false };
  atuais[idx] = { ...atuais[idx], lembretes: { ...atual, [tipo]: !!valor } };
  await put(caminhoDoMes(mes), JSON.stringify(atuais), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: TOKEN(),
  });
  return atuais[idx];
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
