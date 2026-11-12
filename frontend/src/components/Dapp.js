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

// Componentes do RachaChain
import { MeusGrupos } from "./MeusGrupos";
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
    };

    this.state = this.initialState;
  }

  render() {
    // 1. Sem MetaMask
    if (window.ethereum === undefined) {
      return <NoWalletDetected />;
    }

    // 2. Carteira nÃ£o conectada
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
    const { selectedAddress, chainId, grupos } = this.state;

    return (
      <div className="container p-4">
        <h1>RachaChain</h1>
        <p>
          Conectado como <b>{abreviar(selectedAddress)}</b>{" "}
          <span className="badge badge-primary">{REDES[chainId].nome}</span>
        </p>

        <hr />

        <div className="d-flex justify-content-between align-items-center mb-2">
          <h4 className="mb-0">Meus grupos</h4>
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={() => this._carregarGrupos()}
          >
            Atualizar
          </button>
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
  // ConexÃ£o
  // ------------------------------------------------------------------
  async _connectWallet() {
    const [selectedAddress] = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    this._initialize(selectedAddress);

    // Registra os listeners do MetaMask uma Ãºnica vez
    if (!this._listenersRegistrados) {
      this._listenersRegistrados = true;

      window.ethereum.on("accountsChanged", ([novo]) => {
        if (novo === undefined) return this.setState(this.initialState);
        this._initialize(novo);
      });

      // Trocar de rede muda o endereÃ§o da Factory: recarregar Ã© o mais seguro
      window.ethereum.on("chainChanged", () => window.location.reload());
    }
  }

  async _initialize(userAddress) {
    this.setState({ ...this.initialState, selectedAddress: userAddress });

    // Em qual rede o MetaMask estÃ¡?
    const chainHex = await window.ethereum.request({ method: "eth_chainId" });
    const chainId = parseInt(chainHex, 16);
    const enderecos = contractAddress[chainId];

    if (!REDES[chainId]) {
      return this.setState({
        chainId,
        redeErro: `A rede atual (chain ID ${chainId}) nÃ£o Ã© suportada.`,
      });
    }
    if (!enderecos) {
      return this.setState({
        chainId,
        redeErro: `A GrupoFactory ainda nÃ£o foi implantada na rede ${REDES[chainId].nome}. ` +
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

  // Cria um objeto para falar com um contrato Grupo a partir do endereÃ§o
  _grupo(endereco) {
    return new ethers.Contract(endereco, GrupoArtifact.abi, this._signer);
  }

  // ------------------------------------------------------------------
  // Leitura dos grupos
  // ------------------------------------------------------------------
  async _carregarGrupos() {
    const eu = this.state.selectedAddress;

    // 1. A Factory diz em quais grupos o usuÃ¡rio estÃ¡
    const enderecos = await this._factory.getGruposDoUsuario(eu);

    // 2. Cada Grupo Ã© consultado diretamente (em paralelo)
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
  // Rede
  // ------------------------------------------------------------------
  async _trocarRede(chainHex) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }],
      });
      // O listener "chainChanged" recarrega a pÃ¡gina
    } catch (error) {
      this.setState({
        redeErro:
          "NÃ£o foi possÃ­vel trocar de rede. Verifique se a rede estÃ¡ adicionada no MetaMask.",
      });
    }
  }
}
