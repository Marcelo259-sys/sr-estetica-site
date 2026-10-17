/* Camada de acesso às despesas. Mesmo padrão de api/_dados.js: um arquivo
   JSON por mês no Vercel Blob — despesas/AAAA-MM.json. */
import { put } from "@vercel/blob";

const PASTA = "despesas";
const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN;

export function caminhoDoMesDespesa(mes) {
  return `${PASTA}/${mes}.json`;
}

/* URL construída direto, sem list() — mesmo motivo documentado em
   api/_dados.js (list() é "operação avançada" no Vercel Blob, com cota
   apertada; foi o que já suspendeu a loja uma vez neste projeto). */
function urlDoMesDespesa(mes) {
  const storeId = String(process.env.BLOB_STORE_ID || "").replace(/^store_/, "");
  return storeId ? `https://${storeId}.public.blob.vercel-storage.com/${caminhoDoMesDespesa(mes)}` : null;
}

async function baixar(url) {
  const semCache = url + (url.includes("?") ? "&" : "?") + "_=" + Date.now();
  const opc = { cache: "no-store", headers: { "cache-control": "no-cache" } };
  let r = await fetch(semCache, { ...opc, headers: { ...opc.headers, authorization: `Bearer ${TOKEN()}` } });
  if (!r.ok) r = await fetch(semCache, opc);
  if (!r.ok) throw new Error(`falha ao ler despesas do mês: HTTP ${r.status}`);
  return r.json();
}

export async function lerMesDespesas(mes) {
  const url = urlDoMesDespesa(mes);
  if (!url) return [];
  try {
    const dados = await baixar(url);
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

async function gravarTudo(mes, lista) {
  await put(caminhoDoMesDespesa(mes), JSON.stringify(lista), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: TOKEN(),
  });
}

export async function gravarDespesa(item) {
  const atuais = await lerMesDespesas(item.mes);
  atuais.push(item);
  await gravarTudo(item.mes, atuais);
  return atuais.length;
}

/* Mesma lógica de retry-verify de atualizarCampo em _dados.js: escreve,
   espera um pouco, relê para conferir se pegou, e regrava se não pegou —
   mitiga (sem eliminar) a corrida de escritas no mesmo arquivo do mês. */
async function atualizarCampo(mes, id, montarPatch, tentativas = 2) {
  let resultado = null;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const atuais = await lerMesDespesas(mes);
    const idx = atuais.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error("despesa não encontrada neste mês");

    const patch = typeof montarPatch === "function" ? montarPatch(atuais[idx]) : montarPatch;
    atuais[idx] = { ...atuais[idx], ...patch };
    resultado = atuais[idx];

    await gravarTudo(mes, atuais);

    if (tentativa === tentativas) break;
    await new Promise((r) => setTimeout(r, 1500));
    const conferido = await lerMesDespesas(mes);
    const item = conferido.find((d) => d.id === id);
    const bateu = item && Object.keys(patch).every((k) => JSON.stringify(item[k]) === JSON.stringify(patch[k]));
    if (bateu) break;
  }
  return resultado;
}

export async function atualizarDespesa(mes, id, patch) {
  return atualizarCampo(mes, id, { ...patch, atualizadoEm: new Date().toISOString() });
}

/* soft-delete: mantém o registro (auditoria), só marca excluído e some
   das listagens — mesmo espírito do "cancelado" nos agendamentos */
export async function excluirDespesa(mes, id) {
  return atualizarCampo(mes, id, { excluido: true });
}
