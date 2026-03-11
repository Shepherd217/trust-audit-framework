// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Escrow.sol";

/**
 * @title Arbiter
 * @author MoltOS
 * @notice Multi-sig dispute resolution contract for escrow disputes
 * @dev Implements 5/7 committee voting with time-locked decisions
 */
contract Arbiter is ReentrancyGuard, Pausable, Ownable {
    
    // ============ Constants ============
    
    // Required votes for resolution (5 out of 7)
    uint256 public constant REQUIRED_VOTES = 5;
    uint256 public constant COMMITTEE_SIZE = 7;
    
    // Time lock period (24 hours) to allow for appeals
    uint256 public constant TIME_LOCK_PERIOD = 24 hours;
    
    // Maximum resolution delay (7 days)
    uint256 public constant MAX_RESOLUTION_DELAY = 7 days;

    // ============ Structs ============
    
    struct CommitteeMember {
        address member;
        bool isActive;
        uint256 addedAt;
    }
    
    struct Dispute {
        address escrow;
        address initiator;
        uint256 openedAt;
        uint256 totalVotes;
        uint256 votesForPayer;     // Votes to refund payer
        uint256 votesForAgent;     // Votes to pay agent
        uint256 votesForSplit;     // Votes for split decision
        bool resolved;
        uint256 resolvedAt;
        ResolutionType resolutionType;
        mapping(address => bool) hasVoted;
        mapping(address => Vote) votes;
    }
    
    enum Vote {
        Abstain,
        ForPayer,    // Refund to payer
        ForAgent,    // Pay to agent
        ForSplit     // Split payment
    }
    
    enum ResolutionType {
        None,
        FullRefund,  // 100% to payer
        FullPayment, // 100% to agent
        Split5050,   // 50/50 split
        Split6040,   // 60/40 (payer/agent)
        Split4060,   // 40/60 (payer/agent)
        Custom       // Custom split determined by vote
    }
    
    struct Resolution {
        uint256 payerPercentage;
        uint256 agentPercentage;
        uint256 feePercentage;
        bool executed;
        uint256 executionTime;
    }

    // ============ State Variables ============
    
    // Committee members
    CommitteeMember[COMMITTEE_SIZE] public committee;
    mapping(address => uint256) public memberIndex; // 0 = not a member
    uint256 public activeMemberCount;
    
    // Disputes by escrow address
    mapping(address => Dispute) public disputes;
    address[] public allDisputes;
    
    // Proposed resolutions (time-locked)
    mapping(address => Resolution) public proposedResolutions;
    mapping(address => uint256) public resolutionTimelock;
    
    // Dispute creation fee
    uint256 public disputeFee;
    
    // Fee recipient for dispute fees
    address public feeRecipient;
    
    // Factory address
    address public factory;
    
    // Appeal tracking
    mapping(address => uint256) public appealCount;
    mapping(address => bool) public appealed;
    
    // Custom splits for resolved disputes
    mapping(address => uint256) public customPayerSplit;
    mapping(address => uint256) public customAgentSplit;

    // ============ Events ============
    
    event CommitteeMemberAdded(
        address indexed member,
        uint256 index,
        uint256 timestamp
    );
    
    event CommitteeMemberRemoved(
        address indexed member,
        uint256 timestamp
    );
    
    event CommitteeMemberReplaced(
        address indexed oldMember,
        address indexed newMember,
        uint256 index
    );
    
    event DisputeOpened(
        address indexed escrow,
        address indexed initiator,
        uint256 timestamp,
        string reason
    );
    
    event VoteCast(
        address indexed escrow,
        address indexed voter,
        Vote vote,
        uint256 timestamp
    );
    
    event ResolutionProposed(
        address indexed escrow,
        ResolutionType resolutionType,
        uint256 payerPercentage,
        uint256 agentPercentage,
        uint256 unlockTime
    );
    
    event ResolutionExecuted(
        address indexed escrow,
        uint256 payerAmount,
        uint256 agentAmount,
        uint256 feeAmount,
        uint256 timestamp
    );
    
    event ResolutionAppealed(
        address indexed escrow,
        address indexed appellant,
        uint256 timestamp
    );
    
    event DisputeFeeUpdated(
        uint256 oldFee,
        uint256 newFee
    );
    
    event DisputeCancelled(
        address indexed escrow,
        address indexed canceller
    );

    // ============ Modifiers ============
    
    modifier onlyCommitteeMember() {
        require(isCommitteeMember(msg.sender), "Arbiter: not committee member");
        _;
    }
    
    modifier onlyActiveCommitteeMember() {
        require(isActiveCommitteeMember(msg.sender), "Arbiter: not active committee member");
        _;
    }
    
    modifier onlyFactory() {
        require(msg.sender == factory, "Arbiter: only factory");
        _;
    }
    
    modifier validEscrow(address _escrow) {
        require(_escrow != address(0), "Arbiter: invalid escrow");
        _;
    }
    
    modifier disputeExists(address _escrow) {
        require(disputes[_escrow].escrow != address(0), "Arbiter: dispute doesn't exist");
        _;
    }
    
    modifier disputeNotResolved(address _escrow) {
        require(!disputes[_escrow].resolved, "Arbiter: already resolved");
        _;
    }
    
    modifier timelockExpired(address _escrow) {
        require(
            block.timestamp >= resolutionTimelock[_escrow],
            "Arbiter: timelock not expired"
        );
        _;
    }
    
    modifier noActiveAppeal(address _escrow) {
        require(!appealed[_escrow], "Arbiter: resolution appealed");
        _;
    }

    // ============ Constructor ============
    
    constructor(
        address[COMMITTEE_SIZE] memory _initialCommittee,
        address _feeRecipient
    ) Ownable(msg.sender) {
        require(_feeRecipient != address(0), "Arbiter: invalid fee recipient");
        
        // Initialize committee
        for (uint256 i = 0; i < COMMITTEE_SIZE; i++) {
            require(_initialCommittee[i] != address(0), "Arbiter: invalid member address");
            require(memberIndex[_initialCommittee[i]] == 0, "Arbiter: duplicate member");
            
            committee[i] = CommitteeMember({
                member: _initialCommittee[i],
                isActive: true,
                addedAt: block.timestamp
            });
            
            memberIndex[_initialCommittee[i]] = i + 1; // 1-based index
            activeMemberCount++;
            
            emit CommitteeMemberAdded(_initialCommittee[i], i, block.timestamp);
        }
        
        feeRecipient = _feeRecipient;
    }

    // ============ External Functions ============
    
    /**
     * @notice Open a dispute for an escrow
     * @param _escrow Address of the escrow contract
     * @param _reason Reason for the dispute
     * @dev Callable by anyone, but typically called through escrow
     */
    function openDispute(
        address _escrow,
        string calldata _reason
    ) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
        validEscrow(_escrow) 
    {
        require(msg.value >= disputeFee, "Arbiter: insufficient dispute fee");
        require(disputes[_escrow].escrow == address(0), "Arbiter: dispute already exists");
        
        // Verify this is a valid escrow from our factory
        Escrow escrow = Escrow(_escrow);
        require(escrow.arbiter() == address(this), "Arbiter: not arbiter for this escrow");
        
        (Escrow.EscrowStatus status,,,,,,,,) = escrow.escrow();
        require(
            status == Escrow.EscrowStatus.Active || status == Escrow.EscrowStatus.Disputed,
            "Arbiter: invalid escrow status"
        );
        
        // Create dispute
        Dispute storage newDispute = disputes[_escrow];
        newDispute.escrow = _escrow;
        newDispute.initiator = msg.sender;
        newDispute.openedAt = block.timestamp;
        
        allDisputes.push(_escrow);
        
        // Send fee to recipient
        if (disputeFee > 0) {
            (bool success, ) = feeRecipient.call{value: disputeFee}("");
            require(success, "Arbiter: fee transfer failed");
        }
        
        // Refund excess
        uint256 excess = msg.value - disputeFee;
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "Arbiter: excess refund failed");
        }
        
        emit DisputeOpened(_escrow, msg.sender, block.timestamp, _reason);
    }

    /**
     * @notice Cast a vote on a dispute
     * @param _escrow Address of the escrow contract
     * @param _vote Vote option
     * @param _customPayerPercentage Custom percentage for payer (only if vote is ForSplit)
     */
    function castVote(
        address _escrow,
        Vote _vote,
        uint256 _customPayerPercentage
    ) 
        external 
        onlyActiveCommitteeMember 
        disputeExists(_escrow) 
        disputeNotResolved(_escrow) 
    {
        Dispute storage dispute = disputes[_escrow];
        
        require(!dispute.hasVoted[msg.sender], "Arbiter: already voted");
        require(_vote != Vote.Abstain, "Arbiter: cannot abstain");
        require(
            block.timestamp <= dispute.openedAt + MAX_RESOLUTION_DELAY,
            "Arbiter: voting period expired"
        );
        
        dispute.hasVoted[msg.sender] = true;
        dispute.votes[msg.sender] = _vote;
        dispute.totalVotes++;
        
        if (_vote == Vote.ForPayer) {
            dispute.votesForPayer++;
        } else if (_vote == Vote.ForAgent) {
            dispute.votesForAgent++;
        } else if (_vote == Vote.ForSplit) {
            dispute.votesForSplit++;
            // Store custom split preference
            if (_customPayerPercentage > 0 && _customPayerPercentage < 10000) {
                customPayerSplit[_escrow] = _customPayerPercentage;
            }
        }
        
        emit VoteCast(_escrow, msg.sender, _vote, block.timestamp);
        
        // Check if we have enough votes to resolve
        _checkAndProposeResolution(_escrow);
    }

    /**
     * @notice Execute a resolution after timelock expires
     * @param _escrow Address of the escrow contract
     * @dev Callable by anyone after timelock expires
     */
    function executeResolution(address _escrow) 
        external 
        whenNotPaused 
        nonReentrant 
        disputeExists(_escrow) 
        disputeNotResolved(_escrow) 
        timelockExpired(_escrow) 
        noActiveAppeal(_escrow) 
    {
        Resolution storage res = proposedResolutions[_escrow];
        require(res.executionTime == 0, "Arbiter: already executed");
        
        Dispute storage dispute = disputes[_escrow];
        dispute.resolved = true;
        dispute.resolvedAt = block.timestamp;
        
        res.executed = true;
        res.executionTime = block.timestamp;
        
        // Get escrow details
        Escrow escrow = Escrow(_escrow);
        (,,,, uint256 amount,,,, uint256 feeBasisPoints) = escrow.escrow();
        
        // Calculate amounts
        uint256 totalAmount = amount;
        uint256 platformFee = (totalAmount * feeBasisPoints) / 10000;
        uint256 remainingAmount = totalAmount - platformFee;
        
        uint256 payerAmount = (remainingAmount * res.payerPercentage) / 10000;
        uint256 agentAmount = (remainingAmount * res.agentPercentage) / 10000;
        
        // Execute through escrow
        escrow.executeResolution(payerAmount, agentAmount, platformFee);
        
        emit ResolutionExecuted(
            _escrow,
            payerAmount,
            agentAmount,
            platformFee,
            block.timestamp
        );
    }

    /**
     * @notice Appeal a proposed resolution
     * @param _escrow Address of the escrow contract
     * @dev Extends resolution timeline and requires additional votes
     */
    function appealResolution(address _escrow) 
        external 
        payable 
        disputeExists(_escrow) 
        disputeNotResolved(_escrow) 
    {
        require(!appealed[_escrow], "Arbiter: already appealed");
        require(msg.value >= disputeFee * 2, "Arbiter: insufficient appeal fee");
        
        Escrow escrow = Escrow(_escrow);
        (,, address agent, address payer,,,,,) = escrow.escrow();
        require(
            msg.sender == payer || msg.sender == agent,
            "Arbiter: only participants can appeal"
        );
        
        appealed[_escrow] = true;
        appealCount[_escrow]++;
        
        // Extend timelock
        resolutionTimelock[_escrow] = block.timestamp + (TIME_LOCK_PERIOD * 2);
        
        // Send appeal fee
        (bool success, ) = feeRecipient.call{value: disputeFee * 2}("");
        require(success, "Arbiter: appeal fee transfer failed");
        
        // Refund excess
        uint256 excess = msg.value - (disputeFee * 2);
        if (excess > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: excess}("");
            require(refundSuccess, "Arbiter: excess refund failed");
        }
        
        emit ResolutionAppealed(_escrow, msg.sender, block.timestamp);
    }

    /**
     * @notice Cancel a dispute (requires mutual consent)
     * @param _escrow Address of the escrow contract
     * @dev Can be cancelled if both parties agree
     */
    function cancelDispute(address _escrow) 
        external 
        disputeExists(_escrow) 
        disputeNotResolved(_escrow) 
    {
        Escrow escrow = Escrow(_escrow);
        (,, address agent, address payer,,,,,) = escrow.escrow();
        
        // Only participants or owner can initiate cancellation
        require(
            msg.sender == payer || msg.sender == agent || msg.sender == owner(),
            "Arbiter: not authorized"
        );
        
        // For now, only owner can cancel
        // In production, implement mutual signature verification
        require(msg.sender == owner(), "Arbiter: only owner can cancel for now");
        
        Dispute storage dispute = disputes[_escrow];
        dispute.resolved = true;
        dispute.resolutionType = ResolutionType.None;
        
        // Clear timelock to prevent execution
        resolutionTimelock[_escrow] = type(uint256).max;
        
        emit DisputeCancelled(_escrow, msg.sender);
    }

    // ============ Internal Functions ============
    
    function _checkAndProposeResolution(address _escrow) internal {
        Dispute storage dispute = disputes[_escrow];
        
        if (dispute.totalVotes >= REQUIRED_VOTES) {
            // Determine resolution type
            ResolutionType resType = ResolutionType.None;
            uint256 payerPercent = 0;
            uint256 agentPercent = 0;
            
            // Find majority
            if (dispute.votesForPayer >= REQUIRED_VOTES) {
                resType = ResolutionType.FullRefund;
                payerPercent = 10000; // 100%
                agentPercent = 0;
            } else if (dispute.votesForAgent >= REQUIRED_VOTES) {
                resType = ResolutionType.FullPayment;
                payerPercent = 0;
                agentPercent = 10000; // 100%
            } else if (dispute.votesForSplit >= REQUIRED_VOTES) {
                // Use custom split if available, otherwise 50/50
                uint256 customPayer = customPayerSplit[_escrow];
                if (customPayer > 0) {
                    payerPercent = customPayer;
                    agentPercent = 10000 - customPayer;
                    resType = ResolutionType.Custom;
                } else {
                    resType = ResolutionType.Split5050;
                    payerPercent = 5000; // 50%
                    agentPercent = 5000; // 50%
                }
            } else {
                // Mixed votes - default to split 50/50
                resType = ResolutionType.Split5050;
                payerPercent = 5000;
                agentPercent = 5000;
            }
            
            // Store proposed resolution
            proposedResolutions[_escrow] = Resolution({
                payerPercentage: payerPercent,
                agentPercentage: agentPercent,
                feePercentage: 0,
                executed: false,
                executionTime: 0
            });
            
            // Set timelock
            resolutionTimelock[_escrow] = block.timestamp + TIME_LOCK_PERIOD;
            
            dispute.resolutionType = resType;
            
            emit ResolutionProposed(
                _escrow,
                resType,
                payerPercent,
                agentPercent,
                resolutionTimelock[_escrow]
            );
        }
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Replace a committee member
     * @param _index Index of member to replace (0-6)
     * @param _newMember New member address
     */
    function replaceCommitteeMember(
        uint256 _index,
        address _newMember
    ) 
        external 
        onlyOwner 
    {
        require(_index < COMMITTEE_SIZE, "Arbiter: invalid index");
        require(_newMember != address(0), "Arbiter: invalid address");
        require(memberIndex[_newMember] == 0, "Arbiter: already a member");
        
        address oldMember = committee[_index].member;
        
        // Remove old member from mapping
        memberIndex[oldMember] = 0;
        
        // Add new member
        committee[_index] = CommitteeMember({
            member: _newMember,
            isActive: true,
            addedAt: block.timestamp
        });
        memberIndex[_newMember] = _index + 1;
        
        emit CommitteeMemberReplaced(oldMember, _newMember, _index);
    }

    /**
     * @notice Toggle a committee member's active status
     * @param _member Member address
     * @param _isActive New status
     */
    function setMemberStatus(
        address _member,
        bool _isActive
    ) 
        external 
        onlyOwner 
    {
        require(isCommitteeMember(_member), "Arbiter: not a member");
        uint256 index = memberIndex[_member] - 1;
        
        if (committee[index].isActive != _isActive) {
            committee[index].isActive = _isActive;
            if (_isActive) {
                activeMemberCount++;
            } else {
                activeMemberCount--;
            }
        }
    }

    /**
     * @notice Set the dispute fee
     * @param _fee New fee amount
     */
    function setDisputeFee(uint256 _fee) external onlyOwner {
        uint256 oldFee = disputeFee;
        disputeFee = _fee;
        emit DisputeFeeUpdated(oldFee, _fee);
    }

    /**
     * @notice Set the fee recipient
     * @param _recipient New fee recipient
     */
    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Arbiter: invalid address");
        feeRecipient = _recipient;
    }

    /**
     * @notice Set factory address
     * @param _factory Factory address
     */
    function setFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "Arbiter: invalid address");
        factory = _factory;
    }

    /**
     * @notice Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Withdraw stuck ETH
     */
    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "Arbiter: no balance");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Arbiter: withdrawal failed");
    }

    // ============ View Functions ============
    
    function isCommitteeMember(address _addr) public view returns (bool) {
        return memberIndex[_addr] > 0;
    }
    
    function isActiveCommitteeMember(address _addr) public view returns (bool) {
        uint256 index = memberIndex[_addr];
        if (index == 0) return false;
        return committee[index - 1].isActive;
    }
    
    function getCommitteeMembers() external view returns (CommitteeMember[COMMITTEE_SIZE] memory) {
        return committee;
    }
    
    function getDispute(address _escrow) external view returns (
        address escrow,
        address initiator,
        uint256 openedAt,
        uint256 totalVotes,
        uint256 votesForPayer,
        uint256 votesForAgent,
        uint256 votesForSplit,
        bool resolved,
        uint256 resolvedAt,
        ResolutionType resolutionType
    ) {
        Dispute storage d = disputes[_escrow];
        return (
            d.escrow,
            d.initiator,
            d.openedAt,
            d.totalVotes,
            d.votesForPayer,
            d.votesForAgent,
            d.votesForSplit,
            d.resolved,
            d.resolvedAt,
            d.resolutionType
        );
    }
    
    function hasVoted(address _escrow, address _member) external view returns (bool) {
        return disputes[_escrow].hasVoted[_member];
    }
    
    function getVote(address _escrow, address _member) external view returns (Vote) {
        return disputes[_escrow].votes[_member];
    }
    
    function getAllDisputes() external view returns (address[] memory) {
        return allDisputes;
    }
    
    function getDisputeCount() external view returns (uint256) {
        return allDisputes.length;
    }
    
    function canExecuteResolution(address _escrow) external view returns (bool) {
        return 
            disputes[_escrow].escrow != address(0) &&
            !disputes[_escrow].resolved &&
            !proposedResolutions[_escrow].executed &&
            block.timestamp >= resolutionTimelock[_escrow] &&
            !appealed[_escrow];
    }
    
    function getTimeUntilExecution(address _escrow) external view returns (uint256) {
        if (block.timestamp >= resolutionTimelock[_escrow]) {
            return 0;
        }
        return resolutionTimelock[_escrow] - block.timestamp;
    }

    receive() external payable {}
    fallback() external payable {}
}
