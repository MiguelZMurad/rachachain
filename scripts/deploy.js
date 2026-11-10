// Deploy da GrupoFactory (os contratos Grupo são criados depois, pela própria factory).
// Também salva o endereço e as ABIs em frontend/src/contracts para a dApp usar.
const path = require("path");
const fs = require("fs");

async function main() {
  if (network.name === "hardhat") {
    console.warn(
      "Atenção: a rede 'hardhat' é temporária e some ao fim do script. " +
        "Use --network localhost ou --network sepolia."
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log("Rede:", network.name);
  console.log("Conta de deploy:", deployer.address);
  console.log(
    "Saldo:",
    ethers.utils.formatEther(await deployer.getBalance()),
    "ETH"
  );

  const Factory = await ethers.getContractFactory("GrupoFactory");
  const factory = await Factory.deploy();
  console.log("Transação de deploy:", factory.deployTransaction.hash);
  console.log("Aguardando confirmação...");
  await factory.deployed();

  console.log("GrupoFactory implantada em:", factory.address);

  if (network.name === "sepolia") {
    console.log(
      "Etherscan: https://sepolia.etherscan.io/address/" + factory.address
    );
  }

  saveFrontendFiles(factory);
}

function saveFrontendFiles(factory) {
  const contractsDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  // Endereço da factory, guardado por rede (chave = chain ID).
  // Assim um deploy na Sepolia não apaga o endereço da rede local, e vice-versa.
  const arquivo = path.join(contractsDir, "contract-address.json");
  let enderecos = {};
  if (fs.existsSync(arquivo)) {
    enderecos = JSON.parse(fs.readFileSync(arquivo, "utf8"));
    // Formato antigo ({ GrupoFactory: ... }, sem chain ID): descarta
    if (enderecos.GrupoFactory) enderecos = {};
  }
  enderecos[network.config.chainId ?? 31337] = { GrupoFactory: factory.address };
  fs.writeFileSync(arquivo, JSON.stringify(enderecos, undefined, 2));

  // ABIs: a dApp precisa das duas, a da Factory e a do Grupo
  for (const nome of ["GrupoFactory", "Grupo"]) {
    const artifact = artifacts.readArtifactSync(nome);
    fs.writeFileSync(
      path.join(contractsDir, `${nome}.json`),
      JSON.stringify(artifact, null, 2)
    );
  }

  console.log("Arquivos do frontend salvos em", contractsDir);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
