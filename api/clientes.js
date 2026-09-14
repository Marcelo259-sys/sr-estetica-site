/* Lista de clientes já conhecidas (nome + telefone), para autocompletar o
   "novo agendamento" manual do painel. Protegido por senha. */
import { lerClientes } from "./_clientes.js";
import { senhaOk } from "./_dados.js";

export default async function handler(req, res) {
  const auth = senhaOk(req);
  if (!auth.ok) {
    return res.status(auth.motivo.includes("não configurada") ? 503 : 401).json({ erro: auth.motivo });
  }

  try {
    const clientes = await lerClientes();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ clientes });
  } catch (e) {
    console.error("erro ao listar clientes:", e);
    return res.status(500).json({ erro: "falha ao listar clientes", detalhe: String(e.message || e) });
  }
}
