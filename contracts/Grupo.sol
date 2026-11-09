// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

// Um grupo de despesas (uma viagem, uma república, uma festa...).
// Cada grupo é um contrato próprio, criado pela GrupoFactory.
contract Grupo {
    // ---------- Estado ----------
    string public nome;
    address public criador;   // usuário que criou o grupo
    address public factory;   // contrato que fez o deploy deste grupo

    address[] public membros;
    mapping(address => bool) public ehMembro;
    mapping(address => string) public apelido;

    // Saldo de cada membro, em wei:
    //   > 0  tem a receber
    //   < 0  deve
    // Invariante: a soma de todos os saldos é sempre zero.
    mapping(address => int256) public saldo;

    struct Despesa {
        string descricao;
        address pagador;
        uint256 valor;            // em wei
        uint256 numParticipantes;
        uint256 data;             // timestamp do bloco
    }
    Despesa[] public despesas;

    // ---------- Eventos ----------
    event MembroAdicionado(address indexed membro, string apelido);
    event DespesaRegistrada(
        uint256 indexed id,
        address indexed pagador,
        uint256 valor,
        string descricao,
        address[] participantes
    );
    event DividaQuitada(address indexed devedor, address indexed credor, uint256 valor);

    // ---------- Modifiers ----------
    modifier somenteFactory() {
        require(msg.sender == factory, "Somente a factory");
        _;
    }

    modifier somenteMembro() {
        require(ehMembro[msg.sender], "Somente membros do grupo");
        _;
    }

    modifier valorPositivo(uint256 valor) {
        require(valor > 0, "Valor deve ser maior que zero");
        _;
    }

    // ---------- Construtor ----------
    // Chamado pela Factory: msg.sender aqui é a Factory, não o usuário.
    constructor(string memory _nome, address _criador, string memory _apelidoCriador) {
        require(bytes(_nome).length > 0, "Nome vazio");
        nome = _nome;
        criador = _criador;
        factory = msg.sender;
        _adicionarMembro(_criador, _apelidoCriador);
    }

    // ---------- Membros ----------

    // Só a Factory adiciona membros: logo após criar o grupo e, depois,
    // quando o criador pede (GrupoFactory.adicionarMembro). Assim a Factory
    // mantém sempre atualizada a lista de grupos de cada usuário.
    // (Requisito: a Factory interage com um contrato criado por ela.)
    function adicionarMembros(address[] calldata novos, string[] calldata apelidos)
        external
        somenteFactory
    {
        require(novos.length == apelidos.length, "Listas de tamanhos diferentes");
        for (uint256 i = 0; i < novos.length; i++) {
            _adicionarMembro(novos[i], apelidos[i]);
        }
    }

    function _adicionarMembro(address novo, string memory _apelido) internal {
        require(novo != address(0), "Endereco invalido");
        require(!ehMembro[novo], "Ja e membro");

        ehMembro[novo] = true;
        apelido[novo] = _apelido;
        membros.push(novo);

        emit MembroAdicionado(novo, _apelido);
    }

    // ---------- Despesas ----------

    // msg.sender pagou `valor` (wei) e a despesa é dividida igualmente
    // entre `participantes` (o pagador pode ou não estar entre eles).
    function registrarDespesa(
        string calldata descricao,
        uint256 valor,
        address[] calldata participantes
    ) external somenteMembro valorPositivo(valor) {
        uint256 n = participantes.length;
        require(n > 0, "Sem participantes");

        uint256 parte = valor / n;
        require(parte > 0, "Valor pequeno demais para dividir");

        for (uint256 i = 0; i < n; i++) {
            require(ehMembro[participantes[i]], "Participante nao e membro");
            saldo[participantes[i]] -= int256(parte);
        }
        // O pagador recebe exatamente o que os participantes passaram a dever,
        // mantendo a soma dos saldos igual a zero.
        saldo[msg.sender] += int256(parte * n);

        despesas.push(Despesa(descricao, msg.sender, valor, n, block.timestamp));

        emit DespesaRegistrada(despesas.length - 1, msg.sender, valor, descricao, participantes);
    }

    // ---------- Quitação ----------

    // O devedor envia ETH (msg.value) para quitar, total ou parcialmente,
    // o que deve a `credor`. O contrato repassa o valor ao credor.
    function quitar(address payable credor)
        external
        payable
        somenteMembro
        valorPositivo(msg.value)
    {
        require(ehMembro[credor], "Credor nao e membro");
        require(credor != msg.sender, "Nao pode pagar a si mesmo");

        int256 valor = int256(msg.value);
        require(saldo[msg.sender] < 0, "Voce nao tem dividas");
        require(saldo[credor] > 0, "Credor nao tem nada a receber");
        require(valor <= -saldo[msg.sender], "Valor maior que sua divida");
        require(valor <= saldo[credor], "Valor maior que o credito do credor");

        // Efeitos antes da interação (checks-effects-interactions)
        saldo[msg.sender] += valor;
        saldo[credor] -= valor;

        (bool ok, ) = credor.call{value: msg.value}("");
        require(ok, "Falha ao enviar ETH");

        emit DividaQuitada(msg.sender, credor, msg.value);
    }

    // ---------- Leituras para a dApp ----------
    function getMembros() external view returns (address[] memory) {
        return membros;
    }

    function totalDespesas() external view returns (uint256) {
        return despesas.length;
    }
}