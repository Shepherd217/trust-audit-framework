require('@nomicfoundation/hardhat-toolbox');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.24',
  networks: {
    base: {
      url: 'https://mainnet.base.org',
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY || '',
    },
  },
};
