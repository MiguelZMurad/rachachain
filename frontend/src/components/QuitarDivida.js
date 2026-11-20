import React, { useState } from "react";
import { ethers } from "ethers";

// Formulário para quitar (total ou parcialmente) o que a conta conectada deve.
// Só é exibido quando o saldo do usuário no grupo é negativo.
// Props:
//   minhaDivida: BigNumber (wei, positivo) — quanto o usuário deve
//   credores: [{ endereco, apelido, saldo }] — membros com saldo > 0
//   quitar(credor, valorWei): função do Dapp (envia ETH pelo contrato)
export function QuitarDivida({ minhaDivida, credores, quitar }) {
  const [credor, setCredor] = useState(credores[0]?.endereco ?? "");
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState(undefined);

  const credorSel = credores.find((c) => c.endereco === credor);

  // O máximo que dá para pagar a esse credor: o menor entre
  // o que eu devo e o que ele tem a receber (mesma regra do contrato)
  const maximo = credorSel
    ? (minhaDivida.lt(credorSel.saldo) ? minhaDivida : credorSel.saldo)
    : undefined;

  function preencherMaximo() {
    if (maximo) setValor(ethers.utils.formatEther(maximo));
  }

  async function enviar(event) {
    event.preventDefault();

    if (!credorSel) return setErro("Escolha a quem pagar.");

    let wei;
    try {
      wei = ethers.utils.parseEther(valor.trim() || "0");
    } catch {
      return setErro("Valor inválido (ex.: 0.01).");
    }
    if (wei.lte(0)) return setErro("Informe um valor maior que zero.");
    if (wei.gt(minhaDivida)) {
      return setErro(
        `Valor maior que sua dívida (${ethers.utils.formatEther(minhaDivida)} ETH).`
      );
    }
    if (wei.gt(credorSel.saldo)) {
      return setErro(
        `${credorSel.apelido} só tem ${ethers.utils.formatEther(credorSel.saldo)} ETH a receber.`
      );
    }

    setErro(undefined);
    const ok = await quitar(credorSel.endereco, wei);
    if (ok) setValor("");
  }

  return (
    <div className="card mt-4 border-danger">
      <div className="card-body">
        <h5 className="card-title">Quitar dívida</h5>
        <p className="mb-3">
          Você deve <b className="text-danger">{ethers.utils.formatEther(minhaDivida)} ETH</b>{" "}
          neste grupo. O valor sai da sua carteira e vai direto para quem tem a receber.
        </p>

        {credores.length === 0 ? (
          <div className="alert alert-secondary">
            Nenhum membro tem valores a receber no momento.
          </div>
        ) : (
          <form onSubmit={enviar}>
            <div className="form-row">
              <div className="form-group col-md-6">
                <label>Pagar para</label>
                <select
                  className="form-control"
                  value={credor}
                  onChange={(e) => {
                    setCredor(e.target.value);
                    setValor("");
                  }}
                >
                  {credores.map((c) => (
                    <option key={c.endereco} value={c.endereco}>
                      {c.apelido} (a receber {ethers.utils.formatEther(c.saldo)} ETH)
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group col-md-6">
                <label>Valor (ETH)</label>
                <div className="input-group">
                  <input
                    className="form-control"
                    type="number"
                    step="any"
                    min="0"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="Ex.: 0.01"
                  />
                  <div className="input-group-append">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={preencherMaximo}
                      title="Preencher com o máximo possível para este credor"
                    >
                      Máximo
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {erro && <div className="alert alert-danger">{erro}</div>}

            <button type="submit" className="btn btn-danger">
              Pagar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}