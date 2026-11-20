import React from "react";
import { ethers } from "ethers";
import { abreviar, formatarSaldo } from "./utils";
import { RegistrarDespesa } from "./RegistrarDespesa";

// Tela de um grupo: membros com saldos e histórico (montado pelos eventos).
// Props:
//   grupo: { endereco, nome, criador, membros, historico, totalGasto }
//     membros:   [{ endereco, apelido, saldo }]
//     historico: [{ tipo: "despesa" | "quitacao", ... , data }]
//   meuEndereco: conta conectada
//   voltar(): volta para a lista de grupos
//   atualizar(): recarrega os dados do grupo
//   registrarDespesa(descricao, valorWei, participantes[]): função do Dapp
export function DetalheGrupo({ grupo, meuEndereco, voltar, atualizar, registrarDespesa }) {
  const eu = meuEndereco.toLowerCase();
  const souMembro = grupo.membros.some((m) => m.endereco.toLowerCase() === eu);

  // Endereço -> "Apelido" (ou "Apelido (você)")
  const nomeDe = (endereco) => {
    const m = grupo.membros.find(
      (x) => x.endereco.toLowerCase() === endereco.toLowerCase()
    );
    const nome = m ? m.apelido : abreviar(endereco);
    return endereco.toLowerCase() === eu ? `${nome} (você)` : nome;
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button className="btn btn-sm btn-outline-secondary" onClick={voltar}>
          ← Meus grupos
        </button>
        <button className="btn btn-sm btn-outline-secondary" onClick={atualizar}>
          Atualizar
        </button>
      </div>

      <h3>{grupo.nome}</h3>
      <p className="text-muted">
        Criado por {nomeDe(grupo.criador)} · contrato{" "}
        <small>{grupo.endereco}</small>
        <br />
        Total gasto no grupo: <b>{ethers.utils.formatEther(grupo.totalGasto)} ETH</b>
      </p>

      {/* ---------- Membros e saldos ---------- */}
      <h5>Membros e saldos</h5>
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Membro</th>
            <th>Endereço</th>
            <th>Saldo</th>
          </tr>
        </thead>
        <tbody>
          {grupo.membros.map((m) => {
            const s = formatarSaldo(m.saldo);
            const souEu = m.endereco.toLowerCase() === eu;
            return (
              <tr key={m.endereco} className={souEu ? "table-primary" : ""}>
                <td>{nomeDe(m.endereco)}</td>
                <td>
                  <small className="text-muted">{abreviar(m.endereco)}</small>
                </td>
                <td className={s.classe}>{s.texto}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ---------- Registrar despesa (só membros) ---------- */}
      {souMembro && (
        <RegistrarDespesa
          key={`${grupo.endereco}-${grupo.membros.length}`}
          membros={grupo.membros}
          meuEndereco={meuEndereco}
          registrar={registrarDespesa}
        />
      )}

      {/* Etapas 5 e 6 (quitação, adicionar membro) entram aqui */}

      {/* ---------- Histórico ---------- */}
      <h5 className="mt-4">Histórico</h5>
      {grupo.historico.length === 0 ? (
        <div className="alert alert-secondary">Nenhuma movimentação ainda.</div>
      ) : (
        <ul className="list-group">
          {grupo.historico.map((h) => (
            <li className="list-group-item" key={h.chave}>
              <small className="text-muted float-right">
                {h.data.toLocaleString("pt-BR")}
              </small>

              {h.tipo === "despesa" ? (
                <>
                  <span className="badge badge-warning mr-2">Despesa</span>
                  <b>{h.descricao}</b> — {nomeDe(h.pagador)} pagou{" "}
                  <b>{ethers.utils.formatEther(h.valor)} ETH</b>
                  <br />
                  <small className="text-muted">
                    Dividido entre: {h.participantes.map(nomeDe).join(", ")}
                  </small>
                </>
              ) : (
                <>
                  <span className="badge badge-success mr-2">Quitação</span>
                  {nomeDe(h.devedor)} pagou{" "}
                  <b>{ethers.utils.formatEther(h.valor)} ETH</b> para{" "}
                  {nomeDe(h.credor)}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}