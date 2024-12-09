const fs = require("fs");
const path = require("path"); // Import path for resolving directories
const Crowdfunding = artifacts.require("Crowdfunding");
const NameRegistry = artifacts.require("NameRegistry");
const MultiSigApprover = artifacts.require("MultiSigApprover");

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(NameRegistry);
  const nameRegistryInstance = await NameRegistry.deployed();

  await deployer.deploy(Crowdfunding);
  const crowdfundingInstance = await Crowdfunding.deployed();

  const trustedSigners = [
    "0x1503a1347bFCD038BB750CCfEde703CD3ACd4B55",
    "0x3D74170eD20891004646C2b4C174B93B3c5C7191",
  ];

  const requiredApprovals = 2;

  await deployer.deploy(MultiSigApprover, trustedSigners, requiredApprovals);
  const multiSigApproverInstance = await MultiSigApprover.deployed();

  await crowdfundingInstance.setMultiSigApprover(multiSigApproverInstance.address);

  const config = {
    nameRegistry: nameRegistryInstance.address,
    crowdfunding: crowdfundingInstance.address,
    multiSigApprover: multiSigApproverInstance.address,
  };

  // Save config to build/contracts folder
  const filePath = path.join(__dirname, "../build/contracts/config.json");
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  console.log("Configuration saved to:", filePath);
};
