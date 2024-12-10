const fs = require("fs");
const path = require("path");
const Crowdfunding = artifacts.require("Crowdfunding");
const NameRegistry = artifacts.require("NameRegistry");
const MultiSigApprover = artifacts.require("MultiSigApprover");
const ReferralRewards = artifacts.require("ReferralRewards"); // Add this

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(NameRegistry);
  const nameRegistryInstance = await NameRegistry.deployed();

  await deployer.deploy(Crowdfunding);
  const crowdfundingInstance = await Crowdfunding.deployed();

  const trustedSigners = [
  "0x116470dA168103C7329bB1c646b1Aca6308A8a83",
  "0x4efba98Ba5620891eb4Ea7dB04904DeeD2F760b6"
  ];

  const requiredApprovals = 2;
  await deployer.deploy(MultiSigApprover, trustedSigners, requiredApprovals);
  const multiSigApproverInstance = await MultiSigApprover.deployed();

  // Deploy the ReferralRewards contract
  await deployer.deploy(ReferralRewards);
  const referralRewardsInstance = await ReferralRewards.deployed();

  await crowdfundingInstance.setMultiSigApprover(multiSigApproverInstance.address);

  const config = {
    nameRegistry: nameRegistryInstance.address,
    crowdfunding: crowdfundingInstance.address,
    multiSigApprover: multiSigApproverInstance.address,
    referralRewards: referralRewardsInstance.address
  };

  const filePath = path.join(__dirname, "../build/contracts/config.json");
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  console.log("Configuration saved to:", filePath);
};
