// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {PoPConfig} from "./PoPConfig.sol";

interface ISellerRegistry {
    function isActive(address seller) external view returns (bool);
}

/// @title PoPCheckout
/// @notice Protected checkout. The buyer pays a seller-signed Offer in the specified test USDT.
/// - Money is released by the buyer's delivery code (or the buyer's own confirmation), then a dispute window.
/// - A missed ship-by or deliver-by deadline lets ANYONE finalize into a full refund.
/// - The courier role can only move Shipped -> Disputed, and only before deliver-by. It never moves money.
/// - The arbiter resolves disputes (refund / release / split).
/// - All payouts are credited and withdrawn (pull payments); `withdrawFor` lets anyone push a credit to its owner.
contract PoPCheckout is AccessControl, EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant COURIER_ROLE = keccak256("COURIER_ROLE");
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    bytes32 public constant OFFER_TYPEHASH = keccak256(
        "Offer(address seller,bytes32 listingId,bytes32 termsHash,bytes32 externalRef,uint256 price,uint32 shipWithin,uint32 deliverWithin,uint32 maxUnits,uint64 validUntil,uint256 version)"
    );

    uint16 public constant BPS = 10_000;
    uint16 public constant MAX_FEE_BPS = 1_000; // 10% cap

    enum State {
        None,
        Funded,
        Shipped,
        Delivered,
        Disputed,
        Released,
        Refunded,
        Split
    }

    struct Offer {
        address seller; // registered seller wallet
        bytes32 listingId; // social listing id, or keccak(merchant order id) for websites
        bytes32 termsHash; // keccak of canonical terms JSON
        bytes32 externalRef; // website order id hash; 0 for social listings
        uint256 price; // token base units (read decimals() off-chain)
        uint32 shipWithin; // seconds after funding
        uint32 deliverWithin; // seconds after shipping
        uint32 maxUnits; // stock for this offer
        uint64 validUntil; // offer expiry (unix seconds)
        uint256 version; // seller can revoke all lower versions
    }

    struct Order {
        address buyer;
        address seller;
        uint256 amount;
        bytes32 termsHash;
        bytes32 codeHash;
        bytes32 trackingHash;
        uint64 fundedAt;
        uint64 shipBy;
        uint64 shippedAt;
        uint64 deliverBy;
        uint64 deliveredAt;
        uint64 disputedAt;
        uint32 deliverWithin;
        uint32 disputeWindow;
        State state;
    }

    IERC20 public immutable token;
    ISellerRegistry public immutable registry;
    address public immutable treasury;
    uint16 public immutable feeBps;
    uint32 public immutable shortWindow; // dispute window for trusted sellers
    uint32 public immutable longWindow; // dispute window for everyone else
    uint32 public immutable trustedMinCompleted;
    uint32 public immutable arbiterTimeout; // unresolved dispute -> anyone can refund the buyer

    uint256 public nextOrderId;
    mapping(uint256 => Order) internal _orders;
    mapping(bytes32 => uint32) public unitsSold; // offer digest => units sold
    mapping(address => uint256) public minOfferVersion; // seller => lowest valid version
    mapping(address => uint256) public completed; // seller => released orders
    mapping(address => uint256) public lostDisputes; // seller => disputes the buyer won (buyerBps > 50%)
    mapping(address => uint256) public credit; // account => withdrawable balance

    /// @dev Accounting: token.balanceOf(this) >= totalLocked + totalCredit at all times.
    uint256 public totalLocked;
    uint256 public totalCredit;

    event OrderFunded(
        uint256 indexed orderId,
        address indexed buyer,
        address indexed seller,
        bytes32 listingId,
        bytes32 externalRef,
        bytes32 termsHash,
        uint256 amount,
        uint64 shipBy
    );
    event OrderShipped(uint256 indexed orderId, bytes32 trackingHash, uint64 deliverBy);
    event OrderDelivered(uint256 indexed orderId, bool viaCode, uint32 disputeWindow);
    event HandoverRefused(uint256 indexed orderId);
    event DisputeOpened(uint256 indexed orderId, bytes32 evidenceHash);
    event DisputeResolved(uint256 indexed orderId, uint16 buyerBps, bytes32 decisionHash);
    event OrderReleased(uint256 indexed orderId, uint256 sellerAmount, uint256 fee);
    event OrderRefunded(uint256 indexed orderId, uint256 amount, uint8 reason); // 1 no-ship, 2 no-delivery, 3 dispute, 4 arbiter timeout, 5 banned seller
    event Withdrawn(address indexed account, uint256 amount);
    event OffersRevoked(address indexed seller, uint256 minVersion);

    error ZeroAddress();
    error FeeTooHigh();
    error BadWindows();
    error SellerNotActive();
    error OfferExpired();
    error OfferRevoked();
    error SoldOut();
    error BadSignature();
    error BadOffer();
    error BadState();
    error NotSeller();
    error NotBuyer();
    error TooLate();
    error TooEarly();
    error BadCode();
    error BadBps();
    error NothingToWithdraw();
    error SelfPurchase();
    error SellerNotBanned();

    constructor(
        IERC20 token_,
        ISellerRegistry registry_,
        address admin,
        address courier,
        address arbiter,
        address treasury_,
        uint16 feeBps_,
        uint32 shortWindow_,
        uint32 longWindow_,
        uint32 trustedMinCompleted_,
        uint32 arbiterTimeout_
    ) EIP712(PoPConfig.DOMAIN_NAME, PoPConfig.DOMAIN_VERSION) {
        if (
            address(token_) == address(0) || address(registry_) == address(0) || admin == address(0)
                || courier == address(0) || arbiter == address(0) || treasury_ == address(0)
        ) revert ZeroAddress();
        if (feeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        if (shortWindow_ == 0 || shortWindow_ > longWindow_) revert BadWindows();
        if (arbiterTimeout_ == 0) revert BadWindows();
        token = token_;
        registry = registry_;
        treasury = treasury_;
        feeBps = feeBps_;
        shortWindow = shortWindow_;
        longWindow = longWindow_;
        trustedMinCompleted = trustedMinCompleted_;
        arbiterTimeout = arbiterTimeout_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(COURIER_ROLE, courier);
        _grantRole(ARBITER_ROLE, arbiter);
    }

    // ---------------------------------------------------------------- buyer pays

    /// @notice Pay a seller-signed Offer. `codeHash = keccak256(abi.encodePacked(block.chainid, address(this), code))`.
    function pay(Offer calldata o, bytes calldata sellerSig, bytes32 codeHash)
        external
        nonReentrant
        returns (uint256 orderId)
    {
        if (o.price == 0 || o.shipWithin == 0 || o.deliverWithin == 0 || o.maxUnits == 0 || codeHash == bytes32(0)) {
            revert BadOffer();
        }
        if (msg.sender == o.seller) revert SelfPurchase(); // no self-purchases to farm completed orders
        if (block.timestamp > o.validUntil) revert OfferExpired();
        if (o.version < minOfferVersion[o.seller]) revert OfferRevoked();
        if (!registry.isActive(o.seller)) revert SellerNotActive();

        bytes32 digest = offerDigest(o);
        if (ECDSA.recover(digest, sellerSig) != o.seller) revert BadSignature();
        if (unitsSold[digest] >= o.maxUnits) revert SoldOut();
        unitsSold[digest] += 1;

        orderId = ++nextOrderId;
        uint64 shipBy = uint64(block.timestamp) + o.shipWithin;
        Order storage ord = _orders[orderId];
        ord.buyer = msg.sender;
        ord.seller = o.seller;
        ord.amount = o.price;
        ord.termsHash = o.termsHash;
        ord.codeHash = codeHash;
        ord.fundedAt = uint64(block.timestamp);
        ord.shipBy = shipBy;
        ord.deliverWithin = o.deliverWithin;
        ord.state = State.Funded;
        totalLocked += o.price;

        emit OrderFunded(orderId, msg.sender, o.seller, o.listingId, o.externalRef, o.termsHash, o.price, shipBy);
        token.safeTransferFrom(msg.sender, address(this), o.price);
    }

    // ---------------------------------------------------------------- seller ships

    function markShipped(uint256 id, bytes32 trackingHash) external {
        Order storage o = _orders[id];
        if (o.state != State.Funded) revert BadState();
        if (msg.sender != o.seller) revert NotSeller();
        if (block.timestamp > o.shipBy) revert TooLate();
        o.state = State.Shipped;
        o.shippedAt = uint64(block.timestamp);
        o.deliverBy = uint64(block.timestamp) + o.deliverWithin;
        o.trackingHash = trackingHash;
        emit OrderShipped(id, trackingHash, o.deliverBy);
    }

    // ---------------------------------------------------------------- delivery

    /// @notice Anyone (normally the courier at the door) submits the buyer's code.
    function confirmDelivery(uint256 id, bytes calldata code) external {
        Order storage o = _orders[id];
        if (o.state != State.Shipped) revert BadState();
        if (keccak256(abi.encodePacked(block.chainid, address(this), code)) != o.codeHash) revert BadCode();
        _markDelivered(id, o, true);
    }

    /// @notice The buyer confirms receipt directly (same effect as the code).
    function confirmReceived(uint256 id) external {
        Order storage o = _orders[id];
        if (o.state != State.Shipped) revert BadState();
        if (msg.sender != o.buyer) revert NotBuyer();
        _markDelivered(id, o, false);
    }

    /// @notice Courier: "delivered, but the buyer refused to hand over the code". Shipped -> Disputed only.
    /// Only before deliver-by, so the courier can never block the automatic late-delivery refund.
    function reportHandoverRefused(uint256 id) external onlyRole(COURIER_ROLE) {
        Order storage o = _orders[id];
        if (o.state != State.Shipped) revert BadState();
        if (block.timestamp > o.deliverBy) revert TooLate();
        o.state = State.Disputed;
        o.disputedAt = uint64(block.timestamp);
        emit HandoverRefused(id);
    }

    // ---------------------------------------------------------------- disputes

    function openDispute(uint256 id, bytes32 evidenceHash) external {
        Order storage o = _orders[id];
        if (o.state != State.Delivered) revert BadState();
        if (msg.sender != o.buyer) revert NotBuyer();
        if (block.timestamp > uint256(o.deliveredAt) + o.disputeWindow) revert TooLate();
        o.state = State.Disputed;
        o.disputedAt = uint64(block.timestamp);
        emit DisputeOpened(id, evidenceHash);
    }

    /// @notice Arbiter splits the order: buyerBps of the amount to the buyer, the rest (minus fee) to the seller.
    function resolveDispute(uint256 id, uint16 buyerBps, bytes32 decisionHash)
        external
        nonReentrant
        onlyRole(ARBITER_ROLE)
    {
        Order storage o = _orders[id];
        if (o.state != State.Disputed) revert BadState();
        if (buyerBps > BPS) revert BadBps();
        if (block.timestamp > uint256(o.disputedAt) + arbiterTimeout) revert TooLate();

        uint256 amount = o.amount;
        uint256 buyerAmount = (amount * buyerBps) / BPS;
        uint256 sellerGross = amount - buyerAmount;
        uint256 fee = (sellerGross * feeBps) / BPS;

        if (buyerBps > BPS / 2) lostDisputes[o.seller] += 1;
        emit DisputeResolved(id, buyerBps, decisionHash);

        if (buyerBps == BPS) {
            o.state = State.Refunded;
            _settle(o.buyer, buyerAmount, o.seller, 0, 0, amount);
            emit OrderRefunded(id, amount, 3);
        } else if (buyerBps == 0) {
            o.state = State.Released;
            completed[o.seller] += 1;
            _settle(o.buyer, 0, o.seller, sellerGross - fee, fee, amount);
            emit OrderReleased(id, sellerGross - fee, fee);
        } else {
            o.state = State.Split;
            _settle(o.buyer, buyerAmount, o.seller, sellerGross - fee, fee, amount);
        }
    }

    /// @notice Arbiter-only: refund a still-open order (Funded, Shipped or Disputed) of a BANNED seller
    /// to the buyer in full. Delivered orders are deliberately excluded (the buyer confirmed receipt; the dispute window applies). It can only ever pay the buyer: no release, no fee, no split, no other recipient.
    /// Terminal orders (Released, Refunded, Split) are untouched, so each order still ends in exactly one terminal state.
    function forceRefundBanned(uint256 id) external nonReentrant onlyRole(ARBITER_ROLE) {
        Order storage o = _orders[id];
        State s = o.state;
        if (s != State.Funded && s != State.Shipped && s != State.Disputed) revert BadState();
        // Every order's seller was registered at pay time, so "not active" here means banned.
        if (registry.isActive(o.seller)) revert SellerNotBanned();
        uint256 amount = o.amount;
        o.state = State.Refunded;
        _settle(o.buyer, amount, o.seller, 0, 0, amount);
        emit OrderRefunded(id, amount, 5);
    }

    // ---------------------------------------------------------------- deadlines (anyone)

    /// @notice Anyone can call. Late ship / late delivery / arbiter timeout -> full refund. Window over -> release.
    function finalize(uint256 id) external nonReentrant {
        Order storage o = _orders[id];
        State s = o.state;
        uint256 amount = o.amount;
        if (s == State.Funded) {
            if (block.timestamp <= o.shipBy) revert TooEarly();
            o.state = State.Refunded;
            _settle(o.buyer, amount, o.seller, 0, 0, amount);
            emit OrderRefunded(id, amount, 1);
        } else if (s == State.Shipped) {
            if (block.timestamp <= o.deliverBy) revert TooEarly();
            o.state = State.Refunded;
            _settle(o.buyer, amount, o.seller, 0, 0, amount);
            emit OrderRefunded(id, amount, 2);
        } else if (s == State.Delivered) {
            if (block.timestamp <= uint256(o.deliveredAt) + o.disputeWindow) revert TooEarly();
            o.state = State.Released;
            completed[o.seller] += 1;
            uint256 fee = (amount * feeBps) / BPS;
            _settle(o.buyer, 0, o.seller, amount - fee, fee, amount);
            emit OrderReleased(id, amount - fee, fee);
        } else if (s == State.Disputed) {
            if (block.timestamp <= uint256(o.disputedAt) + arbiterTimeout) revert TooEarly();
            o.state = State.Refunded;
            _settle(o.buyer, amount, o.seller, 0, 0, amount);
            emit OrderRefunded(id, amount, 4);
        } else {
            revert BadState();
        }
    }

    // ---------------------------------------------------------------- payouts (pull)

    function withdraw() external nonReentrant {
        _withdraw(msg.sender);
    }

    /// @notice Push an account's credit to that same account. Anyone may call (e.g. a keeper completing a refund).
    function withdrawFor(address account) external nonReentrant {
        _withdraw(account);
    }

    // ---------------------------------------------------------------- seller admin

    function revokeOffersBelow(uint256 version) external {
        if (version <= minOfferVersion[msg.sender]) revert BadOffer();
        minOfferVersion[msg.sender] = version;
        emit OffersRevoked(msg.sender, version);
    }

    // ---------------------------------------------------------------- views

    function getOrder(uint256 id) external view returns (Order memory) {
        return _orders[id];
    }

    function windowFor(address seller) public view returns (uint32) {
        return (completed[seller] >= trustedMinCompleted && lostDisputes[seller] == 0) ? shortWindow : longWindow;
    }

    function offerDigest(Offer calldata o) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(OFFER_TYPEHASH, o)));
    }

    function codeHashFor(bytes calldata code) external view returns (bytes32) {
        return keccak256(abi.encodePacked(block.chainid, address(this), code));
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ---------------------------------------------------------------- internal

    function _markDelivered(uint256 id, Order storage o, bool viaCode) internal {
        uint32 w = windowFor(o.seller);
        o.state = State.Delivered;
        o.deliveredAt = uint64(block.timestamp);
        o.disputeWindow = w;
        emit OrderDelivered(id, viaCode, w);
    }

    function _settle(
        address buyer,
        uint256 buyerAmount,
        address seller,
        uint256 sellerAmount,
        uint256 fee,
        uint256 amount
    ) internal {
        totalLocked -= amount;
        if (buyerAmount > 0) credit[buyer] += buyerAmount;
        if (sellerAmount > 0) credit[seller] += sellerAmount;
        if (fee > 0) credit[treasury] += fee;
        totalCredit += amount; // buyerAmount + sellerAmount + fee == amount
    }

    function _withdraw(address account) internal {
        uint256 amt = credit[account];
        if (amt == 0) revert NothingToWithdraw();
        credit[account] = 0;
        totalCredit -= amt;
        emit Withdrawn(account, amt);
        token.safeTransfer(account, amt);
    }
}
