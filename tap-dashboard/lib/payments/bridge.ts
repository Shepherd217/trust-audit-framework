/**
 * Cross-Chain Transfer Service for MoltOS
 * 
 * Supports:
 * - Circle CCTP for USDC (Ethereum ↔ Solana)
 * - LayerZero for other tokens
 * - Bridge aggregator (Li.Fi) for optimal routes
 * 
 * @module lib/payments/bridge
 */

import { ethers, Contract, Wallet, parseUnits, formatUnits } from 'ethers';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { ChainId, TokenSymbol, CHAIN_CONFIGS, TOKEN_CONFIGS } from './multichain';

// =====================================================
// BRIDGE CONFIGURATION
// =====================================================

// Circle CCTP Contract Addresses
const CCTP_CONTRACTS: Record<number, { messageTransmitter: string; tokenMessenger: string }> = {
  [ChainId.ETHEREUM]: {
    messageTransmitter: '0x0a992d191DEeC32aFe362BAd4ea9C592aBfd9d3a',
    tokenMessenger: '0xBd3fa81B58Ba92a82136038B25aDec7066af3155',
  },
  [ChainId.SEPOLIA]: {
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291eB3cd89',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  },
  [ChainId.BASE]: {
    messageTransmitter: '0x0a992d191DEeC32aFe362BAd4ea9C592aBfd9d3a',
    tokenMessenger: '0x1682Ae6375C4E4A97e4Ba406428E8E53F2Ca0309',
  },
  [ChainId.BASE_SEPOLIA]: {
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291eB3cd89',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  },
  [ChainId.ARBITRUM]: {
    messageTransmitter: '0x0a992d191DEeC32aFe362BAd4ea9C592aBfd9d3a',
    tokenMessenger: '0x19330d10D9Cc8751218eaf51E8885D058642E08A',
  },
  [ChainId.ARBITRUM_SEPOLIA]: {
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291eB3cd89',
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
  },
};

// Circle CCTP Domain IDs
const CCTP_DOMAIN_IDS: Record<number, number> = {
  [ChainId.ETHEREUM]: 0,
  [ChainId.SEPOLIA]: 0,
  [ChainId.BASE]: 6,
  [ChainId.BASE_SEPOLIA]: 6,
  [ChainId.ARBITRUM]: 3,
  [ChainId.ARBITRUM_SEPOLIA]: 3,
};

// LayerZero Endpoint Addresses
const LAYERZERO_ENDPOINTS: Partial<Record<ChainId, string>> = {
  [ChainId.ETHEREUM]: '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675',
  [ChainId.SEPOLIA]: '0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1',
  [ChainId.BASE]: '0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7',
  [ChainId.ARBITRUM]: '0x3c2269811836af69497E5F486A85D7316753cf62',
};

// LayerZero Chain IDs
const LAYERZERO_CHAIN_IDS: Record<ChainId, number> = {
  [ChainId.ETHEREUM]: 101,
  [ChainId.SEPOLIA]: 10161,
  [ChainId.BASE]: 184,
  [ChainId.BASE_SEPOLIA]: 10245,
  [ChainId.ARBITRUM]: 110,
  [ChainId.ARBITRUM_SEPOLIA]: 10231,
  [ChainId.SOLANA]: 168,
  [ChainId.SOLANA_DEVNET]: 10375,
};

// CCTP ABI
const CCTP_TOKEN_MESSENGER_ABI = [
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64)',
  'function replaceDepositForBurn(bytes calldata originalMessage, bytes calldata originalAttestation, bytes calldata newDestinationCaller, bytes32 newMintRecipient) external',
  'event DepositForBurn(uint64 indexed nonce, address indexed burnToken, uint256 amount, address indexed depositor, bytes32 mintRecipient, uint32 destinationDomain, bytes32 destinationTokenMessenger, bytes32 destinationCaller)',
];

const CCTP_MESSAGE_TRANSMITTER_ABI = [
  'function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool)',
  'function getNonce(bytes calldata message) external pure returns (uint256)',
  'function usedNonces(bytes32) external view returns (bool)',
  'event MessageReceived(address indexed caller, uint32 indexed sourceDomain, uint64 indexed nonce, bytes32 sender, bytes messageBody)',
];

// LayerZero ABI
const LAYERZERO_ENDPOINT_ABI = [
  'function send(uint16 _dstChainId, bytes calldata _destination, bytes calldata _payload, address payable _refundAddress, address _zroPaymentAddress, bytes calldata _adapterParams) external payable',
  'function estimateFees(uint16 _dstChainId, address _userApplication, bytes calldata _payload, bool _payInZRO, bytes calldata _adapterParam) external view returns (uint256 nativeFee, uint256 zroFee)',
];

// =====================================================
// BRIDGE SERVICE
// =====================================================

export class BridgeService {
  private providers: Map<ChainId, ethers.JsonRpcProvider> = new Map();
  private solanaConnection: Connection;

  constructor() {
    // Initialize providers
    for (const [chainId, config] of Object.entries(CHAIN_CONFIGS)) {
      if (config.isEvm) {
        this.providers.set(config.id, new ethers.JsonRpcProvider(config.rpcUrl));
      }
    }

    this.solanaConnection = new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      'confirmed'
    );
  }

  // =====================================================
  // CCTP (CROSS-CHAIN TRANSFER PROTOCOL)
  // =====================================================

  /**
   * Initiate USDC transfer via Circle CCTP
   */
  async initiateCctpTransfer(
    sourceChainId: ChainId.ETHEREUM | ChainId.BASE | ChainId.ARBITRUM | ChainId.SEPOLIA | ChainId.BASE_SEPOLIA | ChainId.ARBITRUM_SEPOLIA,
    destinationChainId: ChainId.ETHEREUM | ChainId.BASE | ChainId.ARBITRUM | ChainId.SEPOLIA | ChainId.BASE_SEPOLIA | ChainId.ARBITRUM_SEPOLIA,
    amount: string,
    recipientAddress: string,
    senderPrivateKey: string
  ): Promise<CctpTransferResult> {
    const contracts = CCTP_CONTRACTS[sourceChainId];
    if (!contracts) {
      throw new Error(`CCTP not supported on chain ${sourceChainId}`);
    }

    const destinationDomain = CCTP_DOMAIN_IDS[destinationChainId];
    if (destinationDomain === undefined) {
      throw new Error(`CCTP not supported for destination chain ${destinationChainId}`);
    }

    const provider = this.providers.get(sourceChainId);
    if (!provider) {
      throw new Error(`No provider for chain ${sourceChainId}`);
    }

    const wallet = new Wallet(senderPrivateKey, provider);
    const tokenMessenger = new Contract(
      contracts.tokenMessenger,
      CCTP_TOKEN_MESSENGER_ABI,
      wallet
    );

    const usdcAddress = TOKEN_CONFIGS[TokenSymbol.USDC].addresses[sourceChainId];
    if (!usdcAddress) {
      throw new Error(`USDC not supported on chain ${sourceChainId}`);
    }

    // Convert amount to proper decimals
    const parsedAmount = parseUnits(amount, 6); // USDC has 6 decimals

    // Convert recipient address to bytes32
    const mintRecipient = ethers.zeroPadValue(ethers.getAddress(recipientAddress), 32);

    // Approve USDC spending if needed
    const erc20Abi = ['function approve(address spender, uint256 amount) returns (bool)'];
    const usdcContract = new Contract(usdcAddress, erc20Abi, wallet);
    
    const approveTx = await usdcContract.approve(contracts.tokenMessenger, parsedAmount);
    await approveTx.wait();

    // Initiate burn
    const tx = await tokenMessenger.depositForBurn(
      parsedAmount,
      destinationDomain,
      mintRecipient,
      usdcAddress
    );

    const receipt = await tx.wait();

    // Extract nonce from event
    const event = receipt.logs
      .map((log: any) => {
        try {
          return tokenMessenger.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((parsed: any) => parsed?.name === 'DepositForBurn');

    const nonce = event?.args?.nonce;

    return {
      txHash: receipt.hash,
      nonce: nonce?.toString(),
      sourceChainId,
      destinationChainId,
      amount,
      recipient: recipientAddress,
      status: 'PENDING_ATTESTATION',
      attestationUrl: `https://iris-api.circle.com/v1/attestations/${nonce}`,
    };
  }

  /**
   * Complete CCTP transfer on destination chain
   */
  async completeCctpTransfer(
    destinationChainId: ChainId.ETHEREUM | ChainId.BASE | ChainId.ARBITRUM | ChainId.SEPOLIA | ChainId.BASE_SEPOLIA | ChainId.ARBITRUM_SEPOLIA,
    message: string,
    attestation: string,
    recipientPrivateKey: string
  ): Promise<{ txHash: string; status: string }> {
    const contracts = CCTP_CONTRACTS[destinationChainId];
    if (!contracts) {
      throw new Error(`CCTP not supported on chain ${destinationChainId}`);
    }

    const provider = this.providers.get(destinationChainId);
    if (!provider) {
      throw new Error(`No provider for chain ${destinationChainId}`);
    }

    const wallet = new Wallet(recipientPrivateKey, provider);
    const messageTransmitter = new Contract(
      contracts.messageTransmitter,
      CCTP_MESSAGE_TRANSMITTER_ABI,
      wallet
    );

    const tx = await messageTransmitter.receiveMessage(
      ethers.getBytes(message),
      ethers.getBytes(attestation)
    );

    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      status: 'COMPLETED',
    };
  }

  /**
   * Fetch attestation from Circle API
   */
  async fetchCctpAttestation(nonce: string): Promise<AttestationResponse> {
    const response = await fetch(`https://iris-api.circle.com/v1/attestations/${nonce}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch attestation: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      attestation: data.attestation,
      status: data.status, // 'pending_confirmations' or 'complete'
      destinationChainId: data.destinationChainId,
    };
  }

  // =====================================================
  // LAYERZERO BRIDGE
  // =====================================================

  /**
   * Estimate LayerZero fees
   */
  async estimateLayerZeroFees(
    sourceChainId: ChainId,
    destinationChainId: ChainId,
    payload: string,
    senderAddress: string,
    payInZro: boolean = false
  ): Promise<{ nativeFee: bigint; zroFee: bigint }> {
    const endpointAddress = LAYERZERO_ENDPOINTS[sourceChainId];
    if (!endpointAddress) {
      throw new Error(`LayerZero not supported on chain ${sourceChainId}`);
    }

    const provider = this.providers.get(sourceChainId);
    if (!provider) {
      throw new Error(`No provider for chain ${sourceChainId}`);
    }

    const endpoint = new Contract(
      endpointAddress,
      LAYERZERO_ENDPOINT_ABI,
      provider
    );

    const dstChainId = LAYERZERO_CHAIN_IDS[destinationChainId];
    const adapterParams = '0x'; // Default adapter params

    const [nativeFee, zroFee] = await endpoint.estimateFees(
      dstChainId,
      senderAddress,
      ethers.getBytes(payload),
      payInZro,
      adapterParams
    );

    return { nativeFee, zroFee };
  }

  /**
   * Send message via LayerZero
   */
  async sendLayerZeroMessage(
    sourceChainId: ChainId,
    destinationChainId: ChainId,
    payload: string,
    senderPrivateKey: string,
    options?: {
      zroPaymentAddress?: string;
      adapterParams?: string;
    }
  ): Promise<{ txHash: string }> {
    const endpointAddress = LAYERZERO_ENDPOINTS[sourceChainId];
    if (!endpointAddress) {
      throw new Error(`LayerZero not supported on chain ${sourceChainId}`);
    }

    const provider = this.providers.get(sourceChainId);
    if (!provider) {
      throw new Error(`No provider for chain ${sourceChainId}`);
    }

    const wallet = new Wallet(senderPrivateKey, provider);
    const endpoint = new Contract(
      endpointAddress,
      LAYERZERO_ENDPOINT_ABI,
      wallet
    );

    const dstChainId = LAYERZERO_CHAIN_IDS[destinationChainId];
    const destination = ethers.zeroPadValue(wallet.address, 32);
    const refundAddress = wallet.address;
    const zroPaymentAddress = options?.zroPaymentAddress || ethers.ZeroAddress;
    const adapterParams = options?.adapterParams || '0x';

    // Estimate fees
    const { nativeFee } = await this.estimateLayerZeroFees(
      sourceChainId,
      destinationChainId,
      payload,
      wallet.address
    );

    const tx = await endpoint.send(
      dstChainId,
      destination,
      ethers.getBytes(payload),
      refundAddress,
      zroPaymentAddress,
      adapterParams,
      { value: nativeFee }
    );

    const receipt = await tx.wait();

    return { txHash: receipt.hash };
  }

  // =====================================================
  // LI.FI BRIDGE AGGREGATOR
  // =====================================================

  /**
   * Get quote from Li.Fi aggregator
   */
  async getLiFiQuote(params: LiFiQuoteRequest): Promise<LiFiQuote> {
    const url = new URL('https://li.quest/v1/quote');
    url.searchParams.append('fromChain', this.getLiFiChainId(params.fromChain).toString());
    url.searchParams.append('toChain', this.getLiFiChainId(params.toChain).toString());
    url.searchParams.append('fromToken', params.fromToken);
    url.searchParams.append('toToken', params.toToken);
    url.searchParams.append('fromAmount', params.fromAmount);
    url.searchParams.append('fromAddress', params.fromAddress);
    url.searchParams.append('toAddress', params.toAddress);
    url.searchParams.append('slippage', (params.slippage || 0.5).toString());

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Li.Fi quote failed: ${error}`);
    }

    return await response.json();
  }

  /**
   * Get available routes from Li.Fi
   */
  async getLiFiRoutes(params: LiFiQuoteRequest): Promise<LiFiRoutes> {
    const url = new URL('https://li.quest/v1/advanced/routes');
    url.searchParams.append('fromChain', this.getLiFiChainId(params.fromChain).toString());
    url.searchParams.append('toChain', this.getLiFiChainId(params.toChain).toString());
    url.searchParams.append('fromToken', params.fromToken);
    url.searchParams.append('toToken', params.toToken);
    url.searchParams.append('fromAmount', params.fromAmount);
    url.searchParams.append('fromAddress', params.fromAddress);
    url.searchParams.append('toAddress', params.toAddress);
    url.searchParams.append('order', 'CHEAPEST');

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Li.Fi routes failed: ${error}`);
    }

    return await response.json();
  }

  /**
   * Execute Li.Fi transaction
   */
  async executeLiFiTransaction(
    quote: LiFiQuote,
    senderPrivateKey: string
  ): Promise<{ txHash: string; status: string }> {
    if (!quote.transactionRequest) {
      throw new Error('Quote does not contain transaction request');
    }

    const provider = this.providers.get(this.getChainIdFromLiFi(quote.action.fromChainId));
    if (!provider) {
      throw new Error('Provider not found');
    }

    const wallet = new Wallet(senderPrivateKey, provider);

    const tx = await wallet.sendTransaction({
      to: quote.transactionRequest.to,
      data: quote.transactionRequest.data,
      value: quote.transactionRequest.value ? BigInt(quote.transactionRequest.value) : BigInt(0),
      gasLimit: quote.transactionRequest.gasLimit ? BigInt(quote.transactionRequest.gasLimit) : undefined,
    });

    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      status: 'PENDING',
    };
  }

  /**
   * Get status of Li.Fi transaction
   */
  async getLiFiTransactionStatus(txHash: string, fromChain: ChainId): Promise<LiFiStatus> {
    const url = new URL('https://li.quest/v1/status');
    url.searchParams.append('txHash', txHash);
    url.searchParams.append('fromChain', this.getLiFiChainId(fromChain).toString());

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.statusText}`);
    }

    return await response.json();
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private getLiFiChainId(chainId: ChainId): number {
    const mapping: Record<ChainId, number> = {
      [ChainId.ETHEREUM]: 1,
      [ChainId.SEPOLIA]: 11155111,
      [ChainId.BASE]: 8453,
      [ChainId.BASE_SEPOLIA]: 84532,
      [ChainId.ARBITRUM]: 42161,
      [ChainId.ARBITRUM_SEPOLIA]: 421614,
      [ChainId.SOLANA]: 1151111081099710,
      [ChainId.SOLANA_DEVNET]: 1151111081099710, // Same for devnet in Li.Fi
    };

    const liFiChainId = mapping[chainId];
    if (!liFiChainId) {
      throw new Error(`Chain ${chainId} not supported by Li.Fi`);
    }
    return liFiChainId;
  }

  private getChainIdFromLiFi(liFiChainId: number): ChainId {
    const mapping: Record<number, ChainId> = {
      1: ChainId.ETHEREUM,
      11155111: ChainId.SEPOLIA,
      8453: ChainId.BASE,
      84532: ChainId.BASE_SEPOLIA,
      42161: ChainId.ARBITRUM,
      421614: ChainId.ARBITRUM_SEPOLIA,
      1151111081099710: ChainId.SOLANA,
    };

    const chainId = mapping[liFiChainId];
    if (!chainId) {
      throw new Error(`Li.Fi chain ID ${liFiChainId} not supported`);
    }
    return chainId;
  }

  /**
   * Find best bridge route
   */
  async findBestBridgeRoute(
    sourceChainId: ChainId,
    destinationChainId: ChainId,
    token: TokenSymbol,
    amount: string,
    fromAddress: string,
    toAddress: string
  ): Promise<BridgeRouteRecommendation> {
    const routes: Array<{ type: string; estimate: any; error?: string }> = [];

    // Check CCTP for USDC
    if (token === TokenSymbol.USDC) {
      try {
        const cctpEstimate = {
          type: 'cctp',
          estimatedTime: '13-15 minutes',
          fees: {
            sourceGas: '~0.001 ETH',
            destinationGas: '~0.001 ETH',
            bridgeFee: '0',
          },
        };
        routes.push({ type: 'CCTP', estimate: cctpEstimate });
      } catch (error) {
        routes.push({ type: 'CCTP', estimate: null, error: 'Not available' });
      }
    }

    // Check Li.Fi for all routes
    try {
      const liFiRoutes = await this.getLiFiRoutes({
        fromChain: sourceChainId,
        toChain: destinationChainId,
        fromToken: token,
        toToken: token,
        fromAmount: parseUnits(amount, TOKEN_CONFIGS[token].decimals).toString(),
        fromAddress,
        toAddress,
      });

      if (liFiRoutes.routes.length > 0) {
        const bestRoute = liFiRoutes.routes[0];
        routes.push({
          type: 'Li.Fi',
          estimate: {
            estimatedTime: `${bestRoute.steps.reduce((acc: number, s: any) => acc + (s.estimate?.executionDuration || 0), 0)} seconds`,
            fees: bestRoute.steps[0]?.estimate?.gasCosts || [],
            provider: bestRoute.steps[0]?.tool,
          },
        });
      }
    } catch (error) {
      routes.push({ type: 'Li.Fi', estimate: null, error: String(error) });
    }

    // Recommend best option
    const availableRoutes = routes.filter(r => !r.error);
    
    if (availableRoutes.length === 0) {
      throw new Error('No bridge routes available');
    }

    // Prefer CCTP for USDC due to lower fees and trust
    const recommendation = availableRoutes.find(r => r.type === 'CCTP') || availableRoutes[0];

    return {
      recommendedRoute: recommendation.type,
      allRoutes: routes,
      reason: recommendation.type === 'CCTP' 
        ? 'Native Circle integration - lowest fees and fastest settlement'
        : 'Best available route via bridge aggregator',
    };
  }
}

// =====================================================
// TYPES
// =====================================================

export interface CctpTransferResult {
  txHash: string;
  nonce?: string;
  sourceChainId: ChainId;
  destinationChainId: ChainId;
  amount: string;
  recipient: string;
  status: string;
  attestationUrl: string;
}

export interface AttestationResponse {
  attestation?: string;
  status: string;
  destinationChainId?: number;
}

export interface LiFiQuoteRequest {
  fromChain: ChainId;
  toChain: ChainId;
  fromToken: TokenSymbol;
  toToken: TokenSymbol;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
  slippage?: number;
}

export interface LiFiQuote {
  id: string;
  type: string;
  tool: string;
  action: {
    fromChainId: number;
    toChainId: number;
    fromToken: { address: string; symbol: string; decimals: number };
    toToken: { address: string; symbol: string; decimals: number };
    fromAmount: string;
    slippage: number;
  };
  estimate: {
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    executionDuration: number;
    feeCosts: any[];
    gasCosts: any[];
  };
  transactionRequest?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    gasPrice: string;
  };
}

export interface LiFiRoutes {
  routes: LiFiQuote[];
}

export interface LiFiStatus {
  sending: {
    txHash: string;
    txLink: string;
    amount: string;
    token: string;
    chainId: number;
    gasPrice: string;
    gasUsed: string;
    gasToken: string;
    gasAmount: string;
    gasAmountUSD: string;
  };
  receiving?: {
    txHash: string;
    txLink: string;
    amount: string;
    token: string;
    chainId: number;
    gasPrice: string;
    gasUsed: string;
  };
  status: 'PENDING' | 'DONE' | 'FAILED';
}

export interface BridgeRouteRecommendation {
  recommendedRoute: string;
  allRoutes: Array<{ type: string; estimate: any; error?: string }>;
  reason: string;
}

// =====================================================
// SINGLETON INSTANCE
// =====================================================

let bridgeService: BridgeService | null = null;

export function getBridgeService(): BridgeService {
  if (!bridgeService) {
    bridgeService = new BridgeService();
  }
  return bridgeService;
}

export default getBridgeService;
