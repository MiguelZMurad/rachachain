require("@nomicfoundation/hardhat-toolbox");

// Lê as variáveis secretas do arquivo .env (que NÃO vai para o Git)
require("dotenv").config();

const { INFURA_API_KEY, SEPOLIA_PRIVATE_KEY } = process.env;

const networks = {};

// A rede Sepolia só é configurada se o .env existir com as duas chaves.
// Assim, quem só quer compilar e testar localmente não precisa do .env.
if (INFURA_API_KEY && SEPOLIA_PRIVATE_KEY) {
  networks.sepolia = {
    url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
    // O MetaMask exporta a chave sem "0x"; o Hardhat espera com "0x"
    accounts: [
      SEPOLIA_PRIVATE_KEY.startsWith("0x")
        ? SEPOLIA_PRIVATE_KEY
        : `0x${SEPOLIA_PRIVATE_KEY}`,
    ],
  };
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  networks,
};
