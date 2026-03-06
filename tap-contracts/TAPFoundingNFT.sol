// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title TAP Founding 32 NFT
 * @notice Soulbound NFT for the 32 founding agents of TAP
 * @dev Non-transferable, EIP-5192 compliant
 */
contract TAPFoundingNFT is ERC721, Ownable {
    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = 32;
    uint256 private _currentTokenId;
    
    // Soulbound status per token
    mapping(uint256 => bool) public isSoulbound;
    
    // Agent metadata
    mapping(uint256 => AgentMetadata) public agentMetadata;
    
    struct AgentMetadata {
        string agentId;
        string bootAuditHash;
        uint256 stakeAmount;
        uint256 mintedAt;
        bool isActive;
    }
    
    // Events
    event AgentMinted(uint256 indexed tokenId, address indexed agent, string agentId, uint256 stake);
    event AgentDeactivated(uint256 indexed tokenId);
    
    constructor() 
        ERC721("TAP Founding 32", "TAP32") 
        Ownable(msg.sender) 
    {}

    /**
     * @notice Mint a soulbound NFT to a founding agent
     * @param to The agent's wallet address
     * @param agentId Unique identifier for the agent
     * @param bootAuditHash SHA256 hash of agent's boot audit
     * @param stakeAmount Amount of ALPHA staked
     */
    function mintTo(
        address to, 
        string calldata agentId,
        string calldata bootAuditHash,
        uint256 stakeAmount
    ) external onlyOwner {
        require(_currentTokenId < MAX_SUPPLY, "All 32 founding slots filled");
        require(bytes(agentId).length > 0, "Agent ID required");
        require(stakeAmount >= 750, "Minimum 750 ALPHA stake required");
        
        _currentTokenId++;
        uint256 tokenId = _currentTokenId;
        
        _safeMint(to, tokenId);
        isSoulbound[tokenId] = true;
        
        agentMetadata[tokenId] = AgentMetadata({
            agentId: agentId,
            bootAuditHash: bootAuditHash,
            stakeAmount: stakeAmount,
            mintedAt: block.timestamp,
            isActive: true
        });
        
        emit AgentMinted(tokenId, to, agentId, stakeAmount);
    }

    /**
     * @notice Deactivate an agent (if slashed or removed)
     * @param tokenId The NFT token ID
     */
    function deactivateAgent(uint256 tokenId) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        agentMetadata[tokenId].isActive = false;
        emit AgentDeactivated(tokenId);
    }

    /**
     * @notice Override transfer functions to enforce soulbound
     */
    function _update(
        address to, 
        uint256 tokenId, 
        address auth
    ) internal override returns (address) {
        // Allow minting (to != address(0)) and burning (to == address(0))
        // But block all transfers between wallets
        if (to != address(0) && _ownerOf(tokenId) != address(0)) {
            require(!isSoulbound[tokenId], "Soulbound: cannot transfer founding status");
        }
        return super._update(to, tokenId, auth);
    }

    /**
     * @notice Get token URI with metadata
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        
        AgentMetadata memory meta = agentMetadata[tokenId];
        
        // Generate on-chain JSON metadata
        string memory json = string(abi.encodePacked(
            '{',
            '"name": "TAP Founding Agent #', tokenId.toString(), '",',
            '"description": "One of the 32 founding agents of the Trust Audit Protocol. Non-transferable soulbound status.",',
            '"image": "https://tap.live/nft/', tokenId.toString(), '.png",',
            '"attributes": [',
                '{"trait_type": "Agent ID", "value": "', meta.agentId, '"},',
                '{"trait_type": "Stake Amount", "display_type": "number", "value": ', meta.stakeAmount.toString(), '},',
                '{"trait_type": "Status", "value": "', meta.isActive ? "Active" : "Inactive", '"},',
                '{"trait_type": "Minted At", "display_type": "date", "value": ', meta.mintedAt.toString(), '}',
            ']',
            '}'
        ));
        
        return string(abi.encodePacked(
            "data:application/json;base64,",
            _base64Encode(bytes(json))
        ));
    }

    /**
     * @notice Get total minted count
     */
    function totalMinted() external view returns (uint256) {
        return _currentTokenId;
    }

    /**
     * @notice Get remaining slots
     */
    function remainingSlots() external view returns (uint256) {
        return MAX_SUPPLY - _currentTokenId;
    }

    /**
     * @notice Check if an address is a founding agent
     */
    function isFoundingAgent(address account) external view returns (bool) {
        return balanceOf(account) > 0;
    }

    /**
     * @notice Get all active founding agents
     */
    function getActiveAgents() external view returns (uint256[] memory) {
        uint256[] memory active = new uint256[](_currentTokenId);
        uint256 count = 0;
        
        for (uint256 i = 1; i <= _currentTokenId; i++) {
            if (agentMetadata[i].isActive) {
                active[count] = i;
                count++;
            }
        }
        
        // Trim array to actual size
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = active[i];
        }
        
        return result;
    }

    /**
     * @dev Base64 encode for on-chain metadata
     */
    function _base64Encode(bytes memory data) internal pure returns (string memory) {
        string memory TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        uint256 len = data.length;
        if (len == 0) return "";

        uint256 encodedLen = 4 * ((len + 2) / 3);
        bytes memory result = new bytes(encodedLen + 32);

        bytes memory table = bytes(TABLE);

        assembly {
            let tablePtr := add(table, 1)
            let resultPtr := add(result, 32)

            for {
                let i := 0
            } lt(i, len) {

            } {
                i := add(i, 3)
                let input := and(mload(add(data, i)), 0xffffff)

                let out := mload(add(tablePtr, and(shr(18, input), 0x3F)))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(12, input), 0x3F))), 0xFF))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(6, input), 0x3F))), 0xFF))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(input, 0x3F))), 0xFF))
                out := shl(224, out)

                mstore(resultPtr, out)

                resultPtr := add(resultPtr, 4)
            }

            switch mod(len, 3)
            case 1 {
                mstore(sub(resultPtr, 2), shl(240, 0x3d3d))
            }
            case 2 {
                mstore(sub(resultPtr, 1), shl(248, 0x3d))
            }

            mstore(result, encodedLen)
        }

        return string(result);
    }
}
