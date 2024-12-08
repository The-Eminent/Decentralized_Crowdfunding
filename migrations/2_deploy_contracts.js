const Crowdfunding = artifacts.require("Crowdfunding");
const NameRegistry = artifacts.require("NameRegistry");
const MultiSigApprover = artifacts.require("MultiSigApprover");

module.exports = async function (deployer, network, accounts) {
  // Deploy the NameRegistry contract
  await deployer.deploy(NameRegistry);

  // Deploy the Crowdfunding contract
  await deployer.deploy(Crowdfunding);
  const crowdfundingInstance = await Crowdfunding.deployed();

  // Replace these with actual Ethereum addresses you want as trusted signers
  const trustedSigners = [
    "0x2D2504547d770Cac8F61DbBc71bA3E74d49D3F26", // Replaced with a valid address
    "0xd33189d58ADe7bCA3a8F696cf761e74820DD2629", // Replaced with a valid address
  ];

  // Number of required approvals for the multi-signature withdrawal
  const requiredApprovals = 2;

  // Deploy the MultiSigApprover contract with constructor arguments
  await deployer.deploy(MultiSigApprover, trustedSigners, requiredApprovals);
  const multiSigApproverInstance = await MultiSigApprover.deployed();

  // Set the MultiSigApprover contract address in the Crowdfunding contract
  await crowdfundingInstance.setMultiSigApprover(multiSigApproverInstance.address);
};
