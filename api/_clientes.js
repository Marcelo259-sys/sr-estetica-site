/* Agenda de clientes que já agendaram alguma vez — usada só para autocompletar
   nome+telefone no "novo agendamento" manual do painel. Um arquivo único
   (não um por mês), porque o volume é pequeno e precisa ser lido inteiro de
   uma vez para a busca por nome funcionar.

   Escrita "melhor-esforço", sem o retry-verify que _dados.js usa nos campos
   de verdade (pagamento/status/lembretes): se uma escrita rara for perdida
   por uma corrida, o pior caso é a Simone digitar o telefone de novo uma
   vez — não afeta nenhum agendamento real. */
import { put } from "@vercel/blob";

const CAMINHO = "agendamentos/_clientes.json";
const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN;

/* URL construída direto (sem list()) — mesmo motivo de _dados.js: list()
   é "operação avançada" no Vercel Blob, com cota bem mais apertada, e foi
   o que estourou o limite do plano Hobby e suspendeu a loja inteira. */
function urlDoArquivo() {
  const storeId = String(process.env.BLOB_STORE_ID || "").replace(/^store_/, "");
  return storeId ? `https://${storeId}.public.blob.vercel-storage.com/${CAMINHO}` : null;
}

export async function lerClientes() {
  const url = urlDoArquivo();
  if (!url) return [];
  try {
    const semCache = url + (url.includes("?") ? "&" : "?") + "_=" + Date.now();
    const r = await fetch(semCache, {
      cache: "no-store",
      headers: { "cache-control": "no-cache", authorization: `Bearer ${TOKEN()}` },
    });
    if (!r.ok) return [];
    const dados = await r.json();
    return Array.isArray(dados) ? dados : [];
  } catch {
    return [];
  }
}

/* Guarda (ou atualiza) o par nome+telefone de uma cliente real — nunca
   chamar para um bloqueio de agenda pessoal, que não é uma cliente. */
export async function upsertCliente(nome, telefone) {
  const nomeLimpo = String(nome || "").trim();
  if (!nomeLimpo) return;
  const telefoneLimpo = String(telefone || "").trim();

  const atuais = await lerClientes();
  const idx = telefoneLimpo
    ? atuais.findIndex((c) => c.telefone === telefoneLimpo)
    : atuais.findIndex((c) => c.nome.toLowerCase() === nomeLimpo.toLowerCase());

  const registro = { nome: nomeLimpo, telefone: telefoneLimpo, atualizadoEm: new Date().toISOString() };
  if (idx === -1) atuais.push(registro);
  else atuais[idx] = registro;

  await put(CAMINHO, JSON.stringify(atuais), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: TOKEN(),
  });
}
