const Crowdfunding = artifacts.require("Crowdfunding");
const NameRegistry = artifacts.require("NameRegistry");

module.exports = function (deployer) {
  deployer.deploy(Crowdfunding);
  deployer.deploy(NameRegistry);
};
