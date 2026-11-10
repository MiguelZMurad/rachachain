const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

// Atalho: "0.01" ETH -> wei
const eth = (n) => ethers.utils.parseEther(String(n));

describe("RachaChain", function () {
  // ===================================================================
  // Fixtures
  // ===================================================================

  // Factory implantada, ainda sem grupos.
  // Contas: ana (criadora), bruno e carla (membros iniciais),
  //         dani (entra depois), intruso (nunca é membro).
  async function deployFactoryFixture() {
    const [ana, bruno, carla, dani, intruso] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("GrupoFactory");
    const factory = await Factory.deploy();
    await factory.deployed();

    return { factory, ana, bruno, carla, dani, intruso };
  }

  // Factory + um grupo "Viagem" criado pela ana, com bruno e carla.
  async function grupoFixture() {
    const base = await deployFactoryFixture();
    const { factory, ana, bruno, carla } = base;

    await factory
      .connect(ana)
      .criarGrupo("Viagem", "Ana", [bruno.address, carla.address], ["Bruno", "Carla"]);

    const [enderecoGrupo] = await factory.getGruposDoUsuario(ana.address);
    const grupo = await ethers.getContractAt("Grupo", enderecoGrupo);

    return { ...base, grupo };
  }

  // Soma dos saldos de todos os membros (deve ser sempre zero)
  async function somaSaldos(grupo) {
    const membros = await grupo.getMembros();
    let soma = ethers.BigNumber.from(0);
    for (const m of membros) {
      soma = soma.add(await grupo.saldo(m));
    }
    return soma;
  }

  // ===================================================================
  // GrupoFactory: criação de grupos (Contract Factory)
  // ===================================================================
  describe("GrupoFactory - criarGrupo", function () {
    it("Deve criar um novo contrato Grupo e registrá-lo", async function () {
      const { factory, grupo } = await loadFixture(grupoFixture);

      expect(await factory.totalGrupos()).to.equal(1);
      expect(await factory.ehGrupo(grupo.address)).to.equal(true);
      expect(await factory.getGrupos()).to.deep.equal([grupo.address]);
    });

    it("Deve emitir o evento GrupoCriado", async function () {
      const { factory, ana, bruno } = await loadFixture(deployFactoryFixture);

      await expect(
        factory.connect(ana).criarGrupo("Republica", "Ana", [bruno.address], ["Bruno"])
      )
        .to.emit(factory, "GrupoCriado")
        .withArgs(anyValue, ana.address, "Republica");
    });

    it("O grupo criado deve conhecer seu criador e a factory", async function () {
      const { factory, grupo, ana } = await loadFixture(grupoFixture);

      expect(await grupo.nome()).to.equal("Viagem");
      expect(await grupo.criador()).to.equal(ana.address);
      expect(await grupo.factory()).to.equal(factory.address);
    });

    it("A factory deve cadastrar os membros iniciais no grupo (interação entre contratos)", async function () {
      const { grupo, ana, bruno, carla } = await loadFixture(grupoFixture);

      expect(await grupo.getMembros()).to.deep.equal([
        ana.address,
        bruno.address,
        carla.address,
      ]);
      expect(await grupo.apelido(bruno.address)).to.equal("Bruno");
      expect(await grupo.ehMembro(carla.address)).to.equal(true);
    });

    it("Deve registrar o grupo na lista de cada membro", async function () {
      const { factory, grupo, ana, bruno, carla, intruso } = await loadFixture(grupoFixture);

      for (const pessoa of [ana, bruno, carla]) {
        expect(await factory.getGruposDoUsuario(pessoa.address)).to.deep.equal([grupo.address]);
      }
      expect(await factory.getGruposDoUsuario(intruso.address)).to.deep.equal([]);
    });

    it("Deve falhar com nome vazio", async function () {
      const { factory, ana } = await loadFixture(deployFactoryFixture);
      await expect(
        factory.connect(ana).criarGrupo("", "Ana", [], [])
      ).to.be.revertedWith("Nome vazio");
    });

    it("Deve falhar se as listas de membros e apelidos tiverem tamanhos diferentes", async function () {
      const { factory, ana, bruno } = await loadFixture(deployFactoryFixture);
      await expect(
        factory.connect(ana).criarGrupo("Viagem", "Ana", [bruno.address], [])
      ).to.be.revertedWith("Listas de tamanhos diferentes");
    });

    it("Deve falhar se um membro for repetido", async function () {
      const { factory, ana, bruno } = await loadFixture(deployFactoryFixture);
      await expect(
        factory.connect(ana).criarGrupo("Viagem", "Ana", [bruno.address, bruno.address], ["B", "B"])
      ).to.be.revertedWith("Ja e membro");
    });

    it("Deve falhar com o endereço zero como membro", async function () {
      const { factory, ana } = await loadFixture(deployFactoryFixture);
      await expect(
        factory.connect(ana).criarGrupo("Viagem", "Ana", [ethers.constants.AddressZero], ["X"])
      ).to.be.revertedWith("Endereco invalido");
    });
  });

  // ===================================================================
  // GrupoFactory: adicionar membro depois da criação
  // ===================================================================
  describe("GrupoFactory - adicionarMembro", function () {
    it("O criador deve conseguir adicionar um membro pela factory", async function () {
      const { factory, grupo, ana, dani } = await loadFixture(grupoFixture);

      await expect(factory.connect(ana).adicionarMembro(grupo.address, dani.address, "Dani"))
        .to.emit(factory, "MembroAdicionadoAoGrupo")
        .withArgs(grupo.address, dani.address)
        .and.to.emit(grupo, "MembroAdicionado")
        .withArgs(dani.address, "Dani");

      expect(await grupo.ehMembro(dani.address)).to.equal(true);
      expect(await factory.getGruposDoUsuario(dani.address)).to.deep.equal([grupo.address]);
    });

    it("Deve falhar se quem chama não for o criador do grupo", async function () {
      const { factory, grupo, bruno, dani } = await loadFixture(grupoFixture);
      await expect(
        factory.connect(bruno).adicionarMembro(grupo.address, dani.address, "Dani")
      ).to.be.revertedWith("Somente o criador do grupo");
    });

    it("Deve falhar se o grupo não foi criado pela factory", async function () {
      const { factory, ana, dani, intruso } = await loadFixture(grupoFixture);
      await expect(
        factory.connect(ana).adicionarMembro(intruso.address, dani.address, "Dani")
      ).to.be.revertedWith("Grupo inexistente");
    });

    it("Ninguém pode chamar adicionarMembros direto no Grupo (somente a factory)", async function () {
      const { grupo, ana, dani } = await loadFixture(grupoFixture);
      await expect(
        grupo.connect(ana).adicionarMembros([dani.address], ["Dani"])
      ).to.be.revertedWith("Somente a factory");
    });
  });

  // ===================================================================
  // Grupo: registrar despesas
  // ===================================================================
  describe("Grupo - registrarDespesa", function () {
    it("Deve dividir a despesa entre os participantes (pagador incluído)", async function () {
      const { grupo, ana, bruno, carla } = await loadFixture(grupoFixture);

      // Ana paga 0.03 dividido entre Ana, Bruno e Carla: 0.01 para cada
      await grupo
        .connect(ana)
        .registrarDespesa("Gasolina", eth(0.03), [ana.address, bruno.address, carla.address]);

      expect(await grupo.saldo(ana.address)).to.equal(eth(0.02));   // recebe a parte dos outros
      expect(await grupo.saldo(bruno.address)).to.equal(eth(-0.01));
      expect(await grupo.saldo(carla.address)).to.equal(eth(-0.01));
    });

    it("Deve funcionar quando o pagador não participa da despesa", async function () {
      const { grupo, ana, bruno, carla } = await loadFixture(grupoFixture);

      // Ana paga 0.02 só para Bruno e Carla
      await grupo.connect(ana).registrarDespesa("Presente", eth(0.02), [bruno.address, carla.address]);

      expect(await grupo.saldo(ana.address)).to.equal(eth(0.02));
      expect(await grupo.saldo(bruno.address)).to.equal(eth(-0.01));
      expect(await grupo.saldo(carla.address)).to.equal(eth(-0.01));
    });

    it("Deve guardar a despesa no histórico e emitir DespesaRegistrada", async function () {
      const { grupo, ana, bruno } = await loadFixture(grupoFixture);
      const participantes = [ana.address, bruno.address];

      await expect(grupo.connect(ana).registrarDespesa("Pizza", eth(0.04), participantes))
        .to.emit(grupo, "DespesaRegistrada")
        .withArgs(0, ana.address, eth(0.04), "Pizza", participantes);

      expect(await grupo.totalDespesas()).to.equal(1);
      const d = await grupo.despesas(0);
      expect(d.descricao).to.equal("Pizza");
      expect(d.pagador).to.equal(ana.address);
      expect(d.valor).to.equal(eth(0.04));
      expect(d.numParticipantes).to.equal(2);
    });

    it("A soma dos saldos deve ser sempre zero", async function () {
      const { grupo, ana, bruno, carla } = await loadFixture(grupoFixture);

      await grupo.connect(ana).registrarDespesa("A", eth(0.03), [ana.address, bruno.address, carla.address]);
      await grupo.connect(bruno).registrarDespesa("B", eth(0.05), [ana.address, carla.address]);
      await grupo.connect(carla).registrarDespesa("C", 1000, [bruno.address, carla.address]);

      expect(await somaSaldos(grupo)).to.equal(0);
    });

    it("Valores não divisíveis: o resto não é cobrado e a soma continua zero", async function () {
      const { grupo, ana, bruno, carla } = await loadFixture(grupoFixture);

      // 10 wei / 3 = parte de 3 wei (resto 1 wei não é cobrado)
      await grupo.connect(ana).registrarDespesa("Bala", 10, [ana.address, bruno.address, carla.address]);

      expect(await grupo.saldo(ana.address)).to.equal(6);   // +9 - 3
      expect(await grupo.saldo(bruno.address)).to.equal(-3);
      expect(await somaSaldos(grupo)).to.equal(0);
    });

    it("Deve falhar se quem registra não for membro", async function () {
      const { grupo, intruso, ana } = await loadFixture(grupoFixture);
      await expect(
        grupo.connect(intruso).registrarDespesa("X", eth(0.01), [ana.address])
      ).to.be.revertedWith("Somente membros do grupo");
    });

    it("Deve falhar com valor zero", async function () {
      const { grupo, ana, bruno } = await loadFixture(grupoFixture);
      await expect(
        grupo.connect(ana).registrarDespesa("X", 0, [bruno.address])
      ).to.be.revertedWith("Valor deve ser maior que zero");
    });

    it("Deve falhar sem participantes", async function () {
      const { grupo, ana } = await loadFixture(grupoFixture);
      await expect(
        grupo.connect(ana).registrarDespesa("X", eth(0.01), [])
      ).to.be.revertedWith("Sem participantes");
    });

    it("Deve falhar se um participante não for membro", async function () {
      const { grupo, ana, intruso } = await loadFixture(grupoFixture);
      await expect(
        grupo.connect(ana).registrarDespesa("X", eth(0.01), [intruso.address])
      ).to.be.revertedWith("Participante nao e membro");
    });

    it("Deve falhar se o valor for menor que o número de participantes", async function () {
      const { grupo, ana, bruno, carla } = await loadFixture(grupoFixture);
      await expect(
        grupo.connect(ana).registrarDespesa("X", 2, [ana.address, bruno.address, carla.address])
      ).to.be.revertedWith("Valor pequeno demais para dividir");
    });
  });

  // ===================================================================
  // Grupo: quitar dívidas
  // ===================================================================
  describe("Grupo - quitar", function () {
    // Ana paga 0.03 dividido entre os três:
    //   Ana +0.02 | Bruno -0.01 | Carla -0.01
    async function dividaFixture() {
      const base = await grupoFixture();
      const { grupo, ana, bruno, carla } = base;
      await grupo
        .connect(ana)
        .registrarDespesa("Gasolina", eth(0.03), [ana.address, bruno.address, carla.address]);
      return base;
    }

    it("Deve repassar o ETH ao credor e zerar a dívida", async function () {
      const { grupo, ana, bruno } = await loadFixture(dividaFixture);

      await expect(
        grupo.connect(bruno).quitar(ana.address, { value: eth(0.01) })
      ).to.changeEtherBalances([bruno, ana], [eth(-0.01), eth(0.01)]);

      expect(await grupo.saldo(bruno.address)).to.equal(0);
      expect(await grupo.saldo(ana.address)).to.equal(eth(0.01)); // ainda falta a Carla
    });

    it("Deve emitir DividaQuitada", async function () {
      const { grupo, ana, bruno } = await loadFixture(dividaFixture);
      await expect(grupo.connect(bruno).quitar(ana.address, { value: eth(0.01) }))
        .to.emit(grupo, "DividaQuitada")
        .withArgs(bruno.address, ana.address, eth(0.01));
    });

    it("Deve aceitar quitação parcial", async function () {
      const { grupo, ana, bruno } = await loadFixture(dividaFixture);
      await grupo.connect(bruno).quitar(ana.address, { value: eth(0.004) });
      expect(await grupo.saldo(bruno.address)).to.equal(eth(-0.006));
      expect(await grupo.saldo(ana.address)).to.equal(eth(0.016));
    });

    it("O contrato não deve reter ETH e a soma dos saldos continua zero", async function () {
      const { grupo, ana, bruno, carla } = await loadFixture(dividaFixture);
      await grupo.connect(bruno).quitar(ana.address, { value: eth(0.01) });
      await grupo.connect(carla).quitar(ana.address, { value: eth(0.01) });

      expect(await ethers.provider.getBalance(grupo.address)).to.equal(0);
      expect(await somaSaldos(grupo)).to.equal(0);
      expect(await grupo.saldo(ana.address)).to.equal(0);
    });

    it("Deve falhar com valor zero", async function () {
      const { grupo, ana, bruno } = await loadFixture(dividaFixture);
      await expect(
        grupo.connect(bruno).quitar(ana.address, { value: 0 })
      ).to.be.revertedWith("Valor deve ser maior que zero");
    });

    it("Deve falhar se quem paga não for membro", async function () {
      const { grupo, ana, intruso } = await loadFixture(dividaFixture);
      await expect(
        grupo.connect(intruso).quitar(ana.address, { value: eth(0.01) })
      ).to.be.revertedWith("Somente membros do grupo");
    });

    it("Deve falhar se o credor não for membro", async function () {
      const { grupo, bruno, intruso } = await loadFixture(dividaFixture);
      await expect(
        grupo.connect(bruno).quitar(intruso.address, { value: eth(0.01) })
      ).to.be.revertedWith("Credor nao e membro");
    });

    it("Deve falhar ao pagar a si mesmo", async function () {
      const { grupo, bruno } = await loadFixture(dividaFixture);
      await expect(
        grupo.connect(bruno).quitar(bruno.address, { value: eth(0.01) })
      ).to.be.revertedWith("Nao pode pagar a si mesmo");
    });

    it("Deve falhar se quem paga não tiver dívidas", async function () {
      const { grupo, ana, bruno } = await loadFixture(dividaFixture);
      // Ana é credora, não devedora
      await expect(
        grupo.connect(ana).quitar(bruno.address, { value: eth(0.01) })
      ).to.be.revertedWith("Voce nao tem dividas");
    });

    it("Deve falhar se o credor não tiver nada a receber", async function () {
      const { grupo, bruno, carla } = await loadFixture(dividaFixture);
      // Carla também é devedora
      await expect(
        grupo.connect(bruno).quitar(carla.address, { value: eth(0.01) })
      ).to.be.revertedWith("Credor nao tem nada a receber");
    });

    it("Deve falhar se o valor for maior que a dívida", async function () {
      const { grupo, ana, bruno } = await loadFixture(dividaFixture);
      // Bruno deve 0.01, Ana tem 0.02 a receber
      await expect(
        grupo.connect(bruno).quitar(ana.address, { value: eth(0.015) })
      ).to.be.revertedWith("Valor maior que sua divida");
    });

    it("Deve falhar se o valor for maior que o crédito do credor", async function () {
      const { grupo, ana, bruno, carla } = await loadFixture(grupoFixture);

      // Ana paga 0.03 para os três; Carla paga 0.03 para os três
      //   Ana +0.01 | Bruno -0.02 | Carla +0.01
      const todos = [ana.address, bruno.address, carla.address];
      await grupo.connect(ana).registrarDespesa("A", eth(0.03), todos);
      await grupo.connect(carla).registrarDespesa("C", eth(0.03), todos);

      // Bruno deve 0.02, mas Ana só tem 0.01 a receber
      await expect(
        grupo.connect(bruno).quitar(ana.address, { value: eth(0.02) })
      ).to.be.revertedWith("Valor maior que o credito do credor");
    });
  });
});