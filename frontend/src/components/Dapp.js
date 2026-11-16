import React from "react";
import { ethers } from "ethers";

// Gerados pelo scripts/deploy.js
import FactoryArtifact from "../contracts/GrupoFactory.json";
import GrupoArtifact from "../contracts/Grupo.json";
import contractAddress from "../contracts/contract-address.json";

// Reaproveitados do boilerplate
import { NoWalletDetected } from "./NoWalletDetected";
import { ConnectWallet } from "./ConnectWallet";
import { Loading } from "./Loading";
import { TransactionErrorMessage } from "./TransactionErrorMessage";
import { WaitingForTransactionMessage } from "./WaitingForTransactionMessage";

// Componentes do RachaChain
import { MeusGrupos } from "./MeusGrupos";
import { CriarGrupo } from "./CriarGrupo";
import { REDES, abreviar } from "./utils";

export class Dapp extends React.Component {
  constructor(props) {
    super(props);

    this.initialState = {
      selectedAddress: undefined, // conta conectada
      chainId: undefined,         // rede atual (decimal)
      redeErro: undefined,        // rede sem suporte ou sem deploy
      grupos: undefined,          // undefined = carregando
      networkError: undefined,

      // Interface
      mostrarCriar: false,        // formulário de novo grupo aberto?

      // Transações
      txBeingSent: undefined,     // hash da transação aguardando mineração
      transactionError: undefined,
    };

    this.state = this.initialState;
  }

  render() {
    // 1. Sem MetaMask
    if (window.ethereum === undefined) {
      return <NoWalletDetected />;
    }

    // 2. Carteira não conectada
    if (!this.state.selectedAddress) {
      return (
        <ConnectWallet
          connectWallet={() => this._connectWallet()}
          networkError={this.state.networkError}
          dismiss={() => this.setState({ networkError: undefined })}
        />
      );
    }

    // 3. Rede sem suporte (ou sem a Factory implantada nela)
    if (this.state.redeErro) {
      return this._renderRedeErro();
    }

    // 4. Carregando os grupos
    if (this.state.grupos === undefined) {
      return <Loading />;
    }

    // 5. Tela principal
    const {
      selectedAddress, chainId, grupos, mostrarCriar, txBeingSent, transactionError,
    } = this.state;

    return (
      <div className="container p-4">
        <h1>RachaChain</h1>
        <p>
          Conectado como <b>{abreviar(selectedAddress)}</b>{" "}
          <span className="badge badge-primary">{REDES[chainId].nome}</span>
        </p>

        <hr />

        {/* Mensagens de transação */}
        {txBeingSent && <WaitingForTransactionMessage txHash={txBeingSent} />}
        {transactionError && (
          <TransactionErrorMessage
            message={this._getRpcErrorMessage(transactionError)}
            dismiss={() => this.setState({ transactionError: undefined })}
          />
        )}

        {mostrarCriar && (
          <CriarGrupo
            meuEndereco={selectedAddress}
            criarGrupo={(...args) => this._criarGrupo(...args)}
            cancelar={() => this.setState({ mostrarCriar: false })}
          />
        )}

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h4 className="mb-0">Meus grupos</h4>
          <div>
            {!mostrarCriar && (
              <button
                className="btn btn-sm btn-primary mr-2"
                onClick={() => this.setState({ mostrarCriar: true })}
              >
                + Novo grupo
              </button>
            )}
            <button
              className="btn btn-sm btn-outline-secondary"
              onClick={() => this._carregarGrupos()}
            >
              Atualizar
            </button>
          </div>
        </div>

        <MeusGrupos grupos={grupos} meuEndereco={selectedAddress} />
      </div>
    );
  }

  _renderRedeErro() {
    return (
      <div className="container p-4">
        <h1>RachaChain</h1>
        <div className="alert alert-warning">{this.state.redeErro}</div>
        <p>Escolha uma rede:</p>
        {Object.entries(REDES).map(([id, rede]) => (
          <button
            key={id}
            className="btn btn-primary mr-2"
            onClick={() => this._trocarRede(rede.hex)}
          >
            {rede.nome}
          </button>
        ))}
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Conexão
  // ------------------------------------------------------------------
  async _connectWallet() {
    const [selectedAddress] = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    this._initialize(selectedAddress);

    // Registra os listeners do MetaMask uma única vez
    if (!this._listenersRegistrados) {
      this._listenersRegistrados = true;

      window.ethereum.on("accountsChanged", ([novo]) => {
        if (novo === undefined) return this.setState(this.initialState);
        this._initialize(novo);
      });

      // Trocar de rede muda o endereço da Factory: recarregar é o mais seguro
      window.ethereum.on("chainChanged", () => window.location.reload());
    }
  }

  async _initialize(userAddress) {
    this.setState({ ...this.initialState, selectedAddress: userAddress });

    // Em qual rede o MetaMask está?
    const chainHex = await window.ethereum.request({ method: "eth_chainId" });
    const chainId = parseInt(chainHex, 16);
    const enderecos = contractAddress[chainId];

    if (!REDES[chainId]) {
      return this.setState({
        chainId,
        redeErro: `A rede atual (chain ID ${chainId}) não é suportada.`,
      });
    }
    if (!enderecos) {
      return this.setState({
        chainId,
        redeErro: `A GrupoFactory ainda não foi implantada na rede ${REDES[chainId].nome}. ` +
          "Na rede local, rode o deploy (npx hardhat run scripts/deploy.js --network localhost).",
      });
    }

    this._provider = new ethers.providers.Web3Provider(window.ethereum);
    this._signer = this._provider.getSigner(0);

    this._factory = new ethers.Contract(
      enderecos.GrupoFactory,
      FactoryArtifact.abi,
      this._signer
    );

    this.setState({ chainId });
    await this._carregarGrupos();
  }

  // Cria um objeto para falar com um contrato Grupo a partir do endereço
  _grupo(endereco) {
    return new ethers.Contract(endereco, GrupoArtifact.abi, this._signer);
  }

  // ------------------------------------------------------------------
  // Leitura dos grupos
  // ------------------------------------------------------------------
  async _carregarGrupos() {
    const eu = this.state.selectedAddress;

    // 1. A Factory diz em quais grupos o usuário está
    const enderecos = await this._factory.getGruposDoUsuario(eu);

    // 2. Cada Grupo é consultado diretamente (em paralelo)
    const grupos = await Promise.all(
      enderecos.map(async (endereco) => {
        const g = this._grupo(endereco);
        const [nome, criador, membros, meuSaldo] = await Promise.all([
          g.nome(),
          g.criador(),
          g.getMembros(),
          g.saldo(eu),
        ]);
        return { endereco, nome, criador, numMembros: membros.length, meuSaldo };
      })
    );

    // Mais recentes primeiro
    this.setState({ grupos: grupos.reverse() });
  }

  // ------------------------------------------------------------------
  // Transações
  // ------------------------------------------------------------------

  // Envia uma transação e cuida das mensagens de espera e de erro.
  // Recebe uma função que devolve a transação. Retorna true se deu certo.
  async _sendTransaction(sendFn) {
    try {
      this.setState({ transactionError: undefined });

      const tx = await sendFn();               // MetaMask abre aqui
      this.setState({ txBeingSent: tx.hash });

      const receipt = await tx.wait();         // espera a mineração
      if (receipt.status === 0) {
        throw new Error("Transação falhou");
      }
      return true;
    } catch (error) {
      // Usuário clicou em "Rejeitar" no MetaMask: não é erro
      if (error.code === 4001 || error.code === "ACTION_REJECTED") {
        return false;
      }
      console.error(error);
      this.setState({ transactionError: error });
      return false;
    } finally {
      this.setState({ txBeingSent: undefined });
    }
  }

  async _criarGrupo(nome, meuApelido, enderecos, apelidos) {
    const ok = await this._sendTransaction(() =>
      this._factory.criarGrupo(nome, meuApelido, enderecos, apelidos)
    );
    if (ok) {
      this.setState({ mostrarCriar: false });
      await this._carregarGrupos();
    }
  }

  // Extrai a mensagem do require do contrato (ex.: "Ja e membro")
  _getRpcErrorMessage(error) {
    const msg =
      error?.error?.data?.message ||
      error?.data?.message ||
      error?.error?.message ||
      error?.reason ||
      error?.message ||
      String(error);

    const match = msg.match(/reverted with reason string '([^']+)'/);
    return match ? match[1] : msg;
  }

  // ------------------------------------------------------------------
  // Rede
  // ------------------------------------------------------------------
  async _trocarRede(chainHex) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }],
      });
      // O listener "chainChanged" recarrega a página
    } catch (error) {
      this.setState({
        redeErro:
          "Não foi possível trocar de rede. Verifique se a rede está adicionada no MetaMask.",
      });
    }
  }
}