# Payment/Rewards Layer Architecture Specification

## Version 1.0 | SDK Verification Platform

**Date:** March 2026  
**Status:** Draft for Implementation  
**Author:** Payment Architecture Team

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Payment Options](#2-payment-options)
3. [Agent Earnings](#3-agent-earnings)
4. [User Payment Flow](#4-user-payment-flow)
5. [Technical Architecture](#5-technical-architecture)
6. [Security Considerations](#6-security-considerations)
7. [Implementation Roadmap](#7-implementation-roadmap)

---

## 1. Executive Summary

This specification defines the Payment/Rewards Layer for the SDK Verification Platform, enabling users to pay AI agents for verification tasks using fiat currencies (via Stripe) and cryptocurrencies (ETH, SOL, USDC). The system implements a reputation-weighted pricing model, escrow-based security, and transparent revenue sharing.

### Key Features

- **Multi-Modal Payments:** Support for Stripe (fiat) and crypto wallets (Web3)
- **Reputation-Based Pricing:** Dynamic pricing based on agent performance history
- **Secure Escrow:** Funds held until task completion verification
- **Fair Revenue Sharing:** Configurable splits between platform and agents
- **Dispute Resolution:** Automated and manual dispute handling

---

## 2. Payment Options

### 2.1 Stripe Integration for Fiat Payments

#### 2.1.1 Architecture Overview

The platform operates as a **marketplace** using Stripe Connect with Destination Charges pattern. This allows us to:
- Collect payments from users
- Hold funds in platform escrow
- Distribute earnings to agents after task completion

#### 2.1.2 Stripe Connect Configuration

```javascript
// stripe-config.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const STRIPE_CONFIG = {
  // Platform fee percentage (0.5% - 5% based on volume)
  platformFeePercent: 2.5,
  
  // Connected account configuration
  connectedAccount: {
    type: 'express', // or 'standard' for full KYC
    capabilities: ['transfers', 'card_payments'],
    controller: {
      fees: { payer: 'application' },
      losses: { payer: 'application' },
      requirement_collection: 'application',
      stripe_dashboard: { type: 'none' }
    }
  },
  
  // Payout schedule
  payoutSchedule: {
    interval: 'manual', // Manual to support escrow model
    delay_days: 7       // Minimum delay for dispute window
  }
};

module.exports = { stripe, STRIPE_CONFIG };
```

#### 2.1.3 Payment Intent Creation

```javascript
// services/stripe-service.js
class StripeService {
  async createPaymentIntent(paymentDetails) {
    const { amount, currency, customerId, agentStripeAccountId, metadata } = paymentDetails;
    
    // Calculate fees
    const platformFee = Math.round(amount * (STRIPE_CONFIG.platformFeePercent / 100));
    const agentAmount = amount - platformFee;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,                    // Total in cents
      currency: currency.toLowerCase(),  // 'usd', 'eur', 'gbp'
      customer: customerId,
      
      // Destination charge to agent's connected account
      transfer_data: {
        destination: agentStripeAccountId,
        amount: agentAmount
      },
      
      // Platform fee
      application_fee_amount: platformFee,
      
      // Store task metadata
      metadata: {
        task_id: metadata.taskId,
        agent_id: metadata.agentId,
        user_id: metadata.userId,
        escrow_id: metadata.escrowId,
        reputation_tier: metadata.reputationTier
      },
      
      // Enable future usage for repeat customers
      setup_future_usage: 'off_session',
      
      // Capture method for escrow
      capture_method: 'manual'  // Authorize now, capture on completion
    });
    
    return paymentIntent;
  }
  
  async capturePayment(paymentIntentId) {
    return await stripe.paymentIntents.capture(paymentIntentId);
  }
  
  async cancelPayment(paymentIntentId) {
    return await stripe.paymentIntents.cancel(paymentIntentId);
  }
  
  async createRefund(paymentIntentId, amount, reason) {
    return await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount,
      reason: reason,  // 'duplicate', 'fraudulent', 'requested_by_customer'
      reverse_transfer: true,      // Reverse the transfer to agent
      refund_application_fee: true // Refund platform fee
    });
  }
}
```

#### 2.1.4 Agent Onboarding

```javascript
// services/agent-onboarding.js
class AgentOnboardingService {
  async onboardAgent(agentId, agentDetails) {
    // Create connected account
    const account = await stripe.accounts.create({
      type: 'express',
      email: agentDetails.email,
      business_type: 'individual',
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true }
      },
      metadata: {
        agent_id: agentId,
        platform: 'sdk-verification'
      }
    });
    
    // Generate onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.APP_URL}/agents/${agentId}/stripe/refresh`,
      return_url: `${process.env.APP_URL}/agents/${agentId}/stripe/success`,
      type: 'account_onboarding'
    });
    
    // Store in database
    await db.agents.update(agentId, {
      stripe_account_id: account.id,
      stripe_onboarding_url: accountLink.url,
      stripe_onboarding_status: 'pending'
    });
    
    return { accountId: account.id, onboardingUrl: accountLink.url };
  }
}
```

### 2.2 Crypto Payment Options

#### 2.2.1 Supported Networks

| Network | Currency | Contract Address | Confirmation Blocks |
|---------|----------|------------------|---------------------|
| Ethereum | ETH | Native | 12 |
| Ethereum | USDC | 0xA0b86a33E6441E6C7D3D4b4d6... | 12 |
| Solana | SOL | Native | 32 |
| Solana | USDC | EPjFWdd5AufqSSqeM2qN1xzyb... | 32 |

#### 2.2.2 Smart Contract Escrow (Solidity)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SDKEscrow is ReentrancyGuard, Pausable, AccessControl {
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");
    bytes32 public constant PLATFORM_ROLE = keccak256("PLATFORM_ROLE");
    
    enum State { AWAITING_PAYMENT, FUNDED, IN_PROGRESS, COMPLETED, DISPUTED, REFUNDED }
    
    struct Escrow {
        address payer;
        address agent;
        address token;          // address(0) for native ETH/SOL
        uint256 amount;
        uint256 platformFee;
        uint256 createdAt;
        uint256 deadline;
        State state;
        string taskId;
        bytes32 verificationHash;
    }
    
    mapping(bytes32 => Escrow) public escrows;
    mapping(address => bool) public supportedTokens;
    
    uint256 public platformFeePercent = 250;  // 2.5% (basis points)
    uint256 public constant MAX_FEE = 1000;   // 10% max
    uint256 public disputeWindow = 7 days;
    
    event EscrowCreated(bytes32 indexed escrowId, address indexed payer, address indexed agent, uint256 amount);
    event FundsDeposited(bytes32 indexed escrowId, uint256 amount);
    event TaskStarted(bytes32 indexed escrowId);
    event TaskCompleted(bytes32 indexed escrowId, bytes32 verificationHash);
    event FundsReleased(bytes32 indexed escrowId, uint256 agentAmount, uint256 platformAmount);
    event DisputeRaised(bytes32 indexed escrowId, address indexed by, string reason);
    event DisputeResolved(bytes32 indexed escrowId, address winner, uint256 amount);
    event Refunded(bytes32 indexed escrowId, uint256 amount);
    
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PLATFORM_ROLE, admin);
    }
    
    function createEscrow(
        bytes32 escrowId,
        address agent,
        address token,
        uint256 amount,
        string calldata taskId,
        uint256 duration
    ) external payable whenNotPaused returns (bool) {
        require(escrows[escrowId].createdAt == 0, "Escrow exists");
        require(agent != address(0), "Invalid agent");
        require(amount > 0, "Invalid amount");
        require(duration <= 30 days, "Duration too long");
        
        uint256 platformFee = (amount * platformFeePercent) / 10000;
        uint256 totalAmount = amount + platformFee;
        
        if (token == address(0)) {
            require(msg.value == totalAmount, "Incorrect ETH amount");
        } else {
            require(supportedTokens[token], "Token not supported");
            require(
                IERC20(token).transferFrom(msg.sender, address(this), totalAmount),
                "Transfer failed"
            );
        }
        
        escrows[escrowId] = Escrow({
            payer: msg.sender,
            agent: agent,
            token: token,
            amount: amount,
            platformFee: platformFee,
            createdAt: block.timestamp,
            deadline: block.timestamp + duration,
            state: State.FUNDED,
            taskId: taskId,
            verificationHash: bytes32(0)
        });
        
        emit EscrowCreated(escrowId, msg.sender, agent, amount);
        emit FundsDeposited(escrowId, totalAmount);
        
        return true;
    }
    
    function confirmCompletion(
        bytes32 escrowId,
        bytes32 verificationHash
    ) external onlyRole(PLATFORM_ROLE) nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state == State.IN_PROGRESS, "Invalid state");
        require(block.timestamp <= escrow.deadline, "Escrow expired");
        
        escrow.state = State.COMPLETED;
        escrow.verificationHash = verificationHash;
        
        emit TaskCompleted(escrowId, verificationHash);
        
        // Auto-release funds
        _releaseFunds(escrowId);
    }
    
    function _releaseFunds(bytes32 escrowId) internal {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state == State.COMPLETED, "Not completed");
        
        escrow.state = State.COMPLETED;
        
        if (escrow.token == address(0)) {
            // Release ETH
            (bool agentSuccess, ) = escrow.agent.call{value: escrow.amount}("");
            require(agentSuccess, "Agent transfer failed");
            
            (bool platformSuccess, ) = payable(getPlatformWallet()).call{value: escrow.platformFee}("");
            require(platformSuccess, "Platform transfer failed");
        } else {
            // Release ERC20
            require(IERC20(escrow.token).transfer(escrow.agent, escrow.amount), "Agent transfer failed");
            require(
                IERC20(escrow.token).transfer(getPlatformWallet(), escrow.platformFee),
                "Platform transfer failed"
            );
        }
        
        emit FundsReleased(escrowId, escrow.amount, escrow.platformFee);
    }
    
    function raiseDispute(bytes32 escrowId, string calldata reason) external {
        Escrow storage escrow = escrows[escrowId];
        require(
            msg.sender == escrow.payer || msg.sender == escrow.agent,
            "Unauthorized"
        );
        require(
            escrow.state == State.FUNDED || escrow.state == State.IN_PROGRESS,
            "Invalid state"
        );
        
        escrow.state = State.DISPUTED;
        emit DisputeRaised(escrowId, msg.sender, reason);
    }
    
    function resolveDispute(
        bytes32 escrowId,
        address winner,
        uint256 agentPayoutPercent
    ) external onlyRole(ARBITER_ROLE) nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(escrow.state == State.DISPUTED, "Not disputed");
        require(
            winner == escrow.payer || winner == escrow.agent,
            "Invalid winner"
        );
        require(agentPayoutPercent <= 100, "Invalid percentage");
        
        escrow.state = State.COMPLETED;
        
        uint256 agentAmount = (escrow.amount * agentPayoutPercent) / 100;
        uint256 payerAmount = escrow.amount + escrow.platformFee - agentAmount;
        
        if (escrow.token == address(0)) {
            if (agentAmount > 0) {
                (bool success, ) = escrow.agent.call{value: agentAmount}("");
                require(success, "Agent transfer failed");
            }
            if (payerAmount > 0) {
                (bool success, ) = escrow.payer.call{value: payerAmount}("");
                require(success, "Payer transfer failed");
            }
        } else {
            if (agentAmount > 0) {
                IERC20(escrow.token).transfer(escrow.agent, agentAmount);
            }
            if (payerAmount > 0) {
                IERC20(escrow.token).transfer(escrow.payer, payerAmount);
            }
        }
        
        emit DisputeResolved(escrowId, winner, agentAmount);
    }
    
    function refundExpired(bytes32 escrowId) external nonReentrant {
        Escrow storage escrow = escrows[escrowId];
        require(block.timestamp > escrow.deadline + disputeWindow, "Not expired");
        require(
            escrow.state == State.FUNDED || escrow.state == State.IN_PROGRESS,
            "Invalid state"
        );
        
        uint256 refundAmount = escrow.amount + escrow.platformFee;
        escrow.state = State.REFUNDED;
        
        if (escrow.token == address(0)) {
            (bool success, ) = escrow.payer.call{value: refundAmount}("");
            require(success, "Refund failed");
        } else {
            require(IERC20(escrow.token).transfer(escrow.payer, refundAmount), "Refund failed");
        }
        
        emit Refunded(escrowId, refundAmount);
    }
    
    function getPlatformWallet() internal view returns (address) {
        return getRoleMember(PLATFORM_ROLE, 0);
    }
    
    // Admin functions
    function setPlatformFee(uint256 newFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFee <= MAX_FEE, "Fee too high");
        platformFeePercent = newFee;
    }
    
    function setDisputeWindow(uint256 newWindow) external onlyRole(DEFAULT_ADMIN_ROLE) {
        disputeWindow = newWindow;
    }
    
    function addSupportedToken(address token) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedTokens[token] = true;
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    receive() external payable {
        revert("Use createEscrow");
    }
}
```

#### 2.2.3 Solana Program (Rust)

```rust
// programs/sdk_escrow/src/lib.rs
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Escrow111111111111111111111111111111111111111");

#[program]
pub mod sdk_escrow {
    use super::*;

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        escrow_id: [u8; 32],
        amount: u64,
        platform_fee: u64,
        duration: i64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let clock = Clock::get()?;

        escrow.payer = ctx.accounts.payer.key();
        escrow.agent = ctx.accounts.agent.key();
        escrow.mint = ctx.accounts.mint.key();
        escrow.amount = amount;
        escrow.platform_fee = platform_fee;
        escrow.created_at = clock.unix_timestamp;
        escrow.deadline = clock.unix_timestamp + duration;
        escrow.state = EscrowState::Funded;
        escrow.escrow_id = escrow_id;
        escrow.platform_wallet = ctx.accounts.platform_wallet.key();

        // Transfer tokens to escrow
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer_token_account.to_account_info(),
                    to: ctx.accounts.escrow_token_account.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            amount + platform_fee,
        )?;

        emit!(EscrowCreated {
            escrow_id,
            payer: escrow.payer,
            agent: escrow.agent,
            amount,
        });

        Ok(())
    }

    pub fn confirm_completion(ctx: Context<ConfirmCompletion>, verification_hash: [u8; 32]) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        let clock = Clock::get()?;

        require!(escrow.state == EscrowState::Funded, ErrorCode::InvalidState);
        require!(clock.unix_timestamp <= escrow.deadline, ErrorCode::EscrowExpired);

        escrow.state = EscrowState::Completed;
        escrow.verification_hash = verification_hash;

        // Transfer to agent
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.agent_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                &[&[b"escrow", &escrow.escrow_id, &[ctx.bumps.escrow]]],
            ),
            escrow.amount,
        )?;

        // Transfer platform fee
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.platform_token_account.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                &[&[b"escrow", &escrow.escrow_id, &[ctx.bumps.escrow]]],
            ),
            escrow.platform_fee,
        )?;

        emit!(EscrowCompleted {
            escrow_id: escrow.escrow_id,
            verification_hash,
        });

        Ok(())
    }

    pub fn raise_dispute(ctx: Context<RaiseDispute>, reason: String) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        require!(
            ctx.accounts.caller.key() == escrow.payer || ctx.accounts.caller.key() == escrow.agent,
            ErrorCode::Unauthorized
        );
        require!(
            escrow.state == EscrowState::Funded || escrow.state == EscrowState::InProgress,
            ErrorCode::InvalidState
        );

        escrow.state = EscrowState::Disputed;

        emit!(DisputeRaised {
            escrow_id: escrow.escrow_id,
            by: ctx.accounts.caller.key(),
            reason,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(escrow_id: [u8; 32])]
pub struct InitializeEscrow<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: Agent account
    pub agent: AccountInfo<'info>,
    pub mint: Account<'info, token::Mint>,
    #[account(
        init,
        payer = payer,
        space = 8 + Escrow::SIZE,
        seeds = [b"escrow", &escrow_id],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(
        init,
        payer = payer,
        token::mint = mint,
        token::authority = escrow,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer_token_account: Account<'info, TokenAccount>,
    /// CHECK: Platform wallet
    pub platform_wallet: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
pub struct Escrow {
    pub payer: Pubkey,
    pub agent: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub platform_fee: u64,
    pub created_at: i64,
    pub deadline: i64,
    pub state: EscrowState,
    pub escrow_id: [u8; 32],
    pub platform_wallet: Pubkey,
    pub verification_hash: [u8; 32],
}

impl Escrow {
    pub const SIZE: usize = 32 + 32 + 32 + 8 + 8 + 8 + 8 + 1 + 32 + 32 + 32;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EscrowState {
    Funded,
    InProgress,
    Completed,
    Disputed,
    Refunded,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid escrow state")]
    InvalidState,
    #[msg("Escrow expired")]
    EscrowExpired,
    #[msg("Unauthorized")]
    Unauthorized,
}

#[event]
pub struct EscrowCreated {
    pub escrow_id: [u8; 32],
    pub payer: Pubkey,
    pub agent: Pubkey,
    pub amount: u64,
}

#[event]
pub struct EscrowCompleted {
    pub escrow_id: [u8; 32],
    pub verification_hash: [u8; 32],
}

#[event]
pub struct DisputeRaised {
    pub escrow_id: [u8; 32],
    pub by: Pubkey,
    pub reason: String,
}
```

### 2.3 Reputation-Weighted Pricing Model

#### 2.3.1 Reputation Tiers

```typescript
// models/reputation.ts
interface ReputationMetrics {
  // Base metrics
  totalTasksCompleted: number;
  totalTasksFailed: number;
  averageResponseTime: number;      // in seconds
  averageAccuracy: number;          // 0-100
  customerSatisfaction: number;     // 0-5 stars
  
  // Time-decayed metrics (recent performance weighted higher)
  recentTasksCompleted: number;     // Last 30 days
  recentAccuracy: number;
  
  // Penalty metrics
  disputesLost: number;
  disputesTotal: number;
  lateDeliveries: number;
  
  // Bonus metrics
  premiumTasksCompleted: number;
  repeatCustomers: number;
}

enum ReputationTier {
  NOVICE = 'novice',         // 0-100 reputation points
  BRONZE = 'bronze',         // 100-500
  SILVER = 'silver',         // 500-1500
  GOLD = 'gold',             // 1500-5000
  PLATINUM = 'platinum',     // 5000-15000
  DIAMOND = 'diamond'        // 15000+
}

interface PricingMultiplier {
  tier: ReputationTier;
  baseMultiplier: number;     // 1.0 = standard price
  minMultiplier: number;      // Floor for dynamic pricing
  maxMultiplier: number;      // Ceiling for dynamic pricing
}

const TIER_CONFIG: Record<ReputationTier, PricingMultiplier> = {
  [ReputationTier.NOVICE]: {
    tier: ReputationTier.NOVICE,
    baseMultiplier: 0.8,      // 20% discount to attract users
    minMultiplier: 0.5,
    maxMultiplier: 1.0
  },
  [ReputationTier.BRONZE]: {
    tier: ReputationTier.BRONZE,
    baseMultiplier: 0.9,
    minMultiplier: 0.7,
    maxMultiplier: 1.1
  },
  [ReputationTier.SILVER]: {
    tier: ReputationTier.SILVER,
    baseMultiplier: 1.0,      // Standard pricing
    minMultiplier: 0.85,
    maxMultiplier: 1.25
  },
  [ReputationTier.GOLD]: {
    tier: ReputationTier.GOLD,
    baseMultiplier: 1.15,     // Premium pricing
    minMultiplier: 1.0,
    maxMultiplier: 1.5
  },
  [ReputationTier.PLATINUM]: {
    tier: ReputationTier.PLATINUM,
    baseMultiplier: 1.35,
    minMultiplier: 1.15,
    maxMultiplier: 2.0
  },
  [ReputationTier.DIAMOND]: {
    tier: ReputationTier.DIAMOND,
    baseMultiplier: 1.75,     // Elite pricing
    minMultiplier: 1.5,
    maxMultiplier: 3.0
  }
};
```

#### 2.3.2 Dynamic Pricing Algorithm

```typescript
// services/pricing-engine.ts
class ReputationPricingEngine {
  
  calculateReputationScore(metrics: ReputationMetrics): number {
    // Base completion score
    const completionRate = metrics.totalTasksCompleted / 
      (metrics.totalTasksCompleted + metrics.totalTasksFailed || 1);
    const completionScore = completionRate * 100;
    
    // Accuracy score
    const accuracyScore = metrics.averageAccuracy;
    
    // Speed score (inverse of response time, normalized)
    const speedScore = Math.max(0, 100 - (metrics.averageResponseTime / 60));
    
    // Satisfaction score
    const satisfactionScore = (metrics.customerSatisfaction / 5) * 100;
    
    // Recency bonus
    const recencyBonus = Math.min(50, metrics.recentTasksCompleted / 10);
    
    // Penalty calculations
    const disputeRate = metrics.disputesLost / (metrics.disputesTotal || 1);
    const disputePenalty = disputeRate * 200;
    
    const lateDeliveryPenalty = metrics.lateDeliveries * 5;
    
    // Weighted combination
    const score = (
      completionScore * 0.25 +
      accuracyScore * 0.30 +
      speedScore * 0.15 +
      satisfactionScore * 0.20 +
      recencyBonus
    ) - disputePenalty - lateDeliveryPenalty;
    
    return Math.max(0, score);
  }
  
  getTierFromScore(score: number): ReputationTier {
    if (score >= 15000) return ReputationTier.DIAMOND;
    if (score >= 5000) return ReputationTier.PLATINUM;
    if (score >= 1500) return ReputationTier.GOLD;
    if (score >= 500) return ReputationTier.SILVER;
    if (score >= 100) return ReputationTier.BRONZE;
    return ReputationTier.NOVICE;
  }
  
  calculateDynamicPrice(
    basePrice: number,
    agentId: string,
    taskComplexity: number,      // 1-10 scale
    urgencyLevel: number,        // 1-5 scale
    marketDemand: number         // 0-1 (ratio of tasks to agents)
  ): PriceQuote {
    const metrics = this.getAgentMetrics(agentId);
    const reputationScore = this.calculateReputationScore(metrics);
    const tier = this.getTierFromScore(reputationScore);
    const tierConfig = TIER_CONFIG[tier];
    
    // Base multiplier from reputation tier
    let multiplier = tierConfig.baseMultiplier;
    
    // Adjust based on recent performance vs historical
    const performanceTrend = metrics.recentAccuracy / metrics.averageAccuracy;
    if (performanceTrend > 1.1) {
      multiplier *= 1.05;  // Rising star bonus
    } else if (performanceTrend < 0.9) {
      multiplier *= 0.95;  // Declining performance discount
    }
    
    // Complexity adjustment
    const complexityPremium = (taskComplexity - 5) * 0.05;
    multiplier += complexityPremium;
    
    // Urgency premium
    const urgencyPremium = (urgencyLevel - 1) * 0.15;
    multiplier += urgencyPremium;
    
    // Market demand adjustment
    if (marketDemand > 0.8) {
      multiplier *= 1.1;  // High demand premium
    } else if (marketDemand < 0.3) {
      multiplier *= 0.9;  // Low demand discount
    }
    
    // Apply bounds
    multiplier = Math.max(tierConfig.minMultiplier, 
                 Math.min(tierConfig.maxMultiplier, multiplier));
    
    const finalPrice = Math.round(basePrice * multiplier);
    const platformFee = Math.round(finalPrice * 0.025);  // 2.5% platform fee
    const agentEarnings = finalPrice - platformFee;
    
    return {
      basePrice,
      finalPrice,
      multiplier,
      tier,
      reputationScore,
      platformFee,
      agentEarnings,
      breakdown: {
        tierMultiplier: tierConfig.baseMultiplier,
        complexityPremium,
        urgencyPremium,
        demandAdjustment: marketDemand > 0.8 ? 0.1 : marketDemand < 0.3 ? -0.1 : 0
      }
    };
  }
  
  private getAgentMetrics(agentId: string): ReputationMetrics {
    // Database query implementation
    return db.reputation.get(agentId);
  }
}

interface PriceQuote {
  basePrice: number;
  finalPrice: number;
  multiplier: number;
  tier: ReputationTier;
  reputationScore: number;
  platformFee: number;
  agentEarnings: number;
  breakdown: {
    tierMultiplier: number;
    complexityPremium: number;
    urgencyPremium: number;
    demandAdjustment: number;
  };
}
```

---

## 3. Agent Earnings

### 3.1 Task Charging Model

Agents can charge for tasks using one of three models:

| Model | Description | Best For |
|-------|-------------|----------|
| **Fixed Price** | Set price per task type | Standardized verification tasks |
| **Hourly Rate** | Time-based billing | Complex, variable-duration tasks |
| **Performance-Based** | Price tied to accuracy/quality | High-stakes verification |

```typescript
// models/agent-pricing.ts
interface AgentPricing {
  agentId: string;
  pricingModels: {
    fixed?: FixedPricing;
    hourly?: HourlyPricing;
    performance?: PerformancePricing;
  };
  defaultModel: 'fixed' | 'hourly' | 'performance';
}

interface FixedPricing {
  taskRates: Record<TaskType, number>;
  volumeDiscounts: VolumeDiscount[];
}

interface HourlyPricing {
  baseRate: number;           // per hour
  minimumBillable: number;    // minimum hours (e.g., 0.5)
  estimatedDurations: Record<TaskType, number>; // average hours
}

interface PerformancePricing {
  baseFee: number;
  accuracyBonus: number;      // additional per % above threshold
  speedBonus: number;         // additional for fast completion
  penalties: {
    accuracyThreshold: number;
    penaltyPerPercent: number;
  };
}

interface VolumeDiscount {
  minTasks: number;
  discountPercent: number;
}
```

### 3.2 Revenue Share Structure

```typescript
// config/revenue-share.ts
interface RevenueShareConfig {
  // Platform fee structure
  platform: {
    baseFeePercent: number;       // 2.5%
    minFeeAmount: number;         // $0.50 minimum
    maxFeeAmount: number;         // $50 maximum
  };
  
  // Agent retention
  agent: {
    baseRate: number;             // 97.5% after platform fee
    loyaltyBonus: {
      minTasks: number;           // 100 tasks
      bonusPercent: number;       // +1%
      maxBonus: number;           // +5% at 500 tasks
    };
  };
  
  // Referral program
  referral: {
    referrerPercent: number;      // 1% of agent earnings
    referredBonus: number;        // 0.5% bonus for referred agents
  };
  
  // Special programs
  incentives: {
    newAgentBonus: number;        // Waived fees for first 10 tasks
    topPerformerBonus: number;    // Additional 1% for top 10% agents
    stakingBonus: number;         // Fee reduction for platform token staking
  };
}

const DEFAULT_REVENUE_SHARE: RevenueShareConfig = {
  platform: {
    baseFeePercent: 2.5,
    minFeeAmount: 0.50,
    maxFeeAmount: 50.00
  },
  agent: {
    baseRate: 97.5,
    loyaltyBonus: {
      minTasks: 100,
      bonusPercent: 1,
      maxBonus: 5
    }
  },
  referral: {
    referrerPercent: 1.0,
    referredBonus: 0.5
  },
  incentives: {
    newAgentBonus: 10,      // First 10 tasks fee-free
    topPerformerBonus: 1.0,
    stakingBonus: 0.5
  }
};
```

### 3.3 Earnings Calculation Service

```typescript
// services/earnings-calculator.ts
class EarningsCalculator {
  private config: RevenueShareConfig;
  
  constructor(config: RevenueShareConfig = DEFAULT_REVENUE_SHARE) {
    this.config = config;
  }
  
  async calculateEarnings(
    taskAmount: number,
    agentId: string,
    paymentMethod: 'stripe' | 'crypto'
  ): Promise<EarningsBreakdown> {
    const agent = await db.agents.get(agentId);
    const completedTasks = await this.getCompletedTaskCount(agentId);
    
    // Calculate platform fee
    let platformFee = Math.max(
      this.config.platform.minFeeAmount,
      Math.min(
        this.config.platform.maxFeeAmount,
        taskAmount * (this.config.platform.baseFeePercent / 100)
      )
    );
    
    // New agent bonus (waived fees)
    if (completedTasks < this.config.incentives.newAgentBonus) {
      platformFee = 0;
    }
    
    // Calculate agent share
    let agentSharePercent = this.config.agent.baseRate;
    
    // Loyalty bonus
    if (completedTasks >= this.config.agent.loyaltyBonus.minTasks) {
      const bonusTiers = Math.floor(
        (completedTasks - this.config.agent.loyaltyBonus.minTasks) / 100
      );
      const loyaltyBonus = Math.min(
        bonusTiers * this.config.agent.loyaltyBonus.bonusPercent,
        this.config.agent.loyaltyBonus.maxBonus
      );
      agentSharePercent += loyaltyBonus;
    }
    
    // Top performer bonus
    if (await this.isTopPerformer(agentId)) {
      agentSharePercent += this.config.incentives.topPerformerBonus;
    }
    
    // Calculate final amounts
    const agentEarnings = (taskAmount - platformFee) * (agentSharePercent / 100);
    const platformEarnings = taskAmount - agentEarnings;
    
    // Referral bonus
    let referralEarnings = 0;
    if (agent.referredBy) {
      referralEarnings = agentEarnings * (this.config.referral.referrerPercent / 100);
    }
    
    // Payment method fees (Stripe only)
    let paymentProcessingFee = 0;
    if (paymentMethod === 'stripe') {
      paymentProcessingFee = taskAmount * 0.029 + 0.30;  // 2.9% + $0.30
    }
    
    return {
      grossAmount: taskAmount,
      platformFee,
      paymentProcessingFee,
      agentEarnings: agentEarnings - referralEarnings,
      referralEarnings,
      platformEarnings,
      agentSharePercent,
      netAgentEarnings: agentEarnings - referralEarnings - (paymentProcessingFee / 2)
    };
  }
  
  private async getCompletedTaskCount(agentId: string): Promise<number> {
    return db.tasks.count({ agentId, status: 'completed' });
  }
  
  private async isTopPerformer(agentId: string): Promise<boolean> {
    const percentile = await db.agents.getPerformancePercentile(agentId);
    return percentile >= 90;  // Top 10%
  }
}

interface EarningsBreakdown {
  grossAmount: number;
  platformFee: number;
  paymentProcessingFee: number;
  agentEarnings: number;
  referralEarnings: number;
  platformEarnings: number;
  agentSharePercent: number;
  netAgentEarnings: number;
}
```

### 3.4 Escrow System Design

#### 3.4.1 Escrow State Machine

```
┌─────────────┐     create      ┌─────────────┐
│   INITIAL   │ ───────────────>│   CREATED   │
└─────────────┘                 └──────┬──────┘
                                       │ fund
                                       ▼
                              ┌─────────────┐
                       start  │   FUNDED    │◄──── refund (expired)
                    ┌─────────│   (Escrow)  │
                    │         └──────┬──────┘
                    │                │ agent accepts
                    │                ▼
                    │       ┌─────────────┐
                    │       │ IN_PROGRESS │
                    │       │   (Active)  │
                    │       └──────┬──────┘
                    │         complete │
                    │          / fail  │
                    │                ▼
                    │       ┌─────────────┐
                    └──────►│  COMPLETED  │────┬───► release funds to agent
                            │   (Verify)  │    │
                            └──────┬──────┘    │
                                   │ dispute    │
                                   ▼            │
                          ┌─────────────┐       │
                          │  DISPUTED   │───────┴───► resolve (arbiter)
                          │  (Hold $)   │
                          └─────────────┘
```

#### 3.4.2 Escrow Service Implementation

```typescript
// services/escrow-service.ts
enum EscrowState {
  CREATED = 'created',
  FUNDED = 'funded',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DISPUTED = 'disputed',
  REFUNDED = 'refunded',
  RELEASED = 'released'
}

interface Escrow {
  id: string;
  taskId: string;
  payerId: string;
  agentId: string;
  amount: number;
  currency: string;
  state: EscrowState;
  paymentMethod: 'stripe' | 'ethereum' | 'solana';
  externalId: string;  // payment intent ID or tx hash
  createdAt: Date;
  fundedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  releasedAt?: Date;
  disputeId?: string;
  metadata: {
    verificationHash?: string;
    disputeReason?: string;
    resolution?: string;
  };
}

class EscrowService {
  private stripeService: StripeService;
  private cryptoService: CryptoPaymentService;
  private earningsCalculator: EarningsCalculator;
  
  async createEscrow(task: Task): Promise<Escrow> {
    const escrowId = generateUUID();
    
    // Calculate pricing
    const priceQuote = await pricingEngine.calculateDynamicPrice(
      task.basePrice,
      task.agentId,
      task.complexity,
      task.urgency,
      await marketService.getDemandRatio()
    );
    
    const escrow: Escrow = {
      id: escrowId,
      taskId: task.id,
      payerId: task.userId,
      agentId: task.agentId,
      amount: priceQuote.finalPrice,
      currency: task.currency,
      state: EscrowState.CREATED,
      paymentMethod: task.paymentMethod,
      externalId: '',
      createdAt: new Date(),
      metadata: {
        priceQuote
      }
    };
    
    await db.escrows.create(escrow);
    return escrow;
  }
  
  async fundEscrow(escrowId: string, paymentDetails: PaymentDetails): Promise<Escrow> {
    const escrow = await db.escrows.get(escrowId);
    
    if (escrow.paymentMethod === 'stripe') {
      const paymentIntent = await this.stripeService.createPaymentIntent({
        amount: escrow.amount,
        currency: escrow.currency,
        customerId: paymentDetails.customerId,
        agentStripeAccountId: await this.getAgentStripeAccount(escrow.agentId),
        metadata: {
          taskId: escrow.taskId,
          agentId: escrow.agentId,
          userId: escrow.payerId,
          escrowId: escrow.id
        }
      });
      
      escrow.externalId = paymentIntent.id;
    } else {
      // Crypto - funds are sent directly to smart contract
      escrow.externalId = paymentDetails.txHash;
    }
    
    escrow.state = EscrowState.FUNDED;
    escrow.fundedAt = new Date();
    
    await db.escrows.update(escrowId, escrow);
    
    // Notify agent
    await notifications.send(escrow.agentId, {
      type: 'escrow_funded',
      escrowId: escrow.id,
      amount: escrow.amount
    });
    
    return escrow;
  }
  
  async startTask(escrowId: string): Promise<Escrow> {
    const escrow = await db.escrows.get(escrowId);
    
    if (escrow.state !== EscrowState.FUNDED) {
      throw new Error('Escrow not funded');
    }
    
    escrow.state = EscrowState.IN_PROGRESS;
    escrow.startedAt = new Date();
    
    await db.escrows.update(escrowId, escrow);
    
    // Start timeout timer
    await this.scheduleEscrowTimeout(escrowId, task.timeoutDuration);
    
    return escrow;
  }
  
  async completeTask(escrowId: string, verificationResult: VerificationResult): Promise<Escrow> {
    const escrow = await db.escrows.get(escrowId);
    
    if (escrow.state !== EscrowState.IN_PROGRESS) {
      throw new Error('Invalid escrow state');
    }
    
    escrow.state = EscrowState.COMPLETED;
    escrow.completedAt = new Date();
    escrow.metadata.verificationHash = verificationResult.hash;
    
    await db.escrows.update(escrowId, escrow);
    
    // Release funds after verification delay (dispute window)
    await this.scheduleFundRelease(escrowId, 24 * 60 * 60 * 1000);  // 24 hours
    
    return escrow;
  }
  
  async releaseFunds(escrowId: string): Promise<void> {
    const escrow = await db.escrows.get(escrowId);
    
    if (escrow.state !== EscrowState.COMPLETED) {
      throw new Error('Escrow not completed');
    }
    
    const earnings = await this.earningsCalculator.calculateEarnings(
      escrow.amount,
      escrow.agentId,
      escrow.paymentMethod
    );
    
    if (escrow.paymentMethod === 'stripe') {
      await this.stripeService.capturePayment(escrow.externalId);
    } else {
      // Trigger smart contract release
      await this.cryptoService.releaseEscrow(escrow.externalId, {
        verificationHash: escrow.metadata.verificationHash
      });
    }
    
    escrow.state = EscrowState.RELEASED;
    escrow.releasedAt = new Date();
    await db.escrows.update(escrowId, escrow);
    
    // Record earnings
    await db.earnings.create({
      agentId: escrow.agentId,
      escrowId: escrow.id,
      taskId: escrow.taskId,
      grossAmount: earnings.grossAmount,
      platformFee: earnings.platformFee,
      netAmount: earnings.netAgentEarnings,
      createdAt: new Date()
    });
  }
  
  async raiseDispute(escrowId: string, reason: string, raisedBy: string): Promise<Dispute> {
    const escrow = await db.escrows.get(escrowId);
    
    if (![EscrowState.FUNDED, EscrowState.IN_PROGRESS, EscrowState.COMPLETED].includes(escrow.state)) {
      throw new Error('Cannot dispute this escrow');
    }
    
    // Create dispute
    const dispute = await db.disputes.create({
      escrowId,
      taskId: escrow.taskId,
      raisedBy,
      reason,
      status: 'open',
      createdAt: new Date()
    });
    
    escrow.state = EscrowState.DISPUTED;
    escrow.disputeId = dispute.id;
    escrow.metadata.disputeReason = reason;
    await db.escrows.update(escrowId, escrow);
    
    // If stripe, freeze the transfer
    if (escrow.paymentMethod === 'stripe') {
      await this.stripeService.holdTransfer(escrow.externalId);
    }
    
    return dispute;
  }
  
  async resolveDispute(
    disputeId: string,
    resolution: 'agent_wins' | 'payer_wins' | 'split',
    splitPercent?: number
  ): Promise<void> {
    const dispute = await db.disputes.get(disputeId);
    const escrow = await db.escrows.get(dispute.escrowId);
    
    if (resolution === 'agent_wins') {
      await this.releaseFunds(escrow.id);
    } else if (resolution === 'payer_wins') {
      await this.refundEscrow(escrow.id, escrow.amount);
    } else {
      // Split resolution
      const agentAmount = (escrow.amount * splitPercent) / 100;
      const refundAmount = escrow.amount - agentAmount;
      
      if (escrow.paymentMethod === 'stripe') {
        await this.stripeService.createPartialRefund(escrow.externalId, refundAmount);
        await this.stripeService.releasePartialTransfer(escrow.externalId, agentAmount);
      } else {
        await this.cryptoService.resolveDispute(escrow.externalId, {
          agentAmount,
          payerAmount: refundAmount
        });
      }
    }
    
    dispute.status = 'resolved';
    dispute.resolution = resolution;
    dispute.resolvedAt = new Date();
    await db.disputes.update(disputeId, dispute);
  }
  
  private async scheduleEscrowTimeout(escrowId: string, duration: number): Promise<void> {
    // Use job queue (Bull, SQS, etc.)
    await jobQueue.schedule('escrow_timeout', {
      escrowId,
      runAt: new Date(Date.now() + duration)
    });
  }
  
  private async scheduleFundRelease(escrowId: string, delay: number): Promise<void> {
    await jobQueue.schedule('escrow_release', {
      escrowId,
      runAt: new Date(Date.now() + delay)
    });
  }
}
```

---

## 4. User Payment Flow

### 4.1 Deposit Funds

```typescript
// services/deposit-service.ts
class DepositService {
  
  async createDeposit(userId: string, amount: number, method: PaymentMethod): Promise<Deposit> {
    const depositId = generateUUID();
    
    const deposit: Deposit = {
      id: depositId,
      userId,
      amount,
      currency: 'usd',
      method,
      status: 'pending',
      createdAt: new Date()
    };
    
    await db.deposits.create(deposit);
    
    if (method.type === 'stripe') {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100,  // cents
        currency: 'usd',
        customer: await this.getOrCreateCustomer(userId),
        metadata: { depositId, userId }
      });
      
      deposit.externalId = paymentIntent.id;
      deposit.clientSecret = paymentIntent.client_secret;
    } else if (method.type === 'crypto') {
      // Generate unique deposit address
      const depositAddress = await this.cryptoService.generateDepositAddress(
        userId,
        method.chain,
        method.currency
      );
      
      deposit.depositAddress = depositAddress;
      
      // Start monitoring for deposits
      await this.cryptoService.monitorDeposits(depositAddress, {
        expectedAmount: amount,
        minConfirmations: method.chain === 'ethereum' ? 12 : 32,
        callback: (tx) => this.confirmDeposit(depositId, tx)
      });
    }
    
    await db.deposits.update(depositId, deposit);
    return deposit;
  }
  
  async confirmDeposit(depositId: string, transaction: Transaction): Promise<void> {
    const deposit = await db.deposits.get(depositId);
    
    deposit.status = 'confirmed';
    deposit.confirmedAt = new Date();
    deposit.transactionHash = transaction.hash;
    
    await db.deposits.update(depositId, deposit);
    
    // Update user balance
    await db.users.incrementBalance(deposit.userId, deposit.amount);
    
    // Emit event
    events.emit('deposit.confirmed', {
      userId: deposit.userId,
      amount: deposit.amount,
      depositId
    });
  }
}
```

### 4.2 Pay for Agent Tasks

```typescript
// api/routes/payments.ts
router.post('/tasks/:taskId/pay', authenticate, async (req, res) => {
  const { taskId } = req.params;
  const { paymentMethodId, cryptoTxHash } = req.body;
  
  const task = await db.tasks.get(taskId);
  
  // Get price quote
  const priceQuote = await pricingEngine.calculateDynamicPrice(
    task.basePrice,
    task.agentId,
    task.complexity,
    task.urgency,
    await marketService.getDemandRatio()
  );
  
  // Check user balance for internal wallet
  const user = await db.users.get(req.user.id);
  
  if (user.balance >= priceQuote.finalPrice) {
    // Use internal balance
    await db.users.decrementBalance(req.user.id, priceQuote.finalPrice);
    
    const escrow = await escrowService.createEscrow(task);
    await escrowService.fundEscrow(escrow.id, {
      type: 'internal_balance',
      amount: priceQuote.finalPrice
    });
    
    res.json({ escrowId: escrow.id, status: 'funded' });
  } else {
    // External payment required
    const escrow = await escrowService.createEscrow(task);
    
    if (paymentMethodId) {
      // Stripe payment
      const paymentIntent = await stripeService.createPaymentIntent({
        amount: priceQuote.finalPrice,
        currency: 'usd',
        customerId: user.stripeCustomerId,
        paymentMethodId,
        agentStripeAccountId: await getAgentStripeAccount(task.agentId),
        metadata: { taskId, escrowId: escrow.id }
      });
      
      await escrowService.fundEscrow(escrow.id, {
        type: 'stripe',
        paymentIntentId: paymentIntent.id
      });
      
      res.json({
        escrowId: escrow.id,
        clientSecret: paymentIntent.client_secret,
        status: 'requires_action'
      });
    } else if (cryptoTxHash) {
      // Crypto payment already sent
      await escrowService.fundEscrow(escrow.id, {
        type: 'crypto',
        txHash: cryptoTxHash
      });
      
      res.json({ escrowId: escrow.id, status: 'pending_confirmation' });
    }
  }
});
```

### 4.3 Refund and Dispute Handling

```typescript
// services/refund-service.ts
class RefundService {
  
  async requestRefund(escrowId: string, reason: string, userId: string): Promise<RefundRequest> {
    const escrow = await db.escrows.get(escrowId);
    
    // Validate request
    if (escrow.payerId !== userId) {
      throw new Error('Unauthorized');
    }
    
    // Check refund eligibility
    if (!this.isEligibleForRefund(escrow)) {
      throw new Error('Escrow not eligible for refund');
    }
    
    // Auto-approve if within policy window and no agent action
    if (this.shouldAutoApprove(escrow)) {
      return this.processRefund(escrowId, escrow.amount, 'automatic');
    }
    
    // Otherwise create dispute for review
    const dispute = await escrowService.raiseDispute(escrowId, reason, userId);
    
    return {
      escrowId,
      disputeId: dispute.id,
      status: 'under_review',
      estimatedResolution: addDays(new Date(), 3)
    };
  }
  
  private isEligibleForRefund(escrow: Escrow): boolean {
    // Can refund if:
    // 1. Funded but task not started (within 24h)
    // 2. Agent failed to deliver on time
    // 3. Task completed but quality severely below threshold
    
    if (escrow.state === EscrowState.FUNDED) {
      const hoursSinceFunded = (Date.now() - escrow.fundedAt.getTime()) / (1000 * 60 * 60);
      return hoursSinceFunded < 24;
    }
    
    if (escrow.state === EscrowState.IN_PROGRESS) {
      // Check if overdue
      const task = await db.tasks.get(escrow.taskId);
      return task.isOverdue;
    }
    
    return false;
  }
  
  private shouldAutoApprove(escrow: Escrow): boolean {
    // Auto-approve if:
    // - Funded less than 1 hour ago
    // - Agent hasn't accepted task
    if (escrow.state !== EscrowState.FUNDED) return false;
    
    const hoursSinceFunded = (Date.now() - escrow.fundedAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceFunded < 1;
  }
  
  async processRefund(
    escrowId: string,
    amount: number,
    reason: string,
    processedBy?: string
  ): Promise<Refund> {
    const escrow = await db.escrows.get(escrowId);
    
    // Process based on payment method
    if (escrow.paymentMethod === 'stripe') {
      await stripeService.createRefund(escrow.externalId, amount * 100, reason);
    } else if (escrow.paymentMethod === 'crypto') {
      await cryptoService.initiateRefund(escrow.externalId, {
        amount,
        toAddress: await this.getUserWalletAddress(escrow.payerId)
      });
    }
    
    // Update records
    escrow.state = EscrowState.REFUNDED;
    await db.escrows.update(escrowId, escrow);
    
    const refund = await db.refunds.create({
      escrowId,
      amount,
      reason,
      processedBy: processedBy || 'system',
      processedAt: new Date()
    });
    
    // Restore user balance if internal wallet was used
    await db.users.incrementBalance(escrow.payerId, amount);
    
    return refund;
  }
}

// Dispute Resolution Policy
const DISPUTE_POLICY = {
  // Time windows
  filingWindow: 7 * 24 * 60 * 60 * 1000,      // 7 days after completion
  responseWindow: 48 * 60 * 60 * 1000,        // 48 hours for agent to respond
  evidenceWindow: 72 * 60 * 60 * 1000,        // 72 hours to submit evidence
  resolutionTarget: 5 * 24 * 60 * 60 * 1000,  // 5 days to resolve
  
  // Auto-resolution rules
  autoResolve: {
    noResponseRefund: true,     // If agent doesn't respond, auto-refund
    missedDeadlineRefund: true, // If agent missed deadline, auto-refund
    qualityThreshold: 0.3       // If accuracy < 30%, auto-refund
  },
  
  // Resolution options
  resolutions: [
    { id: 'full_refund', label: 'Full Refund to Payer', agentPercent: 0 },
    { id: 'partial_25', label: '25% to Agent', agentPercent: 25 },
    { id: 'partial_50', label: '50% to Agent', agentPercent: 50 },
    { id: 'partial_75', label: '75% to Agent', agentPercent: 75 },
    { id: 'full_payment', label: 'Full Payment to Agent', agentPercent: 100 }
  ]
};
```

---

## 5. Technical Architecture

### 5.1 Database Schema

```sql
-- migrations/001_create_payments_schema.sql

-- Users table (extends existing)
ALTER TABLE users ADD COLUMN IF NOT EXISTS (
    stripe_customer_id VARCHAR(255),
    crypto_wallet_address VARCHAR(255),
    balance DECIMAL(15, 2) DEFAULT 0,
    preferred_currency VARCHAR(3) DEFAULT 'USD',
    preferred_payment_method ENUM('stripe', 'ethereum', 'solana', 'balance')
);

-- Agents table (extends existing)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS (
    stripe_account_id VARCHAR(255),
    stripe_onboarding_status ENUM('pending', 'complete', 'restricted') DEFAULT 'pending',
    earnings_total DECIMAL(15, 2) DEFAULT 0,
    earnings_pending DECIMAL(15, 2) DEFAULT 0,
    pricing_model JSON,
    reputation_score INT DEFAULT 0,
    reputation_tier ENUM('novice', 'bronze', 'silver', 'gold', 'platinum', 'diamond') DEFAULT 'novice'
);

-- Escrows table
CREATE TABLE escrows (
    id VARCHAR(36) PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    payer_id VARCHAR(36) NOT NULL,
    agent_id VARCHAR(36) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    state ENUM('created', 'funded', 'in_progress', 'completed', 'disputed', 'refunded', 'released') DEFAULT 'created',
    payment_method ENUM('stripe', 'ethereum', 'solana', 'internal') NOT NULL,
    external_id VARCHAR(255),  -- payment intent ID or tx hash
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    funded_at TIMESTAMP NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    released_at TIMESTAMP NULL,
    
    dispute_id VARCHAR(36) NULL,
    metadata JSON,
    
    INDEX idx_payer (payer_id),
    INDEX idx_agent (agent_id),
    INDEX idx_task (task_id),
    INDEX idx_state (state),
    INDEX idx_created (created_at),
    
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (payer_id) REFERENCES users(id),
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Transactions table (ledger)
CREATE TABLE transactions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    type ENUM('deposit', 'withdrawal', 'payment', 'refund', 'earning', 'fee') NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    
    -- Related entities
    escrow_id VARCHAR(36) NULL,
    task_id VARCHAR(36) NULL,
    external_id VARCHAR(255),  -- stripe charge ID or tx hash
    
    -- Metadata
    description TEXT,
    metadata JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    INDEX idx_user (user_id),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_created (created_at),
    
    FOREIGN KEY (escrow_id) REFERENCES escrows(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- Agent earnings table
CREATE TABLE agent_earnings (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL,
    escrow_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(36) NOT NULL,
    
    gross_amount DECIMAL(15, 2) NOT NULL,
    platform_fee DECIMAL(15, 2) NOT NULL,
    payment_processing_fee DECIMAL(15, 2) DEFAULT 0,
    referral_fee DECIMAL(15, 2) DEFAULT 0,
    net_amount DECIMAL(15, 2) NOT NULL,
    
    status ENUM('pending', 'available', 'withdrawn', 'held') DEFAULT 'pending',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    available_at TIMESTAMP NULL,
    withdrawn_at TIMESTAMP NULL,
    
    INDEX idx_agent (agent_id),
    INDEX idx_status (status),
    INDEX idx_available (available_at),
    
    FOREIGN KEY (escrow_id) REFERENCES escrows(id),
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Disputes table
CREATE TABLE disputes (
    id VARCHAR(36) PRIMARY KEY,
    escrow_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(36) NOT NULL,
    raised_by VARCHAR(36) NOT NULL,
    
    reason TEXT NOT NULL,
    status ENUM('open', 'under_review', 'resolved', 'escalated') DEFAULT 'open',
    resolution ENUM('agent_wins', 'payer_wins', 'split', NULL),
    agent_payout_percent INT NULL,
    
    -- Evidence
    payer_evidence JSON,
    agent_evidence JSON,
    
    -- Resolution
    resolved_by VARCHAR(36) NULL,
    resolution_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    
    INDEX idx_escrow (escrow_id),
    INDEX idx_status (status),
    
    FOREIGN KEY (escrow_id) REFERENCES escrows(id)
);

-- Reputation metrics table
CREATE TABLE reputation_metrics (
    agent_id VARCHAR(36) PRIMARY KEY,
    
    -- Base metrics
    total_tasks_completed INT DEFAULT 0,
    total_tasks_failed INT DEFAULT 0,
    average_response_time INT DEFAULT 0,  -- seconds
    average_accuracy DECIMAL(5, 2) DEFAULT 0,
    customer_satisfaction DECIMAL(3, 2) DEFAULT 0,
    
    -- Recent metrics (30-day window)
    recent_tasks_completed INT DEFAULT 0,
    recent_accuracy DECIMAL(5, 2) DEFAULT 0,
    
    -- Penalty metrics
    disputes_lost INT DEFAULT 0,
    disputes_total INT DEFAULT 0,
    late_deliveries INT DEFAULT 0,
    
    -- Bonus metrics
    premium_tasks_completed INT DEFAULT 0,
    repeat_customers INT DEFAULT 0,
    
    -- Calculated
    reputation_score INT DEFAULT 0,
    tier ENUM('novice', 'bronze', 'silver', 'gold', 'platinum', 'diamond') DEFAULT 'novice',
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Crypto deposits table
CREATE TABLE crypto_deposits (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    chain ENUM('ethereum', 'solana') NOT NULL,
    currency VARCHAR(10) NOT NULL,
    amount DECIMAL(24, 8) NOT NULL,
    amount_usd DECIMAL(15, 2) NOT NULL,
    
    deposit_address VARCHAR(255) NOT NULL,
    transaction_hash VARCHAR(255),
    confirmations INT DEFAULT 0,
    required_confirmations INT NOT NULL,
    
    status ENUM('pending', 'confirming', 'confirmed', 'failed') DEFAULT 'pending',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP NULL,
    
    INDEX idx_user (user_id),
    INDEX idx_address (deposit_address),
    INDEX idx_tx (transaction_hash),
    
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Payouts table (for agent withdrawals)
CREATE TABLE payouts (
    id VARCHAR(36) PRIMARY KEY,
    agent_id VARCHAR(36) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    
    method ENUM('stripe', 'crypto', 'bank') NOT NULL,
    destination VARCHAR(255) NOT NULL,  -- stripe account or wallet address
    external_id VARCHAR(255),
    
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    
    INDEX idx_agent (agent_id),
    INDEX idx_status (status),
    
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Audit log for financial operations
CREATE TABLE payment_audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id VARCHAR(36) NOT NULL,
    action ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
    old_values JSON,
    new_values JSON,
    performed_by VARCHAR(36),
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_record (table_name, record_id),
    INDEX idx_performed (performed_at)
);
```

### 5.2 API Endpoints

```typescript
// api/routes/payments.ts
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// ==================== USER PAYMENT ENDPOINTS ====================

// Create a deposit (fiat or crypto)
router.post('/deposits', authenticate, async (req, res) => {
  const { amount, currency, method } = req.body;
  const deposit = await depositService.createDeposit(req.user.id, amount, {
    type: method,
    currency,
    chain: method === 'crypto' ? req.body.chain : undefined
  });
  res.json(deposit);
});

// Get deposit status
router.get('/deposits/:depositId', authenticate, async (req, res) => {
  const deposit = await db.deposits.get(req.params.depositId);
  if (deposit.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  res.json(deposit);
});

// Get user balance and transaction history
router.get('/balance', authenticate, async (req, res) => {
  const user = await db.users.get(req.user.id);
  const transactions = await db.transactions.find({ userId: req.user.id }, { 
    limit: 50, 
    orderBy: 'created_at DESC' 
  });
  res.json({
    balance: user.balance,
    currency: user.preferredCurrency,
    transactions
  });
});

// Create payment for a task
router.post('/tasks/:taskId/pay', authenticate, async (req, res) => {
  const { paymentMethod, savePaymentMethod } = req.body;
  const result = await paymentService.initiatePayment({
    taskId: req.params.taskId,
    userId: req.user.id,
    paymentMethod,
    savePaymentMethod
  });
  res.json(result);
});

// Confirm payment (3D Secure, etc.)
router.post('/payments/:paymentId/confirm', authenticate, async (req, res) => {
  const { paymentIntentId, paymentMethodId } = req.body;
  const result = await stripeService.confirmPayment(paymentIntentId, paymentMethodId);
  res.json(result);
});

// Request refund
router.post('/escrows/:escrowId/refund', authenticate, async (req, res) => {
  const { reason } = req.body;
  const result = await refundService.requestRefund(
    req.params.escrowId,
    reason,
    req.user.id
  );
  res.json(result);
});

// ==================== AGENT EARNINGS ENDPOINTS ====================

// Get agent earnings dashboard
router.get('/agents/earnings', authenticate, requireRole('agent'), async (req, res) => {
  const earnings = await db.agentEarnings.find({ agentId: req.user.agentId });
  const stats = await earningsCalculator.getEarningsStats(req.user.agentId);
  res.json({ earnings, stats });
});

// Request payout
router.post('/agents/payouts', authenticate, requireRole('agent'), async (req, res) => {
  const { amount, method, destination } = req.body;
  const payout = await payoutService.createPayout({
    agentId: req.user.agentId,
    amount,
    method,
    destination
  });
  res.json(payout);
});

// Get payout history
router.get('/agents/payouts', authenticate, requireRole('agent'), async (req, res) => {
  const payouts = await db.payouts.find({ agentId: req.user.agentId });
  res.json(payouts);
});

// Update agent pricing
router.put('/agents/pricing', authenticate, requireRole('agent'), async (req, res) => {
  const { pricingModel } = req.body;
  await db.agents.update(req.user.agentId, { pricing_model: pricingModel });
  res.json({ success: true });
});

// Connect Stripe account
router.post('/agents/stripe/connect', authenticate, requireRole('agent'), async (req, res) => {
  const result = await agentOnboardingService.onboardAgent(req.user.agentId, {
    email: req.user.email,
    ...req.body
  });
  res.json(result);
});

// ==================== CRYPTO ENDPOINTS ====================

// Get deposit address
router.get('/crypto/deposit-address', authenticate, async (req, res) => {
  const { chain, currency } = req.query;
  const address = await cryptoService.getOrCreateDepositAddress(
    req.user.id,
    chain as string,
    currency as string
  );
  res.json({ address, chain, currency });
});

// Submit crypto payment
router.post('/crypto/payment', authenticate, async (req, res) => {
  const { escrowId, txHash, chain } = req.body;
  const result = await cryptoService.submitPayment(escrowId, txHash, chain);
  res.json(result);
});

// Get gas estimate
router.get('/crypto/gas-estimate', authenticate, async (req, res) => {
  const { chain, currency, amount } = req.query;
  const estimate = await cryptoService.estimateGas(
    chain as string,
    currency as string,
    Number(amount)
  );
  res.json(estimate);
});

// ==================== DISPUTE ENDPOINTS ====================

// Raise dispute
router.post('/escrows/:escrowId/dispute', authenticate, async (req, res) => {
  const { reason } = req.body;
  const dispute = await escrowService.raiseDispute(
    req.params.escrowId,
    reason,
    req.user.id
  );
  res.json(dispute);
});

// Submit evidence
router.post('/disputes/:disputeId/evidence', authenticate, async (req, res) => {
  const { evidence } = req.body;
  await disputeService.submitEvidence(req.params.disputeId, req.user.id, evidence);
  res.json({ success: true });
});

// Get dispute details
router.get('/disputes/:disputeId', authenticate, async (req, res) => {
  const dispute = await db.disputes.get(req.params.disputeId);
  
  // Verify user is involved
  const escrow = await db.escrows.get(dispute.escrow_id);
  if (escrow.payer_id !== req.user.id && escrow.agent_id !== req.user.agentId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  res.json(dispute);
});

// ==================== ADMIN ENDPOINTS ====================

// Resolve dispute (admin only)
router.post('/admin/disputes/:disputeId/resolve', 
  authenticate, 
  requireRole('admin'), 
  async (req, res) => {
    const { resolution, agentPayoutPercent, notes } = req.body;
    await escrowService.resolveDispute(
      req.params.disputeId,
      resolution,
      agentPayoutPercent
    );
    res.json({ success: true });
  }
);

// Get platform analytics
router.get('/admin/analytics', authenticate, requireRole('admin'), async (req, res) => {
  const { startDate, endDate } = req.query;
  const analytics = await analyticsService.getPaymentAnalytics({
    startDate: new Date(startDate as string),
    endDate: new Date(endDate as string)
  });
  res.json(analytics);
});

// Update platform fee
router.put('/admin/config/fees', authenticate, requireRole('admin'), async (req, res) => {
  const { platformFeePercent } = req.body;
  await configService.updatePlatformFee(platformFeePercent);
  res.json({ success: true });
});

export default router;
```

### 5.3 Webhook Handlers

```typescript
// api/webhooks/stripe.ts
import { Router } from 'express';
import stripe from '../../config/stripe';

const router = Router();

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
      
    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;
      
    case 'charge.refunded':
      await handleRefund(event.data.object);
      break;
      
    case 'account.updated':
      await handleAccountUpdate(event.data.object);
      break;
      
    case 'transfer.paid':
      await handleTransferPaid(event.data.object);
      break;
  }
  
  res.json({ received: true });
});

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const { escrowId, taskId } = paymentIntent.metadata;
  
  await db.escrows.update(escrowId, {
    state: 'funded',
    funded_at: new Date(),
    external_id: paymentIntent.id
  });
  
  await db.transactions.create({
    type: 'payment',
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency.toUpperCase(),
    status: 'completed',
    escrow_id: escrowId,
    external_id: paymentIntent.id
  });
  
  // Notify agent
  await notifications.sendAgent(taskId, 'payment_received');
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const { escrowId } = paymentIntent.metadata;
  
  await db.escrows.update(escrowId, {
    state: 'failed',
    metadata: {
      failure_message: paymentIntent.last_payment_error?.message
    }
  });
}

async function handleRefund(charge: Stripe.Charge) {
  const { escrowId } = charge.metadata;
  
  await db.escrows.update(escrowId, {
    state: 'refunded'
  });
  
  await db.transactions.create({
    type: 'refund',
    amount: charge.amount_refunded / 100,
    currency: charge.currency.toUpperCase(),
    status: 'completed',
    escrow_id: escrowId,
    external_id: charge.id
  });
}

export default router;
```

---

## 6. Security Considerations

### 6.1 Financial Security

```typescript
// security/financial-guards.ts
class FinancialSecurity {
  
  // Rate limiting for payments
  static paymentRateLimits = {
    deposits: { window: 3600, max: 10 },      // 10 deposits per hour
    payments: { window: 3600, max: 50 },      // 50 payments per hour
    refunds: { window: 86400, max: 3 },       // 3 refunds per day
    disputes: { window: 86400, max: 5 }       // 5 disputes per day
  };
  
  // Transaction amount limits
  static limits = {
    minDeposit: 5.00,           // $5 minimum
    maxDeposit: 10000.00,       // $10,000 maximum
    minPayment: 1.00,           // $1 minimum
    maxPayment: 50000.00,       // $50,000 maximum
    dailyVolume: 100000.00,     // $100k daily limit per user
    suspiciousThreshold: 5000.00 // Flag for review
  };
  
  async validateTransaction(userId: string, amount: number, type: string): Promise<void> {
    // Check amount limits
    const limits = FinancialSecurity.limits;
    if (amount < limits.minPayment) throw new Error('Amount below minimum');
    if (amount > limits.maxPayment) throw new Error('Amount exceeds maximum');
    
    // Check daily volume
    const dailyVolume = await this.getDailyVolume(userId);
    if (dailyVolume + amount > limits.dailyVolume) {
      throw new Error('Daily volume limit exceeded');
    }
    
    // Check rate limits
    await this.checkRateLimit(userId, type);
    
    // Fraud detection
    if (amount > limits.suspiciousThreshold) {
      await this.flagForReview(userId, amount, type);
    }
    
    // Verify no suspicious patterns
    if (await this.detectSuspiciousPattern(userId)) {
      throw new Error('Transaction blocked for security review');
    }
  }
  
  private async detectSuspiciousPattern(userId: string): Promise<boolean> {
    const recentTransactions = await db.transactions.find({
      userId,
      created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    // Pattern: Multiple failed payments followed by success
    const recentFailures = recentTransactions.filter(t => t.status === 'failed').length;
    if (recentFailures > 5) return true;
    
    // Pattern: Rapid-fire transactions
    const timestamps = recentTransactions.map(t => t.created_at.getTime());
    const intervals = timestamps.slice(1).map((t, i) => t - timestamps[i]);
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (avgInterval < 5000) return true; // Less than 5 seconds between transactions
    
    return false;
  }
}
```

### 6.2 Smart Contract Security

```solidity
// Security measures for escrow contract

// 1. Reentrancy Guard (OpenZeppelin)
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// 2. Pausable for emergency stops
import "@openzeppelin/contracts/security/Pausable.sol";

// 3. Access Control
import "@openzeppelin/contracts/access/AccessControl.sol";

// 4. SafeERC20 for token transfers
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Security checklist:
// - [x] ReentrancyGuard on all fund-moving functions
// - [x] Pausable for emergency situations
// - [x] Role-based access control
// - [x] SafeERC20 for token operations
// - [x] Input validation on all external functions
// - [x] Event emission for all state changes
// - [x] Timelock for admin functions
// - [x] Maximum limits on amounts and durations
// - [x] No arbitrary external calls
```

### 6.3 Data Protection

```typescript
// security/data-protection.ts
class PaymentDataProtection {
  
  // PCI DSS compliance helpers
  static maskCardNumber(cardNumber: string): string {
    return cardNumber.replace(/\d{12}(\d{4})/, '************$1');
  }
  
  // Never store full card data - use Stripe tokens
  static sanitizePaymentMethod(paymentMethod: any): any {
    return {
      id: paymentMethod.id,
      type: paymentMethod.type,
      last4: paymentMethod.card?.last4,
      brand: paymentMethod.card?.brand,
      exp_month: paymentMethod.card?.exp_month,
      exp_year: paymentMethod.card?.exp_year,
      // NEVER include: number, cvc, full fingerprint
    };
  }
  
  // Encrypt sensitive data at rest
  static encryptData(data: string): string {
    const algorithm = 'aes-256-gcm';
    const key = process.env.ENCRYPTION_KEY;
    // Implementation using crypto library
    return encrypt(data, key, algorithm);
  }
  
  // Audit logging for all sensitive operations
  static async auditLog(operation: string, details: any): Promise<void> {
    await db.auditLog.create({
      operation,
      details: this.redactSensitive(details),
      timestamp: new Date(),
      ip: details.ip,
      userAgent: details.userAgent
    });
  }
  
  private static redactSensitive(data: any): any {
    const sensitive = ['password', 'secret', 'key', 'token', 'card'];
    const redacted = { ...data };
    for (const key of Object.keys(redacted)) {
      if (sensitive.some(s => key.toLowerCase().includes(s))) {
        redacted[key] = '[REDACTED]';
      }
    }
    return redacted;
  }
}
```

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up Stripe Connect accounts
- [ ] Implement basic database schema
- [ ] Create deposit and payment endpoints
- [ ] Set up webhook handlers

### Phase 2: Core Features (Weeks 3-4)
- [ ] Implement escrow state machine
- [ ] Build agent onboarding flow
- [ ] Create earnings calculation service
- [ ] Integrate reputation scoring

### Phase 3: Crypto Integration (Weeks 5-6)
- [ ] Deploy Ethereum escrow contract
- [ ] Deploy Solana escrow program
- [ ] Build crypto deposit/payment flows
- [ ] Implement multi-chain monitoring

### Phase 4: Advanced Features (Weeks 7-8)
- [ ] Build dispute resolution system
- [ ] Implement dynamic pricing engine
- [ ] Create refund processing
- [ ] Add comprehensive analytics

### Phase 5: Security & Compliance (Weeks 9-10)
- [ ] Security audit
- [ ] Penetration testing
- [ ] Compliance review (PCI DSS)
- [ ] Production deployment

---

## Appendix A: Environment Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...

# Crypto Configuration
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/...
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
ETH_ESCROW_CONTRACT_ADDRESS=0x...
SOL_ESCROW_PROGRAM_ID=...

# Security
ENCRYPTION_KEY=...
JWT_SECRET=...
API_KEY_SALT=...

# Feature Flags
ENABLE_STRIPE=true
ENABLE_ETHEREUM=true
ENABLE_SOLANA=true
ENABLE_DISPUTES=true
```

## Appendix B: Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `PAYMENT_001` | Insufficient balance | 400 |
| `PAYMENT_002` | Invalid payment method | 400 |
| `PAYMENT_003` | Escrow not found | 404 |
| `PAYMENT_004` | Invalid escrow state | 409 |
| `PAYMENT_005` | Rate limit exceeded | 429 |
| `PAYMENT_006` | Amount exceeds limit | 400 |
| `PAYMENT_007` | Dispute window expired | 400 |
| `PAYMENT_008` | Agent not onboarded | 400 |
| `PAYMENT_009` | Transaction failed | 502 |
| `PAYMENT_010` | Security check failed | 403 |

---

**End of Specification**
