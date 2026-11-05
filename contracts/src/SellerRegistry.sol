// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {PoPConfig} from "./PoPConfig.sol";

/// @title SellerRegistry
/// @notice Sellers register with a signature from the PoP attestor that binds their wallet to a handle hash and tier.
/// Bans are permanent: they cover both the wallet and the handle hash.
contract SellerRegistry is AccessControl, EIP712 {
    bytes32 public constant ATTESTOR_ROLE = keccak256("ATTESTOR_ROLE");
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    bytes32 public constant REGISTRATION_TYPEHASH = keccak256(
        "Registration(address seller,bytes32 handleHash,uint8 handleTier,uint256 nonce,uint64 deadline)"
    );

    struct Seller {
        bytes32 handleHash;
        uint8 handleTier; // 0 unverified, 1 staff-checked bio code, 2 cryptographic (Reclaim)
        bool registered;
    }

    mapping(address => Seller) public sellers;
    mapping(bytes32 => address) public handleOwner;
    mapping(address => bool) public bannedWallet;
    mapping(bytes32 => bool) public bannedHandle;
    mapping(bytes32 => bool) public usedRegistration; // digest => used

    event SellerRegistered(address indexed seller, bytes32 indexed handleHash, uint8 handleTier);
    event SellerBanned(address indexed seller, bytes32 indexed handleHash);

    error ZeroAddress();
    error BadTier();
    error Expired();
    error BadSignature();
    error AlreadyUsed();
    error Banned();
    error HandleTaken();
    error HandleMismatch();
    error NotRegistered();

    constructor(address admin, address attestor, address arbiter)
        EIP712(PoPConfig.DOMAIN_NAME, PoPConfig.DOMAIN_VERSION)
    {
        if (admin == address(0) || attestor == address(0) || arbiter == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ATTESTOR_ROLE, attestor);
        _grantRole(ARBITER_ROLE, arbiter);
    }

    /// @notice Register (or upgrade the tier of) a seller. Anyone may submit; the attestor signature is the authority.
    function registerSeller(
        address seller,
        bytes32 handleHash,
        uint8 handleTier,
        uint256 nonce,
        uint64 deadline,
        bytes calldata attestorSig
    ) external {
        if (seller == address(0)) revert ZeroAddress();
        if (handleTier > 2) revert BadTier();
        if (block.timestamp > deadline) revert Expired();
        if (bannedWallet[seller] || bannedHandle[handleHash]) revert Banned();

        bytes32 digest = registrationDigest(seller, handleHash, handleTier, nonce, deadline);
        if (usedRegistration[digest]) revert AlreadyUsed();
        if (!hasRole(ATTESTOR_ROLE, ECDSA.recover(digest, attestorSig))) revert BadSignature();
        usedRegistration[digest] = true;

        address owner = handleOwner[handleHash];
        if (owner != address(0) && owner != seller) revert HandleTaken();
        Seller storage s = sellers[seller];
        if (s.registered && s.handleHash != handleHash) revert HandleMismatch();

        handleOwner[handleHash] = seller;
        s.handleHash = handleHash;
        s.handleTier = handleTier;
        s.registered = true;
        emit SellerRegistered(seller, handleHash, handleTier);
    }

    /// @notice Permanently ban a seller wallet and its handle.
    function ban(address seller) external onlyRole(ARBITER_ROLE) {
        Seller storage s = sellers[seller];
        if (!s.registered) revert NotRegistered();
        bannedWallet[seller] = true;
        bannedHandle[s.handleHash] = true;
        emit SellerBanned(seller, s.handleHash);
    }

    function isActive(address seller) external view returns (bool) {
        Seller storage s = sellers[seller];
        return s.registered && !bannedWallet[seller] && !bannedHandle[s.handleHash];
    }

    function registrationDigest(
        address seller,
        bytes32 handleHash,
        uint8 handleTier,
        uint256 nonce,
        uint64 deadline
    ) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(REGISTRATION_TYPEHASH, seller, handleHash, handleTier, nonce, deadline))
        );
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
