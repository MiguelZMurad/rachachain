import React, { useState } from "react";
import { ethers } from "ethers";

// Formulário de criação de grupo.
// Props:
//   meuEndereco: conta conectada (o criador entra no grupo automaticamente)
//   criarGrupo(nome, meuApelido, enderecos[], apelidos[]): função do Dapp
//   cancelar(): fecha o formulário
export function CriarGrupo({ meuEndereco, criarGrupo, cancelar }) {
  const [nome, setNome] = useState("");
  const [meuApelido, setMeuApelido] = useState("");
  const [membros, setMembros] = useState([{ endereco: "", apelido: "" }]);
  const [erro, setErro] = useState(undefined);

  // ---- Manipulação da lista de membros ----
  function atualizar(i, campo, valor) {
    setMembros(membros.map((m, j) => (j === i ? { ...m, [campo]: valor } : m)));
  }

  function adicionarLinha() {
    setMembros([...membros, { endereco: "", apelido: "" }]);
  }

  function removerLinha(i) {
    setMembros(membros.filter((_, j) => j !== i));
  }

  // ---- Validação e envio ----
  function enviar(event) {
    event.preventDefault();

    // Linhas totalmente vazias são ignoradas (permite criar grupo só com você)
    const preenchidos = membros.filter(
      (m) => m.endereco.trim() !== "" || m.apelido.trim() !== ""
    );

    const eu = meuEndereco.toLowerCase();
    const vistos = new Set();

    for (const m of preenchidos) {
      const end = m.endereco.trim();

      if (!ethers.utils.isAddress(end)) {
        return setErro(`Endereço inválido: "${end}"`);
      }
      if (m.apelido.trim() === "") {
        return setErro(`Informe o apelido do membro ${end}`);
      }
      if (end.toLowerCase() === eu) {
        return setErro("Você já entra no grupo automaticamente como criador.");
      }
      if (vistos.has(end.toLowerCase())) {
        return setErro(`Endereço repetido: ${end}`);
      }
      vistos.add(end.toLowerCase());
    }

    setErro(undefined);
    criarGrupo(
      nome.trim(),
      meuApelido.trim(),
      preenchidos.map((m) => ethers.utils.getAddress(m.endereco.trim())),
      preenchidos.map((m) => m.apelido.trim())
    );
  }

  return (
    <div className="card mb-4">
      <div className="card-body">
        <h5 className="card-title">Novo grupo</h5>

        <form onSubmit={enviar}>
          <div className="form-row">
            <div className="form-group col-md-6">
              <label>Nome do grupo</label>
              <input
                className="form-control"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Viagem para Guarapari"
                required
              />
            </div>
            <div className="form-group col-md-6">
              <label>Seu apelido no grupo</label>
              <input
                className="form-control"
                value={meuApelido}
                onChange={(e) => setMeuApelido(e.target.value)}
                placeholder="Ex.: Miguel"
                required
              />
            </div>
          </div>

          <label>Membros</label>
          {membros.map((m, i) => (
            <div className="form-row mb-2" key={i}>
              <div className="col-md-7">
                <input
                  className="form-control"
                  value={m.endereco}
                  onChange={(e) => atualizar(i, "endereco", e.target.value)}
                  placeholder="Endereço (0x...)"
                />
              </div>
              <div className="col-md-4">
                <input
                  className="form-control"
                  value={m.apelido}
                  onChange={(e) => atualizar(i, "apelido", e.target.value)}
                  placeholder="Apelido"
                />
              </div>
              <div className="col-md-1">
                <button
                  type="button"
                  className="btn btn-outline-danger btn-block"
                  onClick={() => removerLinha(i)}
                  title="Remover"
                >
                  ×
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary mb-3"
            onClick={adicionarLinha}
          >
            + Adicionar membro
          </button>

          {erro && <div className="alert alert-danger">{erro}</div>}

          <div>
            <button type="submit" className="btn btn-primary mr-2">
              Criar grupo
            </button>
            <button type="button" className="btn btn-secondary" onClick={cancelar}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}