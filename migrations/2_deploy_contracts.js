const fs = require("fs");
const path = require("path");
const Crowdfunding = artifacts.require("Crowdfunding");
const NameRegistry = artifacts.require("NameRegistry");
const MultiSigApprover = artifacts.require("MultiSigApprover");
const ReferralRewards = artifacts.require("ReferralRewards"); 

module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(NameRegistry);
  const nameRegistryInstance = await NameRegistry.deployed();

  await deployer.deploy(Crowdfunding);
  const crowdfundingInstance = await Crowdfunding.deployed();

  const trustedSigners = [
    "0x60B3Af227f03044949c0cB97B9B046A4a99dda03",
    "0x0Fa02132dC5be4d14309EF12e678947d262A8525",
  ];

  const requiredApprovals = 2;

  await deployer.deploy(MultiSigApprover, trustedSigners, requiredApprovals);
  const multiSigApproverInstance = await MultiSigApprover.deployed();

  await crowdfundingInstance.setMultiSigApprover(multiSigApproverInstance.address);

  // Deploy ReferralRewards
  await deployer.deploy(ReferralRewards);
  const referralRewardsInstance = await ReferralRewards.deployed();

  const config = {
    nameRegistry: nameRegistryInstance.address,
    crowdfunding: crowdfundingInstance.address,
    multiSigApprover: multiSigApproverInstance.address,
    referralRewards: referralRewardsInstance.address,
  };

  const filePath = path.join(__dirname, "../build/contracts/config.json");
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
  console.log("Configuration saved to:", filePath);
};
