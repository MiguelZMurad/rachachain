import { ethers } from "ethers";

// Redes suportadas pela dApp (chave = chain ID em decimal)
export const REDES = {
  31337: { nome: "Hardhat Local", hex: "0x7a69" },
  11155111: { nome: "Sepolia", hex: "0xaa36a7" },
};

// Endereço abreviado: 0x1234...abcd
export function abreviar(endereco) {
  return `${endereco.slice(0, 6)}...${endereco.slice(-4)}`;
}

// Interpreta um saldo do contrato (int256, em wei) para exibição:
//   > 0 tem a receber | < 0 deve | = 0 quite
export function formatarSaldo(saldo) {
  if (saldo.isZero()) {
    return { texto: "Quite", classe: "text-muted" };
  }
  const valor = ethers.utils.formatEther(saldo.abs());
  if (saldo.gt(0)) {
    return { texto: `A receber ${valor} ETH`, classe: "text-success" };
  }
  return { texto: `Deve ${valor} ETH`, classe: "text-danger" };
}
