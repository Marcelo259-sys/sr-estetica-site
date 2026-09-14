/* Importação única (mas segura de rodar mais de uma vez) dos clientes que já
   agendaram antes de existir a lista de autocompletar (_clientes.js). Varre
   todos os arquivos de mês já salvos e monta a lista de uma vez só — ao
   contrário de upsertCliente (usado no dia a dia), aqui NÃO faz um
   read-modify-write por registro, que seria lentíssimo e arriscado com
   muitos meses de histórico. */
import { list, put } from "@vercel/blob";
import { lerMes, senhaOk } from "./_dados.js";
import { lerClientes } from "./_clientes.js";

const CAMINHO = "agendamentos/_clientes.json";
const TOKEN = () => process.env.BLOB_READ_WRITE_TOKEN;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "use POST" });

  const auth = senhaOk(req);
  if (!auth.ok) {
    return res.status(auth.motivo.includes("não configurada") ? 503 : 401).json({ erro: auth.motivo });
  }

  try {
    const { blobs } = await list({ prefix: "agendamentos/", token: TOKEN() });
    const meses = blobs
      .map((b) => b.pathname)
      .filter((p) => /^agendamentos\/\d{4}-\d{2}\.json$/.test(p))
      .map((p) => p.slice("agendamentos/".length, -".json".length));

    /* chave = telefone (se tiver) ou nome em minúsculas — mantém sempre o
       registro mais recente pra cada cliente */
    const mapa = new Map();
    const upsert = (nome, telefone, quando) => {
      const nomeLimpo = String(nome || "").trim();
      if (!nomeLimpo) return;
      const telefoneLimpo = String(telefone || "").trim();
      const chave = telefoneLimpo || nomeLimpo.toLowerCase();
      const atual = mapa.get(chave);
      const quandoStr = String(quando || "");
      if (!atual || quandoStr > String(atual.atualizadoEm || "")) {
        mapa.set(chave, { nome: nomeLimpo, telefone: telefoneLimpo, atualizadoEm: quandoStr || new Date(0).toISOString() });
      }
    };

    // parte da lista atual, pra não perder quem já foi cadastrado no dia a dia
    (await lerClientes()).forEach((c) => upsert(c.nome, c.telefone, c.atualizadoEm));

    for (const mes of meses) {
      const registros = await lerMes(mes);
      registros.forEach((a) => {
        if (a.bloqueio || !a.cliente) return; // bloqueio pessoal não é cliente
        upsert(a.cliente, a.telefone, a.criadoEm);
      });
    }

    const lista = [...mapa.values()];
    await put(CAMINHO, JSON.stringify(lista), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      token: TOKEN(),
    });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, mesesVarridos: meses.length, clientesNaLista: lista.length });
  } catch (e) {
    console.error("erro ao importar clientes:", e);
    return res.status(500).json({ erro: "falha ao importar", detalhe: String(e.message || e) });
  }
}
