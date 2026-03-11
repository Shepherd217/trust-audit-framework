/**
 * Cross-Chain Crypto Payment Bridge for MoltOS
 * Multi-Chain Service - Supports Ethereum, Solana, Base, Arbitrum
 * 
 * @module lib/payments/multichain
 */

import { 
  ethers, 
  JsonRpcProvider, 
  Wallet, 
  Contract,
  formatUnits,
  parseUnits,
  TransactionResponse,
  TransactionReceipt
} from 'ethers';
import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';

// =====================================================
// CHAIN CONFIGURATION
// =====================================================

export enum ChainId {
  ETHEREUM = 1,
  SEPOLIA = 11155111,
  BASE = 8453,
  BASE_SEPOLIA = 84532,
  ARBITRUM = 42161,
  ARBITRUM_SEPOLIA = 421614,
  SOLANA = -1, // Special ID for Solana
  SOLANA_DEVNET = -2,
}

export enum TokenSymbol {
  ETH = 'ETH',
  USDC = 'USDC',
  USDT = 'USDT',
  SOL = 'SOL',
  WBTC = 'WBTC',
}

export interface ChainConfig {
  id: ChainId;
  name: string;
  rpcUrl: string;
  nativeCurrency: TokenSymbol;
  blockTimeMs: number;
  confirmations: number;
  isEvm: boolean;
  explorerUrl: string;
}

export interface TokenConfig {
  symbol: TokenSymbol;
  name: string;
  decimals: number;
  addresses: Partial<Record<ChainId, string>>;
  isNative: boolean;
  isStablecoin: boolean;
}

export interface GasEstimate {
  chainId: ChainId;
  token: TokenSymbol;
  gasLimit: bigint;
  gasPriceWei: bigint;
  totalCostWei: bigint;
  usdEstimate: number;
}

// Chain configurations
export const CHAIN_CONFIGS: Record<ChainId, ChainConfig> = {
  [ChainId.ETHEREUM]: {
    id: ChainId.ETHEREUM,
    name: 'Ethereum Mainnet',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
    nativeCurrency: TokenSymbol.ETH,
    blockTimeMs: 12000,
    confirmations: 12,
    isEvm: true,
    explorerUrl: 'https://etherscan.io',
  },
  [ChainId.SEPOLIA]: {
    id: ChainId.SEPOLIA,
    name: 'Sepolia Testnet',
    rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
    nativeCurrency: TokenSymbol.ETH,
    blockTimeMs: 12000,
    confirmations: 1,
    isEvm: true,
    explorerUrl: 'https://sepolia.etherscan.io',
  },
  [ChainId.BASE]: {
    id: ChainId.BASE,
    name: 'Base Mainnet',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    nativeCurrency: TokenSymbol.ETH,
    blockTimeMs: 2000,
    confirmations: 10,
    isEvm: true,
    explorerUrl: 'https://basescan.org',
  },
  [ChainId.BASE_SEPOLIA]: {
    id: ChainId.BASE_SEPOLIA,
    name: 'Base Sepolia',
    rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    nativeCurrency: TokenSymbol.ETH,
    blockTimeMs: 2000,
    confirmations: 1,
    isEvm: true,
    explorerUrl: 'https://sepolia.basescan.org',
  },
  [ChainId.ARBITRUM]: {
    id: ChainId.ARBITRUM,
    name: 'Arbitrum One',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    nativeCurrency: TokenSymbol.ETH,
    blockTimeMs: 250,
    confirmations: 10,
    isEvm: true,
    explorerUrl: 'https://arbiscan.io',
  },
  [ChainId.ARBITRUM_SEPOLIA]: {
    id: ChainId.ARBITRUM_SEPOLIA,
    name: 'Arbitrum Sepolia',
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
    nativeCurrency: TokenSymbol.ETH,
    blockTimeMs: 250,
    confirmations: 1,
    isEvm: true,
    explorerUrl: 'https://sepolia.arbiscan.io',
  },
  [ChainId.SOLANA]: {
    id: ChainId.SOLANA,
    name: 'Solana Mainnet',
    rpcUrl: process.env.SOLANA_RPC_URL || clusterApiUrl('mainnet-beta'),
    nativeCurrency: TokenSymbol.SOL,
    blockTimeMs: 400,
    confirmations: 32,
    isEvm: false,
    explorerUrl: 'https://explorer.solana.com',
  },
  [ChainId.SOLANA_DEVNET]: {
    id: ChainId.SOLANA_DEVNET,
    name: 'Solana Devnet',
    rpcUrl: process.env.SOLANA_DEVNET_RPC_URL || clusterApiUrl('devnet'),
    nativeCurrency: TokenSymbol.SOL,
    blockTimeMs: 400,
    confirmations: 1,
    isEvm: false,
    explorerUrl: 'https://explorer.solana.com/?cluster=devnet',
  },
};

// Token configurations
export const TOKEN_CONFIGS: Record<TokenSymbol, TokenConfig> = {
  [TokenSymbol.ETH]: {
    symbol: TokenSymbol.ETH,
    name: 'Ethereum',
    decimals: 18,
    addresses: {}, // Native on EVM chains
    isNative: true,
    isStablecoin: false,
  },
  [TokenSymbol.USDC]: {
    symbol: TokenSymbol.USDC,
    name: 'USD Coin',
    decimals: 6,
    addresses: {
      [ChainId.ETHEREUM]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      [ChainId.SEPOLIA]: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
      [ChainId.BASE]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      [ChainId.BASE_SEPOLIA]: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      [ChainId.ARBITRUM]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      [ChainId.ARBITRUM_SEPOLIA]: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    },
    isNative: false,
    isStablecoin: true,
  },
  [TokenSymbol.USDT]: {
    symbol: TokenSymbol.USDT,
    name: 'Tether USD',
    decimals: 6,
    addresses: {
      [ChainId.ETHEREUM]: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      [ChainId.SEPOLIA]: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
      [ChainId.ARBITRUM]: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    },
    isNative: false,
    isStablecoin: true,
  },
  [TokenSymbol.SOL]: {
    symbol: TokenSymbol.SOL,
    name: 'Solana',
    decimals: 9,
    addresses: {}, // Native on Solana
    isNative: true,
    isStablecoin: false,
  },
  [TokenSymbol.WBTC]: {
    symbol: TokenSymbol.WBTC,
    name: 'Wrapped Bitcoin',
    decimals: 8,
    addresses: {
      [ChainId.ETHEREUM]: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      [ChainId.ARBITRUM]: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    },
    isNative: false,
    isStablecoin: false,
  },
};

// Solana token mints
export const SOLANA_TOKEN_MINTS: Partial<Record<TokenSymbol, string>> = {
  [TokenSymbol.USDC]: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  [TokenSymbol.USDT]: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  [TokenSymbol.WBTC]: '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh',
};

// =====================================================
// MULTI-CHAIN SERVICE CLASS
// =====================================================

export class MultiChainService {
  private evmProviders: Map<ChainId, JsonRpcProvider> = new Map();
  private solanaConnections: Map<ChainId, Connection> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize EVM providers
    for (const [chainId, config] of Object.entries(CHAIN_CONFIGS)) {
      if (config.isEvm) {
        const provider = new JsonRpcProvider(config.rpcUrl);
        this.evmProviders.set(config.id, provider);
      } else {
        // Solana connections
        const connection = new Connection(config.rpcUrl, 'confirmed');
        this.solanaConnections.set(config.id, connection);
      }
    }
  }

  // =====================================================
  // PROVIDER MANAGEMENT
  // =====================================================

  getEvmProvider(chainId: ChainId): JsonRpcProvider {
    const provider = this.evmProviders.get(chainId);
    if (!provider) {
      throw new Error(`No EVM provider found for chain ${chainId}`);
    }
    return provider;
  }

  getSolanaConnection(chainId: ChainId): Connection {
    const connection = this.solanaConnections.get(chainId);
    if (!connection) {
      throw new Error(`No Solana connection found for chain ${chainId}`);
    }
    return connection;
  }

  // =====================================================
  // ADDRESS GENERATION
  // =====================================================

  /**
   * Generate a new EVM wallet
   */
  generateEvmWallet(): { address: string; privateKey: string } {
    const wallet = Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };
  }

  /**
   * Generate a new Solana wallet
   */
  generateSolanaWallet(): { address: string; privateKey: Uint8Array } {
    const keypair = Keypair.generate();
    return {
      address: keypair.publicKey.toBase58(),
      privateKey: keypair.secretKey,
    };
  }

  /**
   * Get wallet address from private key
   */
  getEvmAddressFromPrivateKey(privateKey: string): string {
    const wallet = new Wallet(privateKey);
    return wallet.address;
  }

  /**
   * Get Solana address from private key
   */
  getSolanaAddressFromPrivateKey(privateKey: Uint8Array): string {
    const keypair = Keypair.fromSecretKey(privateKey);
    return keypair.publicKey.toBase58();
  }

  // =====================================================
  // BALANCE CHECKING
  // =====================================================

  /**
   * Get native token balance for EVM chain
   */
  async getEvmNativeBalance(
    chainId: ChainId,
    address: string
  ): Promise<{ raw: bigint; formatted: string }> {
    const provider = this.getEvmProvider(chainId);
    const balance = await provider.getBalance(address);
    const decimals = TOKEN_CONFIGS[TokenSymbol.ETH].decimals;
    
    return {
      raw: balance,
      formatted: formatUnits(balance, decimals),
    };
  }

  /**
   * Get ERC-20 token balance
   */
  async getErc20Balance(
    chainId: ChainId,
    token: TokenSymbol,
    address: string
  ): Promise<{ raw: bigint; formatted: string }> {
    const tokenConfig = TOKEN_CONFIGS[token];
    const tokenAddress = tokenConfig.addresses[chainId];
    
    if (!tokenAddress) {
      throw new Error(`Token ${token} not supported on chain ${chainId}`);
    }

    const provider = this.getEvmProvider(chainId);
    
    const erc20Abi = [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
    ];
    
    const contract = new Contract(tokenAddress, erc20Abi, provider);
    const balance = await contract.balanceOf(address);
    
    return {
      raw: balance,
      formatted: formatUnits(balance, tokenConfig.decimals),
    };
  }

  /**
   * Get Solana native (SOL) balance
   */
  async getSolanaNativeBalance(
    chainId: ChainId,
    address: string
  ): Promise<{ raw: bigint; formatted: string; lamports: number }> {
    const connection = this.getSolanaConnection(chainId);
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    
    return {
      raw: BigInt(balance),
      formatted: (balance / LAMPORTS_PER_SOL).toString(),
      lamports: balance,
    };
  }

  /**
   * Get SPL token balance
   */
  async getSplTokenBalance(
    chainId: ChainId,
    token: TokenSymbol,
    ownerAddress: string
  ): Promise<{ raw: bigint; formatted: string; uiAmount: number | null }> {
    const mintAddress = SOLANA_TOKEN_MINTS[token];
    if (!mintAddress) {
      throw new Error(`Token ${token} not supported on Solana`);
    }

    const connection = this.getSolanaConnection(chainId);
    const ownerPublicKey = new PublicKey(ownerAddress);
    const mintPublicKey = new PublicKey(mintAddress);
    
    const tokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      ownerPublicKey
    );

    try {
      const account = await getAccount(connection, tokenAccount);
      const tokenConfig = TOKEN_CONFIGS[token];
      
      return {
        raw: BigInt(account.amount.toString()),
        formatted: formatUnits(account.amount.toString(), tokenConfig.decimals),
        uiAmount: Number(account.amount) / Math.pow(10, tokenConfig.decimals),
      };
    } catch (error) {
      // Account doesn't exist
      return {
        raw: BigInt(0),
        formatted: '0',
        uiAmount: 0,
      };
    }
  }

  /**
   * Get all balances for a wallet across multiple chains
   */
  async getAllBalances(
    wallet: {
      evmAddress?: string;
      solanaAddress?: string;
    },
    chains: ChainId[] = Object.values(ChainId).filter((v): v is ChainId => typeof v === 'number')
  ): Promise<ChainBalance[]> {
    const balances: ChainBalance[] = [];

    for (const chainId of chains) {
      const chainConfig = CHAIN_CONFIGS[chainId];
      const chainBalances: ChainBalance = {
        chainId,
        chainName: chainConfig.name,
        balances: [],
      };

      try {
        if (chainConfig.isEvm && wallet.evmAddress) {
          // Native token
          const nativeBalance = await this.getEvmNativeBalance(chainId, wallet.evmAddress);
          chainBalances.balances.push({
            token: chainConfig.nativeCurrency,
            raw: nativeBalance.raw.toString(),
            formatted: nativeBalance.formatted,
          });

          // ERC-20 tokens
          for (const [symbol, config] of Object.entries(TOKEN_CONFIGS)) {
            if (!config.isNative && config.addresses[chainId]) {
              try {
                const tokenBalance = await this.getErc20Balance(
                  chainId,
                  symbol as TokenSymbol,
                  wallet.evmAddress
                );
                chainBalances.balances.push({
                  token: symbol as TokenSymbol,
                  raw: tokenBalance.raw.toString(),
                  formatted: tokenBalance.formatted,
                });
              } catch (e) {
                // Skip if balance check fails
              }
            }
          }
        } else if (!chainConfig.isEvm && wallet.solanaAddress) {
          // SOL balance
          const solBalance = await this.getSolanaNativeBalance(chainId, wallet.solanaAddress);
          chainBalances.balances.push({
            token: TokenSymbol.SOL,
            raw: solBalance.raw.toString(),
            formatted: solBalance.formatted,
          });

          // SPL tokens
          for (const symbol of [TokenSymbol.USDC, TokenSymbol.USDT]) {
            try {
              const tokenBalance = await this.getSplTokenBalance(
                chainId,
                symbol,
                wallet.solanaAddress
              );
              chainBalances.balances.push({
                token: symbol,
                raw: tokenBalance.raw.toString(),
                formatted: tokenBalance.formatted,
              });
            } catch (e) {
              // Skip if balance check fails
            }
          }
        }

        balances.push(chainBalances);
      } catch (error) {
        console.error(`Failed to get balances for chain ${chainId}:`, error);
      }
    }

    return balances;
  }

  // =====================================================
  // GAS ESTIMATION
  // =====================================================

  /**
   * Estimate gas for EVM native transfer
   */
  async estimateEvmNativeTransferGas(
    chainId: ChainId,
    from: string,
    to: string,
    amount: bigint
  ): Promise<GasEstimate> {
    const provider = this.getEvmProvider(chainId);
    
    const [feeData, gasLimit] = await Promise.all([
      provider.getFeeData(),
      provider.estimateGas({
        from,
        to,
        value: amount,
      }),
    ]);

    const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || BigInt(0);
    const totalCost = gasLimit * gasPrice;

    return {
      chainId,
      token: CHAIN_CONFIGS[chainId].nativeCurrency,
      gasLimit,
      gasPriceWei: gasPrice,
      totalCostWei: totalCost,
      usdEstimate: 0, // Will be filled by price oracle
    };
  }

  /**
   * Estimate gas for ERC-20 transfer
   */
  async estimateErc20TransferGas(
    chainId: ChainId,
    token: TokenSymbol,
    from: string,
    to: string,
    amount: bigint
  ): Promise<GasEstimate> {
    const tokenConfig = TOKEN_CONFIGS[token];
    const tokenAddress = tokenConfig.addresses[chainId];
    
    if (!tokenAddress) {
      throw new Error(`Token ${token} not supported on chain ${chainId}`);
    }

    const provider = this.getEvmProvider(chainId);
    
    const erc20Abi = [
      'function transfer(address to, uint256 amount) returns (bool)',
    ];
    
    const contract = new Contract(tokenAddress, erc20Abi, provider);
    const data = contract.interface.encodeFunctionData('transfer', [to, amount]);
    
    const [feeData, gasLimit] = await Promise.all([
      provider.getFeeData(),
      provider.estimateGas({
        from,
        to: tokenAddress,
        data,
      }),
    ]);

    const gasPrice = feeData.maxFeePerGas || feeData.gasPrice || BigInt(0);
    const totalCost = gasLimit * gasPrice;

    return {
      chainId,
      token: CHAIN_CONFIGS[chainId].nativeCurrency,
      gasLimit,
      gasPriceWei: gasPrice,
      totalCostWei: totalCost,
      usdEstimate: 0,
    };
  }

  /**
   * Get cheapest chain for a token transfer
   */
  async getCheapestChain(
    token: TokenSymbol,
    amount: string,
    fromAddress: string,
    toAddress: string,
    candidateChains: ChainId[]
  ): Promise<{ chainId: ChainId; gasEstimate: GasEstimate; totalCostUsd: number } | null> {
    const estimates: Array<{ chainId: ChainId; estimate: GasEstimate }> = [];

    for (const chainId of candidateChains) {
      try {
        const chainConfig = CHAIN_CONFIGS[chainId];
        let estimate: GasEstimate;

        if (chainConfig.isEvm) {
          const parsedAmount = parseUnits(amount, TOKEN_CONFIGS[token].decimals);
          
          if (TOKEN_CONFIGS[token].isNative) {
            estimate = await this.estimateEvmNativeTransferGas(
              chainId,
              fromAddress,
              toAddress,
              parsedAmount
            );
          } else {
            estimate = await this.estimateErc20TransferGas(
              chainId,
              token,
              fromAddress,
              toAddress,
              parsedAmount
            );
          }
          
          estimates.push({ chainId, estimate });
        }
      } catch (error) {
        console.warn(`Failed to estimate gas for chain ${chainId}:`, error);
      }
    }

    if (estimates.length === 0) return null;

    // Sort by gas cost (lowest first)
    estimates.sort((a, b) => {
      const aCost = Number(formatUnits(a.estimate.totalCostWei, 18));
      const bCost = Number(formatUnits(b.estimate.totalCostWei, 18));
      return aCost - bCost;
    });

    const cheapest = estimates[0];
    const nativeToken = CHAIN_CONFIGS[cheapest.chainId].nativeCurrency;
    const nativeCost = Number(formatUnits(cheapest.estimate.totalCostWei, 18));

    return {
      chainId: cheapest.chainId,
      gasEstimate: cheapest.estimate,
      totalCostUsd: cheapest.estimate.usdEstimate || nativeCost * 2000, // Fallback estimate
    };
  }

  // =====================================================
  // TRANSACTION SUBMISSION
  // =====================================================

  /**
   * Send native token on EVM chain
   */
  async sendEvmNative(
    chainId: ChainId,
    privateKey: string,
    to: string,
    amount: bigint,
    options?: { gasLimit?: bigint; maxFeePerGas?: bigint }
  ): Promise<TransactionReceipt> {
    const provider = this.getEvmProvider(chainId);
    const wallet = new Wallet(privateKey, provider);

    const tx = await wallet.sendTransaction({
      to,
      value: amount,
      gasLimit: options?.gasLimit,
      maxFeePerGas: options?.maxFeePerGas,
    });

    return await tx.wait(CHAIN_CONFIGS[chainId].confirmations);
  }

  /**
   * Send ERC-20 token on EVM chain
   */
  async sendErc20(
    chainId: ChainId,
    privateKey: string,
    token: TokenSymbol,
    to: string,
    amount: bigint,
    options?: { gasLimit?: bigint; maxFeePerGas?: bigint }
  ): Promise<TransactionReceipt> {
    const tokenConfig = TOKEN_CONFIGS[token];
    const tokenAddress = tokenConfig.addresses[chainId];
    
    if (!tokenAddress) {
      throw new Error(`Token ${token} not supported on chain ${chainId}`);
    }

    const provider = this.getEvmProvider(chainId);
    const wallet = new Wallet(privateKey, provider);

    const erc20Abi = [
      'function transfer(address to, uint256 amount) returns (bool)',
    ];

    const contract = new Contract(tokenAddress, erc20Abi, wallet);
    const tx = await contract.transfer(to, amount, {
      gasLimit: options?.gasLimit,
      maxFeePerGas: options?.maxFeePerGas,
    });

    return await tx.wait(CHAIN_CONFIGS[chainId].confirmations);
  }

  /**
   * Send SOL on Solana
   */
  async sendSolana(
    chainId: ChainId,
    senderKeypair: Keypair,
    recipientAddress: string,
    amountLamports: number
  ): Promise<string> {
    const connection = this.getSolanaConnection(chainId);
    const recipientPublicKey = new PublicKey(recipientAddress);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: senderKeypair.publicKey,
        toPubkey: recipientPublicKey,
        lamports: amountLamports,
      })
    );

    const signature = await connection.sendTransaction(transaction, [senderKeypair]);
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }

  /**
   * Send SPL token on Solana
   */
  async sendSplToken(
    chainId: ChainId,
    senderKeypair: Keypair,
    recipientAddress: string,
    token: TokenSymbol,
    amount: bigint
  ): Promise<string> {
    const mintAddress = SOLANA_TOKEN_MINTS[token];
    if (!mintAddress) {
      throw new Error(`Token ${token} not supported on Solana`);
    }

    const connection = this.getSolanaConnection(chainId);
    const mintPublicKey = new PublicKey(mintAddress);
    const recipientPublicKey = new PublicKey(recipientAddress);

    const senderTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      senderKeypair.publicKey
    );

    const recipientTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      recipientPublicKey
    );

    const transaction = new Transaction();

    // Create recipient token account if it doesn't exist
    try {
      await getAccount(connection, recipientTokenAccount);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          senderKeypair.publicKey,
          recipientTokenAccount,
          recipientPublicKey,
          mintPublicKey
        )
      );
    }

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        senderTokenAccount,
        recipientTokenAccount,
        senderKeypair.publicKey,
        amount
      )
    );

    const signature = await connection.sendTransaction(transaction, [senderKeypair]);
    await connection.confirmTransaction(signature, 'confirmed');

    return signature;
  }

  // =====================================================
  // UTILITY
  // =====================================================

  /**
   * Wait for transaction confirmation
   */
  async waitForEvmTransaction(
    chainId: ChainId,
    txHash: string,
    timeoutMs: number = 120000
  ): Promise<TransactionReceipt> {
    const provider = this.getEvmProvider(chainId);
    const receipt = await provider.waitForTransaction(txHash, 
      CHAIN_CONFIGS[chainId].confirmations,
      timeoutMs
    );
    
    if (!receipt) {
      throw new Error('Transaction confirmation timeout');
    }
    
    return receipt;
  }

  /**
   * Get transaction explorer URL
   */
  getExplorerUrl(chainId: ChainId, txHash: string): string {
    const chainConfig = CHAIN_CONFIGS[chainId];
    return `${chainConfig.explorerUrl}/tx/${txHash}`;
  }

  /**
   * Format token amount for display
   */
  formatTokenAmount(symbol: TokenSymbol, amount: bigint): string {
    const config = TOKEN_CONFIGS[symbol];
    return formatUnits(amount, config.decimals);
  }

  /**
   * Parse token amount from string
   */
  parseTokenAmount(symbol: TokenSymbol, amount: string): bigint {
    const config = TOKEN_CONFIGS[symbol];
    return parseUnits(amount, config.decimals);
  }
}

// =====================================================
// TYPES
// =====================================================

export interface ChainBalance {
  chainId: ChainId;
  chainName: string;
  balances: TokenBalance[];
}

export interface TokenBalance {
  token: TokenSymbol;
  raw: string;
  formatted: string;
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

let multiChainService: MultiChainService | null = null;

export function getMultiChainService(): MultiChainService {
  if (!multiChainService) {
    multiChainService = new MultiChainService();
  }
  return multiChainService;
}

export default getMultiChainService;
