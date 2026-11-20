import React, { useState } from "react";
import { ethers } from "ethers";

// Formulário de nova despesa dentro de um grupo.
// Quem registra é sempre a conta conectada (ela é o "pagador").
// Props:
//   membros: [{ endereco, apelido }]
//   meuEndereco: conta conectada
//   registrar(descricao, valorWei, participantes[]): função do Dapp
export function RegistrarDespesa({ membros, meuEndereco, registrar }) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  // Por padrão, todos os membros participam
  const [selecionados, setSelecionados] = useState(
    () => new Set(membros.map((m) => m.endereco))
  );
  const [erro, setErro] = useState(undefined);

  function alternar(endereco) {
    const novo = new Set(selecionados);
    novo.has(endereco) ? novo.delete(endereco) : novo.add(endereco);
    setSelecionados(novo);
  }

  // Converte o valor digitado para wei (ou undefined se inválido)
  function valorEmWei() {
    try {
      const wei = ethers.utils.parseEther(valor.trim() || "0");
      return wei.gt(0) ? wei : undefined;
    } catch {
      return undefined; // ex.: "abc" ou mais de 18 casas decimais
    }
  }

  // Prévia de quanto cada participante vai dever
  const wei = valorEmWei();
  const n = selecionados.size;
  const parte = wei && n > 0 ? wei.div(n) : undefined;

  async function enviar(event) {
    event.preventDefault();

    if (descricao.trim() === "") return setErro("Informe uma descrição.");
    if (!wei) return setErro("Informe um valor maior que zero (ex.: 0.03).");
    if (n === 0) return setErro("Selecione pelo menos um participante.");
    if (parte.isZero()) return setErro("Valor pequeno demais para dividir.");

    setErro(undefined);
    // Mantém a ordem dos membros do grupo
    const participantes = membros
      .map((m) => m.endereco)
      .filter((e) => selecionados.has(e));

    const ok = await registrar(descricao.trim(), wei, participantes);
    if (ok) {
      // Limpa o formulário para a próxima despesa
      setDescricao("");
      setValor("");
    }
  }

  const eu = meuEndereco.toLowerCase();

  return (
    <div className="card mt-4">
      <div className="card-body">
        <h5 className="card-title">Registrar despesa</h5>
        <p className="text-muted small mb-3">
          Você será registrado(a) como quem pagou.
        </p>

        <form onSubmit={enviar}>
          <div className="form-row">
            <div className="form-group col-md-7">
              <label>Descrição</label>
              <input
                className="form-control"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex.: Gasolina"
              />
            </div>
            <div className="form-group col-md-5">
              <label>Valor (ETH)</label>
              <input
                className="form-control"
                type="number"
                step="any"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Ex.: 0.03"
              />
            </div>
          </div>

          <label>Dividir entre</label>
          <div className="mb-2">
            {membros.map((m) => (
              <div className="form-check form-check-inline" key={m.endereco}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`p-${m.endereco}`}
                  checked={selecionados.has(m.endereco)}
                  onChange={() => alternar(m.endereco)}
                />
                <label className="form-check-label" htmlFor={`p-${m.endereco}`}>
                  {m.apelido}
                  {m.endereco.toLowerCase() === eu ? " (você)" : ""}
                </label>
              </div>
            ))}
          </div>

          {parte && !parte.isZero() && (
            <p className="small text-muted">
              Cada participante fica devendo{" "}
              <b>{ethers.utils.formatEther(parte)} ETH</b>.
            </p>
          )}

          {erro && <div className="alert alert-danger">{erro}</div>}

          <button type="submit" className="btn btn-warning">
            Registrar despesa
          </button>
        </form>
      </div>
    </div>
  );
}