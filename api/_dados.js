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
   Tentamos com token e, se falhar, sem — assim funciona nos dois modos. */
async function baixar(url) {
  let r = await fetch(url, { headers: { authorization: `Bearer ${TOKEN()}` }, cache: "no-store" });
  if (!r.ok) r = await fetch(url, { cache: "no-store" });
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
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: TOKEN(),
  });
  return atuais.length;
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
