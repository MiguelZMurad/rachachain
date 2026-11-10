// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import "./Grupo.sol";

// Contrato principal: cria um contrato Grupo para cada racha de despesas
// e mantém o registro de quais grupos pertencem a cada usuário.
contract GrupoFactory {
    // ---------- Estado ----------
    address[] public grupos;                          // todos os grupos criados
    mapping(address => bool) public ehGrupo;          // endereço foi criado por esta factory?
    mapping(address => address[]) private gruposDoUsuario;

    // ---------- Eventos ----------
    event GrupoCriado(address indexed grupo, address indexed criador, string nome);
    event MembroAdicionadoAoGrupo(address indexed grupo, address indexed membro);

    // ---------- Modifiers ----------
    modifier grupoExiste(address grupo) {
        require(ehGrupo[grupo], "Grupo inexistente");
        _;
    }

    // Consulta o próprio contrato Grupo para saber quem é o criador
    modifier somenteCriadorDoGrupo(address grupo) {
        require(Grupo(grupo).criador() == msg.sender, "Somente o criador do grupo");
        _;
    }

    // ---------- Criação de grupos (Contract Factory) ----------
    function criarGrupo(
        string calldata nome,
        string calldata apelidoCriador,
        address[] calldata membros,
        string[] calldata apelidos
    ) external returns (address) {
        // 1. Cria um novo contrato Grupo (msg.sender do Grupo será esta factory)
        Grupo grupo = new Grupo(nome, msg.sender, apelidoCriador);
        address endereco = address(grupo);

        grupos.push(endereco);
        ehGrupo[endereco] = true;
        gruposDoUsuario[msg.sender].push(endereco);

        // 2. Interage com o contrato recém-criado: cadastra os membros iniciais
        grupo.adicionarMembros(membros, apelidos);
        for (uint256 i = 0; i < membros.length; i++) {
            gruposDoUsuario[membros[i]].push(endereco);
        }

        emit GrupoCriado(endereco, msg.sender, nome);
        return endereco;
    }

    // ---------- Adição de membros depois da criação ----------
    function adicionarMembro(address grupo, address novo, string calldata apelido)
        external
        grupoExiste(grupo)
        somenteCriadorDoGrupo(grupo)
    {
        address[] memory novos = new address[](1);
        string[] memory apelidos = new string[](1);
        novos[0] = novo;
        apelidos[0] = apelido;

        // Interação com um contrato criado pela factory
        Grupo(grupo).adicionarMembros(novos, apelidos);
        gruposDoUsuario[novo].push(grupo);

        emit MembroAdicionadoAoGrupo(grupo, novo);
    }

    // ---------- Leituras para a dApp ----------
    function getGruposDoUsuario(address usuario) external view returns (address[] memory) {
        return gruposDoUsuario[usuario];
    }

    function getGrupos() external view returns (address[] memory) {
        return grupos;
    }

    function totalGrupos() external view returns (uint256) {
        return grupos.length;
    }
}
