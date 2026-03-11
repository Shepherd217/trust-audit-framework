// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "./Escrow.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title EscrowFactory
 * @author MoltOS
 * @notice Factory contract for creating and managing escrows
 * @dev Creates new escrow instances and tracks all created escrows
 */
contract EscrowFactory is ReentrancyGuard, Pausable, Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ============ State Variables ============
    
    // Default arbiter contract
    address public defaultArbiter;
    
    // Fee recipient address
    address public feeRecipient;
    
    // Default platform fee in basis points (1% = 100)
    uint256 public defaultFeeBasisPoints;
    
    // Maximum allowed fee (10%)
    uint256 public constant MAX_FEE_BASIS_POINTS = 1000;
    
    // Maximum deadline duration (365 days)
    uint256 public constant MAX_DEADLINE_DURATION = 365 days;
    
    // All escrows created by this factory
    EnumerableSet.AddressSet private allEscrows;
    
    // Escrows by payer
    mapping(address => EnumerableSet.AddressSet) private escrowsByPayer;
    
    // Escrows by agent
    mapping(address => EnumerableSet.AddressSet) private escrowsByAgent;
    
    // Escrow creation fee (in wei, for ETH escrows only)
    uint256 public creationFee;
    
    // Blacklisted tokens
    mapping(address => bool) public tokenBlacklist;
    
    // Whitelisted arbiters
    mapping(address => bool) public whitelistedArbiters;

    // ============ Events ============
    
    event EscrowCreated(
        address indexed escrow,
        address indexed payer,
        address indexed agent,
        uint256 amount,
        Escrow.PaymentType paymentType,
        address token,
        uint256 escrowId
    );
    
    event DefaultArbiterUpdated(
        address indexed oldArbiter,
        address indexed newArbiter
    );
    
    event FeeRecipientUpdated(
        address indexed oldRecipient,
        address indexed newRecipient
    );
    
    event DefaultFeeUpdated(
        uint256 oldFee,
        uint256 newFee
    );
    
    event CreationFeeUpdated(
        uint256 oldFee,
        uint256 newFee
    );
    
    event TokenBlacklistUpdated(
        address indexed token,
        bool blacklisted
    );
    
    event ArbiterWhitelisted(
        address indexed arbiter,
        bool whitelisted
    );
    
    event EmergencyEscrowShutdown(
        address indexed escrow,
        address indexed caller
    );

    // ============ Modifiers ============
    
    modifier validAddress(address _addr) {
        require(_addr != address(0), "Factory: invalid address");
        _;
    }
    
    modifier validFee(uint256 _fee) {
        require(_fee <= MAX_FEE_BASIS_POINTS, "Factory: fee too high");
        _;
    }
    
    modifier validDeadline(uint256 _deadline) {
        require(_deadline > block.timestamp, "Factory: deadline must be future");
        require(
            _deadline <= block.timestamp + MAX_DEADLINE_DURATION,
            "Factory: deadline too far in future"
        );
        _;
    }
    
    modifier notBlacklisted(address _token) {
        require(!tokenBlacklist[_token], "Factory: token is blacklisted");
        _;
    }

    // ============ Constructor ============
    
    constructor(
        address _defaultArbiter,
        address _feeRecipient,
        uint256 _defaultFeeBasisPoints
    ) Ownable(msg.sender) {
        require(_defaultArbiter != address(0), "Factory: invalid arbiter");
        require(_feeRecipient != address(0), "Factory: invalid fee recipient");
        require(_defaultFeeBasisPoints <= MAX_FEE_BASIS_POINTS, "Factory: fee too high");
        
        defaultArbiter = _defaultArbiter;
        feeRecipient = _feeRecipient;
        defaultFeeBasisPoints = _defaultFeeBasisPoints;
        
        // Whitelist the default arbiter
        whitelistedArbiters[_defaultArbiter] = true;
        
        emit DefaultArbiterUpdated(address(0), _defaultArbiter);
        emit FeeRecipientUpdated(address(0), _feeRecipient);
        emit DefaultFeeUpdated(0, _defaultFeeBasisPoints);
    }

    // ============ External Functions ============
    
    /**
     * @notice Create a new ETH escrow
     * @param _agent Address that will perform the work
     * @param _amount Amount to be held in escrow
     * @param _deadline Timestamp when escrow expires
     * @param _metadata IPFS hash or reference data
     * @return escrow Address of the newly created escrow
     */
    function createEthEscrow(
        address _agent,
        uint256 _amount,
        uint256 _deadline,
        bytes32 _metadata
    ) 
        external 
        payable 
        whenNotPaused 
        nonReentrant 
        validAddress(_agent)
        validDeadline(_deadline) 
        returns (address escrow)
    {
        require(_amount > 0, "Factory: amount must be > 0");
        require(msg.value >= _amount + creationFee, "Factory: insufficient payment");
        require(_agent != msg.sender, "Factory: agent cannot be payer");
        
        escrow = _createEscrow(
            msg.sender,
            _agent,
            defaultArbiter,
            _amount,
            _deadline,
            Escrow.PaymentType.ETH,
            address(0),
            _metadata,
            defaultFeeBasisPoints
        );
        
        // Forward ETH to escrow
        (bool success, ) = escrow.call{value: _amount}("");
        require(success, "Factory: ETH transfer failed");
        
        // Update escrow status to funded
        // Note: The escrow was pre-funded during creation
        
        // Refund excess
        uint256 excess = msg.value - _amount - creationFee;
        if (excess > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: excess}("");
            require(refundSuccess, "Factory: excess refund failed");
        }
    }

    /**
     * @notice Create a new ERC20 token escrow
     * @param _agent Address that will perform the work
     * @param _token Token address
     * @param _amount Amount to be held in escrow
     * @param _deadline Timestamp when escrow expires
     * @param _metadata IPFS hash or reference data
     * @return escrow Address of the newly created escrow
     */
    function createTokenEscrow(
        address _agent,
        address _token,
        uint256 _amount,
        uint256 _deadline,
        bytes32 _metadata
    ) 
        external 
        payable
        whenNotPaused 
        nonReentrant 
        validAddress(_agent)
        validAddress(_token)
        validDeadline(_deadline)
        notBlacklisted(_token)
        returns (address escrow)
    {
        require(_amount > 0, "Factory: amount must be > 0");
        require(_agent != msg.sender, "Factory: agent cannot be payer");
        require(msg.value >= creationFee, "Factory: insufficient creation fee");
        
        escrow = _createEscrow(
            msg.sender,
            _agent,
            defaultArbiter,
            _amount,
            _deadline,
            Escrow.PaymentType.ERC20,
            _token,
            _metadata,
            defaultFeeBasisPoints
        );
        
        // Payer must separately approve and call fundWithToken() on the escrow
        
        // Refund excess ETH (creation fee handling)
        uint256 excess = msg.value - creationFee;
        if (excess > 0) {
            (bool refundSuccess, ) = msg.sender.call{value: excess}("");
            require(refundSuccess, "Factory: excess refund failed");
        }
    }

    /**
     * @notice Create an escrow with custom parameters
     * @param _agent Address that will perform the work
     * @param _arbiter Custom arbiter address (must be whitelisted)
     @param _token Token address (address(0) for ETH)
     * @param _amount Amount to be held in escrow
     * @param _deadline Timestamp when escrow expires
     * @param _paymentType ETH or ERC20
     * @param _metadata IPFS hash or reference data
     * @param _customFeeBasisPoints Custom fee in basis points
     * @return escrow Address of the newly created escrow
     */
    function createCustomEscrow(
        address _agent,
        address _arbiter,
        address _token,
        uint256 _amount,
        uint256 _deadline,
        Escrow.PaymentType _paymentType,
        bytes32 _metadata,
        uint256 _customFeeBasisPoints
    ) 
        external 
        payable
        whenNotPaused 
        nonReentrant 
        validAddress(_agent)
        validAddress(_arbiter)
        validDeadline(_deadline)
        validFee(_customFeeBasisPoints)
        returns (address escrow)
    {
        require(_amount > 0, "Factory: amount must be > 0");
        require(_agent != msg.sender, "Factory: agent cannot be payer");
        require(whitelistedArbiters[_arbiter], "Factory: arbiter not whitelisted");
        
        if (_paymentType == Escrow.PaymentType.ERC20) {
            require(_token != address(0), "Factory: invalid token address");
            require(!tokenBlacklist[_token], "Factory: token is blacklisted");
            require(msg.value >= creationFee, "Factory: insufficient creation fee");
        } else {
            require(_token == address(0), "Factory: token should be address(0) for ETH");
            require(msg.value >= _amount + creationFee, "Factory: insufficient payment");
        }

        escrow = _createEscrow(
            msg.sender,
            _agent,
            _arbiter,
            _amount,
            _deadline,
            _paymentType,
            _token,
            _metadata,
            _customFeeBasisPoints
        );
        
        // Handle ETH funding for ETH escrows
        if (_paymentType == Escrow.PaymentType.ETH) {
            (bool success, ) = escrow.call{value: _amount}("");
            require(success, "Factory: ETH transfer failed");
            
            // Refund excess
            uint256 excess = msg.value - _amount - creationFee;
            if (excess > 0) {
                (bool refundSuccess, ) = msg.sender.call{value: excess}("");
                require(refundSuccess, "Factory: excess refund failed");
            }
        } else {
            // Refund excess ETH for token escrows
            uint256 excess = msg.value - creationFee;
            if (excess > 0) {
                (bool refundSuccess, ) = msg.sender.call{value: excess}("");
                require(refundSuccess, "Factory: excess refund failed");
            }
        }
    }

    // ============ Internal Functions ============
    
    function _createEscrow(
        address _payer,
        address _agent,
        address _arbiter,
        uint256 _amount,
        uint256 _deadline,
        Escrow.PaymentType _paymentType,
        address _token,
        bytes32 _metadata,
        uint256 _feeBasisPoints
    ) internal returns (address escrowAddress) {
        // Deploy new escrow contract
        Escrow newEscrow = new Escrow(
            _payer,
            _agent,
            _arbiter,
            _amount,
            _deadline,
            _paymentType,
            _token,
            _metadata,
            feeRecipient,
            _feeBasisPoints
        );
        
        escrowAddress = address(newEscrow);
        
        // Track the escrow
        allEscrows.add(escrowAddress);
        escrowsByPayer[_payer].add(escrowAddress);
        escrowsByAgent[_agent].add(escrowAddress);
        
        emit EscrowCreated(
            escrowAddress,
            _payer,
            _agent,
            _amount,
            _paymentType,
            _token,
            allEscrows.length()
        );
        
        return escrowAddress;
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Set the default arbiter contract
     * @param _arbiter New arbiter address
     */
    function setDefaultArbiter(address _arbiter) 
        external 
        onlyOwner 
        validAddress(_arbiter) 
    {
        address oldArbiter = defaultArbiter;
        defaultArbiter = _arbiter;
        
        // Auto-whitelist new default arbiter
        whitelistedArbiters[_arbiter] = true;
        
        emit DefaultArbiterUpdated(oldArbiter, _arbiter);
    }

    /**
     * @notice Set the fee recipient address
     * @param _recipient New fee recipient
     */
    function setFeeRecipient(address _recipient) 
        external 
        onlyOwner 
        validAddress(_recipient) 
    {
        address oldRecipient = feeRecipient;
        feeRecipient = _recipient;
        emit FeeRecipientUpdated(oldRecipient, _recipient);
    }

    /**
     * @notice Set the default platform fee
     * @param _feeBasisPoints New fee in basis points
     */
    function setDefaultFee(uint256 _feeBasisPoints) 
        external 
        onlyOwner 
        validFee(_feeBasisPoints) 
    {
        uint256 oldFee = defaultFeeBasisPoints;
        defaultFeeBasisPoints = _feeBasisPoints;
        emit DefaultFeeUpdated(oldFee, _feeBasisPoints);
    }

    /**
     * @notice Set the creation fee
     * @param _fee New creation fee in wei
     */
    function setCreationFee(uint256 _fee) external onlyOwner {
        uint256 oldFee = creationFee;
        creationFee = _fee;
        emit CreationFeeUpdated(oldFee, _fee);
    }

    /**
     * @notice Blacklist or unblacklist a token
     * @param _token Token address
     * @param _blacklisted Blacklist status
     */
    function setTokenBlacklist(address _token, bool _blacklisted) external onlyOwner {
        tokenBlacklist[_token] = _blacklisted;
        emit TokenBlacklistUpdated(_token, _blacklisted);
    }

    /**
     * @notice Whitelist or unwhitelist an arbiter
     * @param _arbiter Arbiter address
     * @param _whitelisted Whitelist status
     */
    function setArbiterWhitelist(address _arbiter, bool _whitelisted) 
        external 
        onlyOwner 
        validAddress(_arbiter) 
    {
        whitelistedArbiters[_arbiter] = _whitelisted;
        emit ArbiterWhitelisted(_arbiter, _whitelisted);
    }

    /**
     * @notice Emergency shutdown of an escrow
     * @param _escrow Escrow address to shut down
     * @dev Can only be called by factory owner for emergency situations
     */
    function emergencyEscrowShutdown(address _escrow) external onlyOwner {
        require(allEscrows.contains(_escrow), "Factory: not our escrow");
        
        Escrow escrow = Escrow(_escrow);
        escrow.emergencyWithdraw();
        
        emit EmergencyEscrowShutdown(_escrow, msg.sender);
    }

    /**
     * @notice Withdraw accumulated creation fees
     */
    function withdrawCreationFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "Factory: no fees to withdraw");
        
        (bool success, ) = feeRecipient.call{value: balance}("");
        require(success, "Factory: withdrawal failed");
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ View Functions ============
    
    function getAllEscrows() external view returns (address[] memory) {
        return allEscrows.values();
    }
    
    function getEscrowCount() external view returns (uint256) {
        return allEscrows.length();
    }
    
    function getEscrowsByPayer(address _payer) external view returns (address[] memory) {
        return escrowsByPayer[_payer].values();
    }
    
    function getPayerEscrowCount(address _payer) external view returns (uint256) {
        return escrowsByPayer[_payer].length();
    }
    
    function getEscrowsByAgent(address _agent) external view returns (address[] memory) {
        return escrowsByAgent[_agent].values();
    }
    
    function getAgentEscrowCount(address _agent) external view returns (uint256) {
        return escrowsByAgent[_agent].length();
    }
    
    function isEscrow(address _escrow) external view returns (bool) {
        return allEscrows.contains(_escrow);
    }
    
    function getCreationFee() external view returns (uint256) {
        return creationFee;
    }

    receive() external payable {}
    fallback() external payable {}
}
