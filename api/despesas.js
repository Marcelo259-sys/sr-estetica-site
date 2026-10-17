/* Lista e cria despesas de um mês. Protegido por senha (painel). */
import { lerMesDespesas, gravarDespesa } from "./_despesas.js";
import { senhaOk } from "./_dados.js";

export const CATEGORIAS = [
  "Materiais", "Produtos de higiene", "Aluguel", "Água e energia",
  "Internet e telefone", "Marketing", "Cursos", "Equipamentos",
  "Taxas de cartão", "Impostos", "Outras",
];
const FORMAS_VALIDAS = new Set(["pix", "debito", "credito", "dinheiro", "outros"]);

function hojeSP() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

/* "vencido" é calculado na leitura, nunca gravado */
function comVencido(d, hoje) {
  const vencido = d.status === "pendente" && !!d.vencimento && d.vencimento < hoje;
  return { ...d, statusExibicao: vencido ? "vencido" : d.status };
}

export default async function handler(req, res) {
  const auth = senhaOk(req);
  if (!auth.ok) {
    return res.status(auth.motivo.includes("não configurada") ? 503 : 401).json({ erro: auth.motivo });
  }

  if (req.method === "GET") {
    try {
      const url = new URL(req.url, "http://x");
      const mes = String(url.searchParams.get("mes") || hojeSP().slice(0, 7)).slice(0, 7);
      const hoje = hojeSP();
      const despesas = (await lerMesDespesas(mes))
        .filter((d) => !d.excluido)
        .map((d) => comVencido(d, hoje))
        .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""));
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ mes, despesas });
    } catch (e) {
      console.error("erro ao listar despesas:", e);
      return res.status(500).json({ erro: "falha ao listar despesas", detalhe: String(e.message || e) });
    }
  }

  if (req.method === "POST") {
    try {
      let corpo = req.body;
      if (typeof corpo === "string") corpo = JSON.parse(corpo);
      const b = corpo || {};

      const descricao = String(b.descricao || "").trim().slice(0, 140);
      const categoria = CATEGORIAS.includes(b.categoria) ? b.categoria : "Outras";
      const valor = Number(b.valor);
      const vencimento = String(b.vencimento || "").slice(0, 10);
      const forma = b.forma && FORMAS_VALIDAS.has(b.forma) ? b.forma : null;
      const recorrencia = b.recorrencia === "mensal" ? "mensal" : null;

      if (!descricao) return res.status(400).json({ erro: "falta a descrição" });
      if (!(valor > 0)) return res.status(400).json({ erro: "valor inválido" });
      if (!vencimento) return res.status(400).json({ erro: "falta a data de vencimento" });

      const mes = vencimento.slice(0, 7);
      const item = {
        mes,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        descricao, categoria, valor, vencimento,
        dataPagamento: null,
        status: "pendente",
        forma,
        observacoes: String(b.observacoes || "").slice(0, 300),
        recorrencia,
        excluido: false,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };

      const total = await gravarDespesa(item);
      return res.status(200).json({ ok: true, despesa: item, gravadas_no_mes: total });
    } catch (e) {
      console.error("erro ao criar despesa:", e);
      return res.status(500).json({ erro: "falha ao gravar despesa", detalhe: String(e.message || e) });
    }
  }

  return res.status(405).json({ erro: "use GET ou POST" });
}
