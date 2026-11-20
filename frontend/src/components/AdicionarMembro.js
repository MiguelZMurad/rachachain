import React, { useState } from "react";
import { ethers } from "ethers";

// Formulário para o criador adicionar um membro a um grupo existente.
// A transação vai para a GrupoFactory (não para o Grupo): é a Factory que
// chama grupo.adicionarMembros(...) e atualiza a lista "meus grupos" do novo membro.
// Props:
//   membros: [{ endereco }] — para evitar adicionar alguém que já está no grupo
//   adicionar(endereco, apelido): função do Dapp
export function AdicionarMembro({ membros, adicionar }) {
  const [endereco, setEndereco] = useState("");
  const [apelido, setApelido] = useState("");
  const [erro, setErro] = useState(undefined);

  async function enviar(event) {
    event.preventDefault();
    const end = endereco.trim();

    if (!ethers.utils.isAddress(end)) return setErro("Endereço inválido.");
    if (apelido.trim() === "") return setErro("Informe o apelido.");
    if (membros.some((m) => m.endereco.toLowerCase() === end.toLowerCase())) {
      return setErro("Esse endereço já é membro do grupo.");
    }

    setErro(undefined);
    const ok = await adicionar(ethers.utils.getAddress(end), apelido.trim());
    if (ok) {
      setEndereco("");
      setApelido("");
    }
  }

  return (
    <div className="card mt-4">
      <div className="card-body">
        <h5 className="card-title">Adicionar membro</h5>
        <p className="text-muted small mb-3">
          Só quem criou o grupo pode adicionar membros.
        </p>

        <form onSubmit={enviar}>
          <div className="form-row">
            <div className="form-group col-md-7">
              <label>Endereço</label>
              <input
                className="form-control"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="0x..."
              />
            </div>
            <div className="form-group col-md-5">
              <label>Apelido</label>
              <input
                className="form-control"
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
                placeholder="Ex.: Dani"
              />
            </div>
          </div>

          {erro && <div className="alert alert-danger">{erro}</div>}

          <button type="submit" className="btn btn-outline-primary">
            Adicionar
          </button>
        </form>
      </div>
    </div>
  );
}