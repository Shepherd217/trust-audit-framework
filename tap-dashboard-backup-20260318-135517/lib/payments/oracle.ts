/**
 * Price Oracle Integration for MoltOS Cross-Chain Payments
 * 
 * Integrates Chainlink for ETH/USD and Pyth for SOL/USD
 * Provides real-time conversion rates for all supported tokens
 * 
 * @module lib/payments/oracle
 */

import { Contract, JsonRpcProvider } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import { ChainId, TokenSymbol, CHAIN_CONFIGS, TOKEN_CONFIGS } from './multichain';

// =====================================================
// ORACLE CONFIGURATION
// =====================================================

// Chainlink Price Feed addresses (Ethereum Mainnet)
const CHAINLINK_FEEDS: Partial<Record<TokenSymbol, string>> = {
  [TokenSymbol.ETH]: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD
  [TokenSymbol.USDC]: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', // USDC/USD
  [TokenSymbol.USDT]: '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D', // USDT/USD
  [TokenSymbol.WBTC]: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c', // BTC/USD
};

// Chainlink Price Feed addresses (Base Mainnet)
const CHAINLINK_FEEDS_BASE: Partial<Record<TokenSymbol, string>> = {
  [TokenSymbol.ETH]: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70', // ETH/USD
  [TokenSymbol.USDC]: '0x7e860098F58bBFC8648Cf31F2028B75B5f0e27e3', // USDC/USD
};

// Chainlink Price Feed addresses (Arbitrum Mainnet)
const CHAINLINK_FEEDS_ARBITRUM: Partial<Record<TokenSymbol, string>> = {
  [TokenSymbol.ETH]: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612', // ETH/USD
  [TokenSymbol.USDC]: '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3', // USDC/USD
  [TokenSymbol.USDT]: '0x3f3f5dF88dC9F13eac63DF89EC16ef6bb7Df44E1', // USDT/USD
  [TokenSymbol.WBTC]: '0xd0C7101eACbB49F3deCcCc222d10790G4f29D97f', // BTC/USD
};

// Pyth Price Feed IDs (Solana Mainnet)
const PYTH_FEED_IDS: Partial<Record<TokenSymbol, string>> = {
  [TokenSymbol.SOL]: 'H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG', // SOL/USD
  [TokenSymbol.USDC]: 'Gnt27xtC473ZT2Mw5u8wZ68Z3gUEkXAwGh9jjJr2keGi', // USDC/USD
  [TokenSymbol.USDT]: '3vxLXJqLqF3JG5TCbYycbKREBbEj6T7vF7HzSBP1S7NF', // USDT/USD
  [TokenSymbol.ETH]: 'JBu1AL4obBcCMqKBBxhpWCNUt1kiGOi7fMm1BtgTfXJ7', // ETH/USD
  [TokenSymbol.WBTC]: 'GVXRSBjFk6e6J3NbVPXohDJetcTjaeeuykUpbQF8UoMU', // BTC/USD
};

// Pyth program ID on Solana
const PYTH_PROGRAM_ID = new PublicKey('FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH');

// Chainlink Aggregator ABI
const CHAINLINK_AGGREGATOR_ABI = [
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() external view returns (uint8)',
  'function description() external view returns (string)',
];

// =====================================================
// PRICE CACHE
// =====================================================

interface CachedPrice {
  price: number;
  timestamp: number;
  source: 'chainlink' | 'pyth' | 'fallback';
}

const priceCache: Map<string, CachedPrice> = new Map();
const CACHE_TTL_MS = 60000; // 1 minute cache

// =====================================================
// PRICE ORACLE SERVICE
// =====================================================

export class PriceOracleService {
  private ethereumProvider: JsonRpcProvider;
  private baseProvider: JsonRpcProvider;
  private arbitrumProvider: JsonRpcProvider;
  private solanaConnection: Connection;

  constructor() {
    this.ethereumProvider = new JsonRpcProvider(
      process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo'
    );
    this.baseProvider = new JsonRpcProvider(
      process.env.BASE_RPC_URL || 'https://mainnet.base.org'
    );
    this.arbitrumProvider = new JsonRpcProvider(
      process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc'
    );
    this.solanaConnection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
  }

  // =====================================================
  // CHAINLINK PRICE FEEDS
  // =====================================================

  /**
   * Get price from Chainlink oracle
   */
  async getChainlinkPrice(
    chainId: ChainId.ETHEREUM | ChainId.BASE | ChainId.ARBITRUM,
    token: TokenSymbol
  ): Promise<{ price: number; timestamp: number; source: string }> {
    let feedAddress: string | undefined;
    let provider: JsonRpcProvider;

    switch (chainId) {
      case ChainId.ETHEREUM:
        feedAddress = CHAINLINK_FEEDS[token];
        provider = this.ethereumProvider;
        break;
      case ChainId.BASE:
        feedAddress = CHAINLINK_FEEDS_BASE[token];
        provider = this.baseProvider;
        break;
      case ChainId.ARBITRUM:
        feedAddress = CHAINLINK_FEEDS_ARBITRUM[token];
        provider = this.arbitrumProvider;
        break;
      default:
        throw new Error(`Chain ${chainId} not supported for Chainlink`);
    }

    if (!feedAddress) {
      throw new Error(`No Chainlink feed for ${token} on chain ${chainId}`);
    }

    const contract = new Contract(feedAddress, CHAINLINK_AGGREGATOR_ABI, provider);
    
    const [roundData, decimals] = await Promise.all([
      contract.latestRoundData(),
      contract.decimals(),
    ]);

    const price = Number(roundData.answer) / Math.pow(10, decimals);
    const timestamp = Number(roundData.updatedAt) * 1000;

    return {
      price,
      timestamp,
      source: `chainlink-${CHAIN_CONFIGS[chainId].name.toLowerCase().replace(/\s+/g, '-')}`,
    };
  }

  // =====================================================
  // PYTH PRICE FEEDS (Solana)
  // =====================================================

  /**
   * Get price from Pyth oracle on Solana
   */
  async getPythPrice(
    token: TokenSymbol
  ): Promise<{ price: number; timestamp: number; source: string; confidence: number }> {
    const feedId = PYTH_FEED_IDS[token];
    if (!feedId) {
      throw new Error(`No Pyth feed for ${token}`);
    }

    const priceAccount = new PublicKey(feedId);
    const accountInfo = await this.solanaConnection.getAccountInfo(priceAccount);

    if (!accountInfo) {
      throw new Error(`Pyth price account not found for ${token}`);
    }

    // Parse Pyth price account data
    const priceData = this.parsePythPriceData(accountInfo.data);

    return {
      price: priceData.price,
      timestamp: priceData.timestamp,
      source: 'pyth-solana',
      confidence: priceData.confidence,
    };
  }

  /**
   * Parse Pyth price account data
   * Pyth account structure: https://docs.pyth.network/price-feeds/account-structure
   */
  private parsePythPriceData(data: Buffer): {
    price: number;
    timestamp: number;
    confidence: number;
    exponent: number;
  } {
    // Skip magic number (4 bytes) + version (4 bytes) + account type (4 bytes)
    // + price type (4 bytes) + exponents (4 bytes)
    let offset = 20;

    // Read number of component prices (4 bytes)
    const numComponents = data.readUInt32LE(offset);
    offset += 4;

    // Skip component prices (each is 32 bytes pubkey + 16 bytes price + 16 bytes conf + 8 bytes slot)
    offset += numComponents * 72;

    // Read aggregate price
    const aggregatePrice = data.readBigInt64LE(offset);
    offset += 8;

    // Read aggregate confidence
    const aggregateConfidence = data.readBigInt64LE(offset);
    offset += 8;

    // Read aggregate price status (4 bytes)
    const status = data.readUInt32LE(offset);
    offset += 4;

    // Skip corporate action (4 bytes) + aggregate publish slot (8 bytes)
    offset += 12;

    // Read timestamp
    const timestamp = Number(data.readBigInt64LE(offset));
    offset += 8;

    // Read exponent (at offset 24 from start)
    const exponent = data.readInt32LE(24);

    // Calculate actual price
    const price = Number(aggregatePrice) * Math.pow(10, exponent);
    const confidence = Number(aggregateConfidence) * Math.pow(10, exponent);

    return {
      price,
      timestamp: timestamp * 1000,
      confidence,
      exponent,
    };
  }

  // =====================================================
  // UNIFIED PRICE API
  // =====================================================

  /**
   * Get token price in USD
   */
  async getPrice(token: TokenSymbol): Promise<PriceData> {
    const cacheKey = `price-${token}`;
    const cached = priceCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        token,
        priceUsd: cached.price,
        timestamp: new Date(cached.timestamp),
        source: cached.source,
      };
    }

    let priceData: { price: number; timestamp: number; source: string };

    try {
      // Use appropriate oracle based on token
      if (token === TokenSymbol.SOL) {
        const pythData = await this.getPythPrice(token);
        priceData = {
          price: pythData.price,
          timestamp: pythData.timestamp,
          source: pythData.source,
        };
      } else if (token === TokenSymbol.ETH || token === TokenSymbol.WBTC) {
        // Try Chainlink on Ethereum first
        priceData = await this.getChainlinkPrice(ChainId.ETHEREUM, token);
      } else if (token === TokenSymbol.USDC || token === TokenSymbol.USDT) {
        // Stablecoins pegged to USD
        priceData = {
          price: 1.0,
          timestamp: Date.now(),
          source: 'fixed',
        };
      } else {
        // Fallback to Ethereum Chainlink
        priceData = await this.getChainlinkPrice(ChainId.ETHEREUM, token);
      }
    } catch (error) {
      // Try fallback or cached price
      if (cached) {
        return {
          token,
          priceUsd: cached.price,
          timestamp: new Date(cached.timestamp),
          source: `${cached.source}-stale`,
        };
      }

      // Hardcoded fallback for stablecoins
      if (token === TokenSymbol.USDC || token === TokenSymbol.USDT) {
        priceData = {
          price: 1.0,
          timestamp: Date.now(),
          source: 'fallback',
        };
      } else {
        throw new Error(`Failed to get price for ${token}: ${error}`);
      }
    }

    // Update cache
    priceCache.set(cacheKey, {
      price: priceData.price,
      timestamp: priceData.timestamp,
      source: priceData.source as any,
    });

    return {
      token,
      priceUsd: priceData.price,
      timestamp: new Date(priceData.timestamp),
      source: priceData.source,
    };
  }

  /**
   * Get prices for multiple tokens
   */
  async getPrices(tokens: TokenSymbol[]): Promise<Record<TokenSymbol, PriceData>> {
    const results = await Promise.all(
      tokens.map(async (token) => {
        try {
          const price = await this.getPrice(token);
          return [token, price] as const;
        } catch (error) {
          return [token, null] as const;
        }
      })
    );

    return Object.fromEntries(
      results.filter(([_, price]) => price !== null)
    ) as Record<TokenSymbol, PriceData>;
  }

  /**
   * Convert token amount to USD
   */
  async convertToUsd(token: TokenSymbol, amount: string): Promise<ConversionResult> {
    const priceData = await this.getPrice(token);
    const tokenConfig = TOKEN_CONFIGS[token];
    
    const amountNum = parseFloat(amount);
    const usdValue = amountNum * priceData.priceUsd;

    return {
      fromToken: token,
      fromAmount: amount,
      toCurrency: 'USD',
      toAmount: usdValue.toFixed(2),
      rate: priceData.priceUsd,
      timestamp: priceData.timestamp,
      source: priceData.source,
    };
  }

  /**
   * Convert between tokens
   */
  async convertTokens(
    fromToken: TokenSymbol,
    toToken: TokenSymbol,
    amount: string
  ): Promise<ConversionResult> {
    const [fromPrice, toPrice] = await Promise.all([
      this.getPrice(fromToken),
      this.getPrice(toToken),
    ]);

    const amountNum = parseFloat(amount);
    const usdValue = amountNum * fromPrice.priceUsd;
    const toAmount = usdValue / toPrice.priceUsd;

    return {
      fromToken,
      fromAmount: amount,
      toToken,
      toAmount: toAmount.toFixed(TOKEN_CONFIGS[toToken].decimals),
      rate: fromPrice.priceUsd / toPrice.priceUsd,
      timestamp: new Date(),
      source: `${fromPrice.source}/${toPrice.source}`,
    };
  }

  /**
   * Calculate gas cost in USD
   */
  async calculateGasCostInUsd(
    chainId: ChainId,
    gasCostNative: string
  ): Promise<GasCostEstimate> {
    const chainConfig = CHAIN_CONFIGS[chainId];
    const nativeToken = chainConfig.nativeCurrency;

    const [priceData] = await Promise.all([
      this.getPrice(nativeToken),
    ]);

    const gasCostNum = parseFloat(gasCostNative);
    const usdCost = gasCostNum * priceData.priceUsd;

    return {
      chainId,
      chainName: chainConfig.name,
      gasCostNative,
      nativeToken,
      gasCostUsd: usdCost,
      rateUsd: priceData.priceUsd,
      timestamp: new Date(),
    };
  }

  /**
   * Get cheapest chain for gas
   */
  async getCheapestChainForGas(
    candidateChains: ChainId[]
  ): Promise<Array<{ chainId: ChainId; chainName: string; gasTokenPrice: number }>> {
    const results = await Promise.all(
      candidateChains.map(async (chainId) => {
        try {
          const nativeToken = CHAIN_CONFIGS[chainId].nativeCurrency;
          const priceData = await this.getPrice(nativeToken);
          
          return {
            chainId,
            chainName: CHAIN_CONFIGS[chainId].name,
            gasTokenPrice: priceData.priceUsd,
          };
        } catch (error) {
          return null;
        }
      })
    );

    return results
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.gasTokenPrice - b.gasTokenPrice);
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    priceCache.clear();
  }
}

// =====================================================
// TYPES
// =====================================================

export interface PriceData {
  token: TokenSymbol;
  priceUsd: number;
  timestamp: Date;
  source: string;
  confidence?: number;
}

export interface ConversionResult {
  fromToken: TokenSymbol;
  fromAmount: string;
  toToken?: TokenSymbol;
  toCurrency?: string;
  toAmount: string;
  rate: number;
  timestamp: Date;
  source: string;
}

export interface GasCostEstimate {
  chainId: ChainId;
  chainName: string;
  gasCostNative: string;
  nativeToken: TokenSymbol;
  gasCostUsd: number;
  rateUsd: number;
  timestamp: Date;
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

let priceOracleService: PriceOracleService | null = null;

export function getPriceOracleService(): PriceOracleService {
  if (!priceOracleService) {
    priceOracleService = new PriceOracleService();
  }
  return priceOracleService;
}

export default getPriceOracleService;
