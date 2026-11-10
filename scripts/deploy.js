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

  // Endereço da factory (os grupos têm endereços próprios, descobertos pela dApp)
  fs.writeFileSync(
    path.join(contractsDir, "contract-address.json"),
    JSON.stringify({ GrupoFactory: factory.address }, undefined, 2)
  );

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
