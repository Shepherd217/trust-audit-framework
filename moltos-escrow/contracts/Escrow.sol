// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Escrow
 * @author MoltOS
 * @notice A secure escrow contract for ETH and ERC20 tokens
 * @dev Implements comprehensive escrow functionality with dispute resolution
 */
contract Escrow is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // ============ Enums ============
    
    enum EscrowStatus {
        Pending,      // Waiting for funding
        Funded,       // Escrow has been funded
        Active,       // Work in progress
        Completed,    // Funds released to agent
        Refunded,     // Funds returned to payer
        Disputed,     // Under dispute resolution
        Resolved      // Dispute resolved
    }

    enum PaymentType {
        ETH,
        ERC20
    }

    // ============ Structs ============
    
    struct EscrowData {
        address payer;           // Who pays into escrow
        address agent;           // Who performs the work
        address arbiter;         // Arbiter contract for disputes
        uint256 amount;          // Escrow amount
        uint256 deadline;        // Timestamp when escrow expires
        uint256 createdAt;       // When escrow was created
        EscrowStatus status;     // Current status
        PaymentType paymentType; // ETH or ERC20
        address token;           // Token address (address(0) for ETH)
        bytes32 metadata;        // IPFS hash or reference data
        uint256 feeBasisPoints;  // Platform fee in basis points (1% = 100)
    }

    // ============ State Variables ============
    
    EscrowData public escrow;
    address public factory;
    address public feeRecipient;
    
    // Resolution data for disputes
    struct Resolution {
        uint256 payerAmount;
        uint256 agentAmount;
        uint256 feeAmount;
        bool executed;
        uint256 resolutionTime;
    }
    
    Resolution public resolution;

    // ============ Events ============
    
    event EscrowCreated(
        address indexed payer,
        address indexed agent,
        uint256 amount,
        uint256 deadline,
        PaymentType paymentType,
        address token
    );
    
    event EscrowFunded(
        address indexed funder,
        uint256 amount,
        uint256 timestamp
    );
    
    event FundsReleased(
        address indexed agent,
        uint256 amount,
        uint256 fee,
        uint256 timestamp
    );
    
    event FundsRefunded(
        address indexed payer,
        uint256 amount,
        uint256 timestamp
    );
    
    event DisputeOpened(
        address indexed openedBy,
        uint256 timestamp,
        string reason
    );
    
    event DisputeResolved(
        uint256 payerAmount,
        uint256 agentAmount,
        uint256 feeAmount,
        uint256 timestamp
    );
    
    event DeadlineExtended(
        uint256 oldDeadline,
        uint256 newDeadline
    );
    
    event StatusChanged(
        EscrowStatus oldStatus,
        EscrowStatus newStatus
    );

    // ============ Modifiers ============
    
    modifier onlyPayer() {
        require(msg.sender == escrow.payer, "Escrow: caller is not payer");
        _;
    }
    
    modifier onlyAgent() {
        require(msg.sender == escrow.agent, "Escrow: caller is not agent");
        _;
    }
    
    modifier onlyPayerOrAgent() {
        require(
            msg.sender == escrow.payer || msg.sender == escrow.agent,
            "Escrow: caller is not payer or agent"
        );
        _;
    }
    
    modifier onlyArbiter() {
        require(msg.sender == escrow.arbiter, "Escrow: caller is not arbiter");
        _;
    }
    
    modifier onlyFactory() {
        require(msg.sender == factory, "Escrow: caller is not factory");
        _;
    }
    
    modifier inStatus(EscrowStatus _status) {
        require(escrow.status == _status, "Escrow: invalid status");
        _;
    }
    
    modifier notExpired() {
        require(block.timestamp < escrow.deadline, "Escrow: deadline passed");
        _;
    }
    
    modifier expired() {
        require(block.timestamp >= escrow.deadline, "Escrow: deadline not passed");
        _;
    }

    // ============ Constructor ============
    
    /**
     * @notice Initializes the escrow contract
     * @param _payer Address that will fund the escrow
     * @param _agent Address that will perform the work
     * @param _arbiter Address of the arbiter contract
     * @param _amount Amount to be held in escrow
     * @param _deadline Timestamp when escrow expires
     * @param _paymentType Type of payment (ETH or ERC20)
     * @param _token Token address (address(0) for ETH)
     * @param _metadata IPFS hash or reference data
     * @param _feeRecipient Address to receive platform fees
     * @param _feeBasisPoints Platform fee in basis points
     */
    constructor(
        address _payer,
        address _agent,
        address _arbiter,
        uint256 _amount,
        uint256 _deadline,
        PaymentType _paymentType,
        address _token,
        bytes32 _metadata,
        address _feeRecipient,
        uint256 _feeBasisPoints
    ) Ownable(_payer) {
        require(_payer != address(0), "Escrow: invalid payer");
        require(_agent != address(0), "Escrow: invalid agent");
        require(_arbiter != address(0), "Escrow: invalid arbiter");
        require(_amount > 0, "Escrow: amount must be > 0");
        require(_deadline > block.timestamp, "Escrow: deadline must be future");
        require(_feeBasisPoints <= 1000, "Escrow: fee too high (max 10%)");
        
        if (_paymentType == PaymentType.ERC20) {
            require(_token != address(0), "Escrow: invalid token address");
        }

        factory = msg.sender;
        feeRecipient = _feeRecipient;
        
        escrow = EscrowData({
            payer: _payer,
            agent: _agent,
            arbiter: _arbiter,
            amount: _amount,
            deadline: _deadline,
            createdAt: block.timestamp,
            status: EscrowStatus.Pending,
            paymentType: _paymentType,
            token: _token,
            metadata: _metadata,
            feeBasisPoints: _feeBasisPoints
        });

        emit EscrowCreated(
            _payer,
            _agent,
            _amount,
            _deadline,
            _paymentType,
            _token
        );
    }

    // ============ Receive & Fallback ============
    
    receive() external payable {
        // Only accept ETH if payment type is ETH and status is Pending
        if (escrow.paymentType == PaymentType.ETH && escrow.status == EscrowStatus.Pending) {
            // Handle funding via receive
        } else {
            revert("Escrow: direct deposits not allowed");
        }
    }

    // ============ External Functions ============
    
    /**
     * @notice Fund the escrow with ETH
     * @dev Only callable by payer when status is Pending
     */
    function fundWithETH() external payable onlyPayer inStatus(EscrowStatus.Pending) nonReentrant {
        require(escrow.paymentType == PaymentType.ETH, "Escrow: not ETH escrow");
        require(msg.value == escrow.amount, "Escrow: incorrect amount");
        
        escrow.status = EscrowStatus.Funded;
        emit EscrowFunded(msg.sender, msg.value, block.timestamp);
        emit StatusChanged(EscrowStatus.Pending, EscrowStatus.Funded);
    }

    /**
     * @notice Fund the escrow with ERC20 tokens
     * @dev Only callable by payer when status is Pending
     */
    function fundWithToken() external onlyPayer inStatus(EscrowStatus.Pending) nonReentrant {
        require(escrow.paymentType == PaymentType.ERC20, "Escrow: not token escrow");
        
        IERC20 token = IERC20(escrow.token);
        uint256 balanceBefore = token.balanceOf(address(this));
        
        token.safeTransferFrom(msg.sender, address(this), escrow.amount);
        
        uint256 balanceAfter = token.balanceOf(address(this));
        require(balanceAfter - balanceBefore == escrow.amount, "Escrow: transfer amount mismatch");
        
        escrow.status = EscrowStatus.Funded;
        emit EscrowFunded(msg.sender, escrow.amount, block.timestamp);
        emit StatusChanged(EscrowStatus.Pending, EscrowStatus.Funded);
    }

    /**
     * @notice Confirm work has started (moves from Funded to Active)
     * @dev Callable by payer or agent
     */
    function confirmWorkStarted() external onlyPayerOrAgent inStatus(EscrowStatus.Funded) {
        EscrowStatus oldStatus = escrow.status;
        escrow.status = EscrowStatus.Active;
        emit StatusChanged(oldStatus, EscrowStatus.Active);
    }

    /**
     * @notice Release funds to agent after completion
     * @dev Only callable by payer when not expired
     */
    function releaseFunds() external onlyPayer inStatus(EscrowStatus.Active) notExpired nonReentrant {
        _releaseToAgent();
    }

    /**
     * @notice Release funds to agent (agent can call after deadline if not disputed)
     * @dev Callable by agent only after deadline if payer hasn't refunded
     */
    function claimFunds() external onlyAgent inStatus(EscrowStatus.Active) expired nonReentrant {
        _releaseToAgent();
    }

    /**
     * @notice Refund funds to payer if deadline passed
     * @dev Only callable by payer after deadline
     */
    function refund() external onlyPayer expired nonReentrant {
        require(
            escrow.status == EscrowStatus.Funded || escrow.status == EscrowStatus.Active,
            "Escrow: invalid status for refund"
        );
        
        _refundPayer();
    }

    /**
     * @notice Open a dispute
     * @param reason Reason for dispute
     * @dev Callable by payer or agent when active
     */
    function openDispute(string calldata reason) external onlyPayerOrAgent inStatus(EscrowStatus.Active) {
        EscrowStatus oldStatus = escrow.status;
        escrow.status = EscrowStatus.Disputed;
        
        emit DisputeOpened(msg.sender, block.timestamp, reason);
        emit StatusChanged(oldStatus, EscrowStatus.Disputed);
    }

    /**
     * @notice Execute dispute resolution
     * @param payerAmount Amount to send to payer
     * @param agentAmount Amount to send to agent
     * @param feeAmount Amount for platform fee
     * @dev Only callable by arbiter contract
     */
    function executeResolution(
        uint256 payerAmount,
        uint256 agentAmount,
        uint256 feeAmount
    ) external onlyArbiter inStatus(EscrowStatus.Disputed) nonReentrant {
        require(!resolution.executed, "Escrow: already resolved");
        require(
            payerAmount + agentAmount + feeAmount == escrow.amount,
            "Escrow: amounts don't sum to total"
        );
        
        resolution = Resolution({
            payerAmount: payerAmount,
            agentAmount: agentAmount,
            feeAmount: feeAmount,
            executed: true,
            resolutionTime: block.timestamp
        });
        
        escrow.status = EscrowStatus.Resolved;
        
        // Execute transfers
        if (escrow.paymentType == PaymentType.ETH) {
            if (payerAmount > 0) {
                (bool success, ) = escrow.payer.call{value: payerAmount}("");
                require(success, "Escrow: ETH transfer to payer failed");
            }
            if (agentAmount > 0) {
                (bool success, ) = escrow.agent.call{value: agentAmount}("");
                require(success, "Escrow: ETH transfer to agent failed");
            }
            if (feeAmount > 0 && feeRecipient != address(0)) {
                (bool success, ) = feeRecipient.call{value: feeAmount}("");
                require(success, "Escrow: ETH fee transfer failed");
            }
        } else {
            IERC20 token = IERC20(escrow.token);
            if (payerAmount > 0) {
                token.safeTransfer(escrow.payer, payerAmount);
            }
            if (agentAmount > 0) {
                token.safeTransfer(escrow.agent, agentAmount);
            }
            if (feeAmount > 0 && feeRecipient != address(0)) {
                token.safeTransfer(feeRecipient, feeAmount);
            }
        }
        
        emit DisputeResolved(payerAmount, agentAmount, feeAmount, block.timestamp);
        emit StatusChanged(EscrowStatus.Disputed, EscrowStatus.Resolved);
    }

    /**
     * @notice Extend deadline
     * @param newDeadline New deadline timestamp
     * @dev Only callable by payer, must be before current deadline
     */
    function extendDeadline(uint256 newDeadline) external onlyPayer notExpired {
        require(newDeadline > escrow.deadline, "Escrow: new deadline must be later");
        require(
            escrow.status == EscrowStatus.Funded || escrow.status == EscrowStatus.Active,
            "Escrow: can only extend funded/active escrows"
        );
        
        uint256 oldDeadline = escrow.deadline;
        escrow.deadline = newDeadline;
        
        emit DeadlineExtended(oldDeadline, newDeadline);
    }

    // ============ Internal Functions ============
    
    function _releaseToAgent() internal {
        uint256 fee = (escrow.amount * escrow.feeBasisPoints) / 10000;
        uint256 agentAmount = escrow.amount - fee;
        
        escrow.status = EscrowStatus.Completed;
        
        if (escrow.paymentType == PaymentType.ETH) {
            (bool success, ) = escrow.agent.call{value: agentAmount}("");
            require(success, "Escrow: ETH transfer to agent failed");
            
            if (fee > 0 && feeRecipient != address(0)) {
                (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
                require(feeSuccess, "Escrow: ETH fee transfer failed");
            }
        } else {
            IERC20 token = IERC20(escrow.token);
            token.safeTransfer(escrow.agent, agentAmount);
            
            if (fee > 0 && feeRecipient != address(0)) {
                token.safeTransfer(feeRecipient, fee);
            }
        }
        
        emit FundsReleased(escrow.agent, agentAmount, fee, block.timestamp);
        emit StatusChanged(EscrowStatus.Active, EscrowStatus.Completed);
    }

    function _refundPayer() internal {
        uint256 refundAmount = escrow.amount;
        escrow.status = EscrowStatus.Refunded;
        
        if (escrow.paymentType == PaymentType.ETH) {
            (bool success, ) = escrow.payer.call{value: refundAmount}("");
            require(success, "Escrow: ETH refund failed");
        } else {
            IERC20 token = IERC20(escrow.token);
            token.safeTransfer(escrow.payer, refundAmount);
        }
        
        emit FundsRefunded(escrow.payer, refundAmount, block.timestamp);
        emit StatusChanged(EscrowStatus.Active, EscrowStatus.Refunded);
    }

    // ============ View Functions ============
    
    function getEscrowDetails() external view returns (EscrowData memory) {
        return escrow;
    }
    
    function getResolutionDetails() external view returns (Resolution memory) {
        return resolution;
    }
    
    function isExpired() external view returns (bool) {
        return block.timestamp >= escrow.deadline;
    }
    
    function getTimeRemaining() external view returns (uint256) {
        if (block.timestamp >= escrow.deadline) {
            return 0;
        }
        return escrow.deadline - block.timestamp;
    }

    // ============ Admin Functions ============
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Emergency withdrawal in case of contract issues
     * @dev Only factory can call this as last resort
     */
    function emergencyWithdraw() external onlyFactory nonReentrant {
        require(
            escrow.status == EscrowStatus.Pending || 
            escrow.status == EscrowStatus.Disputed,
            "Escrow: cannot emergency withdraw"
        );
        
        if (escrow.paymentType == PaymentType.ETH) {
            uint256 balance = address(this).balance;
            (bool success, ) = escrow.payer.call{value: balance}("");
            require(success, "Escrow: emergency withdraw failed");
        } else {
            IERC20 token = IERC20(escrow.token);
            uint256 balance = token.balanceOf(address(this));
            token.safeTransfer(escrow.payer, balance);
        }
    }
}
