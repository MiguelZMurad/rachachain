import React from "react";
import { abreviar, formatarSaldo } from "./utils";

// Lista os grupos de que o usuário participa.
// Props:
//   grupos: [{ endereco, nome, criador, numMembros, meuSaldo }]
//   meuEndereco: endereço da conta conectada
export function MeusGrupos({ grupos, meuEndereco }) {
  if (grupos.length === 0) {
    return (
      <div className="alert alert-secondary">
        Você ainda não participa de nenhum grupo.
      </div>
    );
  }

  return (
    <table className="table table-hover">
      <thead>
        <tr>
          <th>Grupo</th>
          <th>Membros</th>
          <th>Meu saldo</th>
          <th>Contrato</th>
        </tr>
      </thead>
      <tbody>
        {grupos.map((g) => {
          const saldo = formatarSaldo(g.meuSaldo);
          const souCriador =
            g.criador.toLowerCase() === meuEndereco.toLowerCase();
          return (
            <tr key={g.endereco}>
              <td>
                <b>{g.nome}</b>{" "}
                {souCriador && (
                  <span className="badge badge-info">criado por você</span>
                )}
              </td>
              <td>{g.numMembros}</td>
              <td className={saldo.classe}>{saldo.texto}</td>
              <td>
                <small className="text-muted">{abreviar(g.endereco)}</small>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
