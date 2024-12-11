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
  "0xb4B4eee571bfA73d690104B0FB04366f95B90f0a",
  "0x2cc2C8ACd15FCc371B3B2385aB26d79AfBf7FF51"
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
