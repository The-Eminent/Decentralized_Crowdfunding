const Web3 = require('web3');
const MicroPaymentChannelABI = require('../build/contracts/MicroPaymentChannel.json').abi; 
// Make sure the path is correct to your compiled contract JSON

const provider = new Web3.providers.HttpProvider("http://127.0.0.1:7545");
const web3 = new Web3(provider);

// Replace with actual deployed contract address from your config file
const channelAddress = "0xc20b873De2a45775Aa67DcF72B7f27cA7110eD80"; 

// The channel instance
const micropaymentChannel = new web3.eth.Contract(MicroPaymentChannelABI, channelAddress);

(async () => {
  const accounts = await web3.eth.getAccounts();
  const sender = accounts[0];  // sender
  const receiver = accounts[1]; // receiver
  
  const amountEth = "0.1";
  const amountWei = web3.utils.toWei(amountEth, 'ether');
  
  // Hash the message (channel_address, amount)
  const messageHash = web3.utils.soliditySha3(
    { type: 'address', value: channelAddress },
    { type: 'uint256', value: amountWei }
  );
  
  // Sign off-chain using sender's account
  // This requires that sender's account is unlocked in Ganache (which is default)
  const signature = await web3.eth.sign(messageHash, sender);
  
  // Extract v, r, s
  const r = "0x" + signature.slice(2, 66);
  const s = "0x" + signature.slice(66, 130);
  const v = parseInt(signature.slice(130, 132), 16);

  console.log(`Signature parts:\nv: ${v}\nr: ${r}\ns: ${s}`);
  
  // Now the receiver can call claim using these parts:
  // For testing here, let's just call claim from receiver:
  // NOTE: This will actually transfer the funds if signature is correct.
  
  // await micropaymentChannel.methods.claim(amountWei, v, r, s).send({ from: receiver });
  // console.log("Claimed successfully!");
  
  // If you want to test claim separately, you can comment out the claim part
  // and just take note of v,r,s then run the claim later.
})().catch(err => console.error(err));
