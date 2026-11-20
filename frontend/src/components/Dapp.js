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
import { DetalheGrupo } from "./DetalheGrupo";
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
      grupoAberto: undefined,     // endereço do grupo exibido (undefined = lista)
      detalhe: undefined,         // dados do grupo aberto (undefined = carregando)

      // Transações
      txBeingSent: undefined,     // hash da transação aguardando mineração
      transactionError: undefined,

      // Eventos
      aviso: undefined,           // última atividade detectada por evento
    };

    this.state = this.initialState;
  }

  componentWillUnmount() {
    this._pararEventos();
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
      grupoAberto, detalhe,
    } = this.state;

    return (
      <div className="container p-4">
        <h1>RachaChain</h1>
        <p>
          Conectado como <b>{abreviar(selectedAddress)}</b>{" "}
          <span className="badge badge-primary">{REDES[chainId].nome}</span>
        </p>

        <hr />

        {/* Atividade detectada pelos eventos dos contratos */}
        {this.state.aviso && (
          <div className="alert alert-info d-flex justify-content-between align-items-center">
            <span>🔔 {this.state.aviso}</span>
            <button
              type="button"
              className="close"
              onClick={() => this.setState({ aviso: undefined })}
            >
              <span>&times;</span>
            </button>
          </div>
        )}

        {/* Mensagens de transação */}
        {txBeingSent && <WaitingForTransactionMessage txHash={txBeingSent} />}
        {transactionError && (
          <TransactionErrorMessage
            message={this._getRpcErrorMessage(transactionError)}
            dismiss={() => this.setState({ transactionError: undefined })}
          />
        )}

        {/* Tela de um grupo */}
        {grupoAberto && (
          detalhe ? (
            <DetalheGrupo
              grupo={detalhe}
              meuEndereco={selectedAddress}
              voltar={() => this._fecharGrupo()}
              atualizar={() => this._carregarDetalhe(grupoAberto)}
              registrarDespesa={(...args) => this._registrarDespesa(grupoAberto, ...args)}
              quitar={(...args) => this._quitar(grupoAberto, ...args)}
              adicionarMembro={(...args) => this._adicionarMembro(grupoAberto, ...args)}
            />
          ) : (
            <Loading />
          )
        )}

        {/* Lista de grupos */}
        {!grupoAberto && (<>
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

        <MeusGrupos
          grupos={grupos}
          meuEndereco={selectedAddress}
          abrir={(endereco) => this._abrirGrupo(endereco)}
        />
        </>)}
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
    this._pararEventos(); // troca de conta: descarta os listeners da conta anterior
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

    try {
      // Existe mesmo um contrato nesse endereço? Na rede local, a Factory some
      // sempre que o "npx hardhat node" é reiniciado sem um novo deploy.
      const codigo = await this._provider.getCode(enderecos.GrupoFactory);
      if (codigo === "0x") {
        return this.setState({
          chainId,
          redeErro:
            `Nenhum contrato GrupoFactory encontrado em ${enderecos.GrupoFactory} ` +
            `na rede ${REDES[chainId].nome}. ` +
            (chainId === 31337
              ? "A blockchain local provavelmente foi reiniciada: rode o deploy " +
                "(npx hardhat run scripts/deploy.js --network localhost) e recarregue a página."
              : "Confira o endereço em frontend/src/contracts/contract-address.json."),
        });
      }

      this.setState({ chainId });
      await this._iniciarEventos();
      await this._carregarGrupos();
    } catch (error) {
      console.error(error);
      this.setState({
        chainId,
        redeErro:
          `Não foi possível falar com a rede ${REDES[chainId].nome}. ` +
          (chainId === 31337
            ? "Verifique se o \"npx hardhat node\" está rodando."
            : "Verifique sua conexão.") +
          ` (Detalhe: ${error.message})`,
      });
    }
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
    this._escutarGrupos(enderecos);
  }

  // ------------------------------------------------------------------
  // Tela de um grupo
  // ------------------------------------------------------------------
  async _abrirGrupo(endereco) {
    this.setState({ grupoAberto: endereco, detalhe: undefined, mostrarCriar: false });
    await this._carregarDetalhe(endereco);
  }

  _fecharGrupo() {
    this.setState({ grupoAberto: undefined, detalhe: undefined });
    this._carregarGrupos(); // saldos podem ter mudado
  }

  async _carregarDetalhe(endereco) {
    const g = this._grupo(endereco);

    // 1. Estado atual do contrato: nome, criador e membros com apelido e saldo
    const [nome, criador, enderecosMembros] = await Promise.all([
      g.nome(),
      g.criador(),
      g.getMembros(),
    ]);
    const membros = await Promise.all(
      enderecosMembros.map(async (m) => ({
        endereco: m,
        apelido: await g.apelido(m),
        saldo: await g.saldo(m),
      }))
    );

    // 2. Histórico: lido dos EVENTOS emitidos pelo contrato
    //    (a lista de participantes de cada despesa só existe no evento)
    const [despesas, quitacoes] = await Promise.all([
      g.queryFilter(g.filters.DespesaRegistrada(), 0, "latest"),
      g.queryFilter(g.filters.DividaQuitada(), 0, "latest"),
    ]);

    // Data de cada evento = timestamp do bloco em que ele foi minerado
    const blocos = {};
    const dataDo = async (ev) => {
      if (!blocos[ev.blockNumber]) {
        blocos[ev.blockNumber] = await ev.getBlock();
      }
      return new Date(blocos[ev.blockNumber].timestamp * 1000);
    };

    const historico = await Promise.all([
      ...despesas.map(async (ev) => ({
        tipo: "despesa",
        chave: `${ev.transactionHash}-${ev.logIndex}`,
        ordem: [ev.blockNumber, ev.logIndex],
        pagador: ev.args.pagador,
        valor: ev.args.valor,
        descricao: ev.args.descricao,
        participantes: ev.args.participantes,
        data: await dataDo(ev),
      })),
      ...quitacoes.map(async (ev) => ({
        tipo: "quitacao",
        chave: `${ev.transactionHash}-${ev.logIndex}`,
        ordem: [ev.blockNumber, ev.logIndex],
        devedor: ev.args.devedor,
        credor: ev.args.credor,
        valor: ev.args.valor,
        data: await dataDo(ev),
      })),
    ]);

    // Mais recentes primeiro
    historico.sort((a, b) => b.ordem[0] - a.ordem[0] || b.ordem[1] - a.ordem[1]);

    const totalGasto = despesas.reduce(
      (soma, ev) => soma.add(ev.args.valor),
      ethers.BigNumber.from(0)
    );

    // Só atualiza se o usuário ainda estiver olhando este grupo
    if (this.state.grupoAberto === endereco) {
      this.setState({
        detalhe: { endereco, nome, criador, membros, historico, totalGasto },
      });
    }
  }

  // ------------------------------------------------------------------
  // Eventos em tempo real (requisito 3: a interface CAPTURA os eventos)
  // ------------------------------------------------------------------

  // Escuta os eventos da Factory. Os grupos são escutados em _escutarGrupos.
  async _iniciarEventos() {
    this._pararEventos();
    this._gruposEscutados = {};

    // De quanto em quanto tempo o ethers pergunta à rede por eventos novos
    this._provider.pollingInterval = 1000;

    // Só interessam eventos a partir de agora (o histórico vem do queryFilter)
    this._blocoInicial = await this._provider.getBlockNumber();

    // Alguém criou um grupo: posso ter sido incluído como membro
    this._factory.on("GrupoCriado", (grupo, criador, nome, ev) => {
      if (ev.blockNumber <= this._blocoInicial) return;
      this._aoEvento(grupo, () => `${this._quem(criador)} criou o grupo "${nome}"`);
    });

    // O criador de um grupo adicionou alguém
    this._factory.on("MembroAdicionadoAoGrupo", (grupo, membro, ev) => {
      if (ev.blockNumber <= this._blocoInicial) return;
      this._aoEvento(grupo, (nomeGrupo) =>
        `${this._quem(membro)} entrou no grupo "${nomeGrupo}"`
      );
    });
  }

  // Escuta os eventos de cada grupo da lista (só assina uma vez por grupo)
  _escutarGrupos(enderecos) {
    if (!this._gruposEscutados) return;

    for (const endereco of enderecos) {
      if (this._gruposEscutados[endereco]) continue;

      const g = this._grupo(endereco);
      this._gruposEscutados[endereco] = g;

      g.on("DespesaRegistrada", (id, pagador, valor, descricao, participantes, ev) => {
        if (ev.blockNumber <= this._blocoInicial) return;
        this._aoEvento(endereco, (nomeGrupo) =>
          `${this._quem(pagador)} registrou "${descricao}" ` +
          `(${ethers.utils.formatEther(valor)} ETH) em "${nomeGrupo}"`
        );
      });

      g.on("DividaQuitada", (devedor, credor, valor, ev) => {
        if (ev.blockNumber <= this._blocoInicial) return;
        this._aoEvento(endereco, (nomeGrupo) =>
          `${this._quem(devedor)} pagou ${ethers.utils.formatEther(valor)} ETH ` +
          `para ${this._quem(credor)} em "${nomeGrupo}"`
        );
      });
    }
  }

  // Reação comum a qualquer evento: recarrega a tela e mostra um aviso.
  // Vários eventos no mesmo instante (ex.: criarGrupo emite GrupoCriado e
  // vários MembroAdicionado) geram uma única atualização.
  _aoEvento(enderecoGrupo, textoFn) {
    this._eventosPendentes = [...(this._eventosPendentes || []), { enderecoGrupo, textoFn }];
    clearTimeout(this._timerEventos);

    this._timerEventos = setTimeout(async () => {
      const pendentes = this._eventosPendentes;
      this._eventosPendentes = [];

      await this._carregarGrupos();
      if (this.state.grupoAberto) {
        await this._carregarDetalhe(this.state.grupoAberto);
      }

      // Só avisa sobre grupos dos quais o usuário participa
      const meus = {};
      for (const g of this.state.grupos || []) meus[g.endereco.toLowerCase()] = g.nome;
      const textos = pendentes
        .filter((p) => meus[p.enderecoGrupo.toLowerCase()] !== undefined)
        .map((p) => p.textoFn(meus[p.enderecoGrupo.toLowerCase()]));

      if (textos.length > 0) {
        this.setState({ aviso: textos[textos.length - 1] });
        clearTimeout(this._timerAviso);
        this._timerAviso = setTimeout(() => this.setState({ aviso: undefined }), 8000);
      }
    }, 500);
  }

  _pararEventos() {
    if (this._factory) this._factory.removeAllListeners();
    for (const g of Object.values(this._gruposEscutados || {})) {
      g.removeAllListeners();
    }
    this._gruposEscutados = undefined;
    clearTimeout(this._timerEventos);
    clearTimeout(this._timerAviso);
    this._eventosPendentes = [];
  }

  // "Você" ou o endereço abreviado
  _quem(endereco) {
    return endereco.toLowerCase() === this.state.selectedAddress.toLowerCase()
      ? "Você"
      : abreviar(endereco);
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

  async _registrarDespesa(enderecoGrupo, descricao, valorWei, participantes) {
    const ok = await this._sendTransaction(() =>
      this._grupo(enderecoGrupo).registrarDespesa(descricao, valorWei, participantes)
    );
    if (ok) {
      await this._carregarDetalhe(enderecoGrupo);
    }
    return ok;
  }

  // Envia ETH junto com a chamada (função payable): { value: valorWei }
  async _quitar(enderecoGrupo, credor, valorWei) {
    const ok = await this._sendTransaction(() =>
      this._grupo(enderecoGrupo).quitar(credor, { value: valorWei })
    );
    if (ok) {
      await this._carregarDetalhe(enderecoGrupo);
    }
    return ok;
  }

  // A chamada vai para a FACTORY, que confere se quem chama é o criador
  // e então chama grupo.adicionarMembros(...) no contrato do grupo
  async _adicionarMembro(enderecoGrupo, novo, apelido) {
    const ok = await this._sendTransaction(() =>
      this._factory.adicionarMembro(enderecoGrupo, novo, apelido)
    );
    if (ok) {
      await this._carregarDetalhe(enderecoGrupo);
    }
    return ok;
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