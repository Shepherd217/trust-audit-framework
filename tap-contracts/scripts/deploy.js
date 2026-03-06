const { ethers } = require('hardhat');

async function main() {
  console.log('Deploying TAP Founding NFT...');

  const TAPFoundingNFT = await ethers.getContractFactory('TAPFoundingNFT');
  const nft = await TAPFoundingNFT.deploy();

  await nft.waitForDeployment();

  const address = await nft.getAddress();
  console.log('✅ TAP Founding NFT deployed to:', address);
  console.log('');
  console.log('Save this address! You will need it to mint NFTs.');
  console.log('');
  console.log('To verify on BaseScan:');
  console.log(`npx hardhat verify --network base ${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
