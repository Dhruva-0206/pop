// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {PoPCheckout, ISellerRegistry} from "../../src/PoPCheckout.sol";
import {SellerRegistry} from "../../src/SellerRegistry.sol";
import {MockUSDT} from "../mocks/MockUSDT.sol";

/// @notice Drives random sequences of every public action against one checkout.
contract Handler is Test {
    PoPCheckout public checkout;
    SellerRegistry public registry;
    MockUSDT public usdt;
    uint256 internal sellerPk;
    address public seller;
    address public courier;
    address public arbiter;
    address public treasury;
    address[3] public buyers;

    uint256[] public ids;
    mapping(uint256 => bytes) internal codeOf;
    mapping(uint256 => PoPCheckout.State) public firstTerminal; // None until the order ends
    bool public terminalChanged; // set if an ended order ever changes state
    bool public courierRaisedCredit; // set if a courier call raised anyone's credit
    bool public forcedRefundedDelivered; // set if forceRefundBanned ever succeeded on a Delivered order
    uint256 public nonce;

    constructor(
        PoPCheckout c,
        SellerRegistry r,
        MockUSDT u,
        uint256 sellerPk_,
        address courier_,
        address arbiter_,
        address treasury_
    ) {
        checkout = c;
        registry = r;
        usdt = u;
        sellerPk = sellerPk_;
        seller = vm.addr(sellerPk_);
        courier = courier_;
        arbiter = arbiter_;
        treasury = treasury_;
        for (uint256 i; i < 3; i++) {
            buyers[i] = makeAddr(string(abi.encodePacked("inv-buyer", vm.toString(i))));
            u.mint(buyers[i], 1e15);
            vm.prank(buyers[i]);
            u.approve(address(c), type(uint256).max);
        }
    }

    function idCount() external view returns (uint256) {
        return ids.length;
    }

    function accounts() public view returns (address[6] memory a) {
        a = [seller, treasury, buyers[0], buyers[1], buyers[2], courier];
    }

    function _pick(uint256 seed) internal view returns (uint256 id, bool ok) {
        if (ids.length == 0) return (0, false);
        return (ids[seed % ids.length], true);
    }

    function _track() internal {
        for (uint256 i; i < ids.length; i++) {
            PoPCheckout.State s = checkout.getOrder(ids[i]).state;
            bool terminal =
                s == PoPCheckout.State.Released || s == PoPCheckout.State.Refunded || s == PoPCheckout.State.Split;
            PoPCheckout.State prev = firstTerminal[ids[i]];
            if (prev != PoPCheckout.State.None && prev != s) terminalChanged = true;
            if (terminal && prev == PoPCheckout.State.None) firstTerminal[ids[i]] = s;
        }
    }

    // ------------------------------------------------------------ actions

    function pay(uint256 buyerSeed, uint256 price, uint32 shipWithin, uint32 deliverWithin) external {
        price = bound(price, 1, 1e12);
        shipWithin = uint32(bound(shipWithin, 1, 1 days));
        deliverWithin = uint32(bound(deliverWithin, 1, 1 days));
        PoPCheckout.Offer memory o = PoPCheckout.Offer({
            seller: seller,
            listingId: keccak256(abi.encode(nonce)),
            termsHash: bytes32(0),
            externalRef: bytes32(0),
            price: price,
            shipWithin: shipWithin,
            deliverWithin: deliverWithin,
            maxUnits: 1,
            validUntil: uint64(block.timestamp + 1),
            version: 1
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(sellerPk, checkout.offerDigest(o));
        bytes memory code = abi.encodePacked("code-", vm.toString(nonce++));
        bytes32 codeHash = keccak256(abi.encodePacked(block.chainid, address(checkout), code));
        vm.prank(buyers[buyerSeed % 3]);
        uint256 id = checkout.pay(o, abi.encodePacked(r, s, v), codeHash);
        ids.push(id);
        codeOf[id] = code;
        _track();
    }

    function ship(uint256 seed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        vm.prank(seller);
        try checkout.markShipped(id, bytes32(0)) {} catch {}
        _track();
    }

    function deliverWithCode(uint256 seed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        try checkout.confirmDelivery(id, codeOf[id]) {} catch {}
        _track();
    }

    function buyerConfirms(uint256 seed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        vm.prank(checkout.getOrder(id).buyer);
        try checkout.confirmReceived(id) {} catch {}
        _track();
    }

    /// Courier does everything it can; record if any credit went up.
    function courierActs(uint256 seed, uint8 what) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        address[6] memory a = accounts();
        uint256[6] memory before;
        for (uint256 i; i < 6; i++) {
            before[i] = checkout.credit(a[i]);
        }
        vm.startPrank(courier);
        if (what % 3 == 0) {
            try checkout.reportHandoverRefused(id) {} catch {}
        } else if (what % 3 == 1) {
            try checkout.confirmDelivery(id, "wrong code") {} catch {}
        } else {
            try checkout.confirmReceived(id) {} catch {}
        }
        vm.stopPrank();
        for (uint256 i; i < 6; i++) {
            if (checkout.credit(a[i]) > before[i]) courierRaisedCredit = true;
        }
        _track();
    }

    function buyerDisputes(uint256 seed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        vm.prank(checkout.getOrder(id).buyer);
        try checkout.openDispute(id, bytes32(0)) {} catch {}
        _track();
    }

    function arbiterResolves(uint256 seed, uint16 bps) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        vm.prank(arbiter);
        try checkout.resolveDispute(id, uint16(bound(bps, 0, 10_000)), bytes32(0)) {} catch {}
        _track();
    }

    /// Bans are permanent and stop all later pays, so only ban rarely (1 in 16 calls) to keep coverage of the rest.
    function arbiterBans(uint256 seed) external {
        if (seed % 16 != 0) return;
        vm.prank(arbiter);
        try registry.ban(seller) {} catch {}
    }

    function arbiterForceRefunds(uint256 seed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        PoPCheckout.State before = checkout.getOrder(id).state;
        vm.prank(arbiter);
        try checkout.forceRefundBanned(id) {
            if (before == PoPCheckout.State.Delivered) forcedRefundedDelivered = true;
        } catch {}
        _track();
    }

    function finalize(uint256 seed) external {
        (uint256 id, bool ok) = _pick(seed);
        if (!ok) return;
        try checkout.finalize(id) {} catch {}
        _track();
    }

    function withdraw(uint256 who) external {
        address a = accounts()[who % 5];
        if (checkout.credit(a) == 0) return;
        checkout.withdrawFor(a);
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 2 days));
    }
}

contract PoPInvariantTest is Test {
    Handler handler;
    PoPCheckout checkout;
    MockUSDT usdt;
    uint32 constant LONG_W = 120;
    uint32 constant ARBITER_TIMEOUT = 300;

    function setUp() public {
        uint256 attestorPk = 0xA77E;
        uint256 sellerPk = 0x5E11;
        address courier = makeAddr("courier");
        address arbiter = makeAddr("arbiter");
        address treasury = makeAddr("treasury");
        usdt = new MockUSDT();
        SellerRegistry registry = new SellerRegistry(address(this), vm.addr(attestorPk), arbiter);
        checkout = new PoPCheckout(
            usdt,
            ISellerRegistry(address(registry)),
            address(this),
            courier,
            arbiter,
            treasury,
            100,
            30,
            LONG_W,
            3,
            ARBITER_TIMEOUT
        );
        uint64 deadline = uint64(block.timestamp + 1 hours);
        address seller = vm.addr(sellerPk);
        bytes32 digest = registry.registrationDigest(seller, keccak256("inv"), 1, 1, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorPk, digest);
        registry.registerSeller(seller, keccak256("inv"), 1, 1, deadline, abi.encodePacked(r, s, v));

        handler = new Handler(checkout, registry, usdt, sellerPk, courier, arbiter, treasury);
        targetContract(address(handler));
    }

    /// Token held == open order amounts + credited balances (credits include fees and refunds).
    function invariant_balanceEqualsLockedPlusCredit() public view {
        assertEq(usdt.balanceOf(address(checkout)), checkout.totalLocked() + checkout.totalCredit());

        uint256 openSum;
        for (uint256 i; i < handler.idCount(); i++) {
            PoPCheckout.Order memory o = checkout.getOrder(handler.ids(i));
            if (
                o.state == PoPCheckout.State.Funded || o.state == PoPCheckout.State.Shipped
                    || o.state == PoPCheckout.State.Delivered || o.state == PoPCheckout.State.Disputed
            ) openSum += o.amount;
        }
        assertEq(openSum, checkout.totalLocked(), "locked != open orders");

        address[6] memory a = handler.accounts();
        uint256 creditSum;
        for (uint256 i; i < 6; i++) {
            creditSum += checkout.credit(a[i]);
        }
        assertEq(creditSum, checkout.totalCredit(), "credits != totalCredit");
    }

    function invariant_courierNeverRaisesCredit() public view {
        assertFalse(handler.courierRaisedCredit());
        assertEq(checkout.credit(handler.courier()), 0);
    }

    /// Team decision: a Delivered order is never force-refunded (only Funded, Shipped, Disputed).
    function invariant_forceRefundNeverTouchesDelivered() public view {
        assertFalse(handler.forcedRefundedDelivered());
    }

    function invariant_exactlyOneTerminalState() public view {
        assertFalse(handler.terminalChanged());
    }

    /// From any reachable state, enough time + `finalize` by anyone ends every open order.
    function invariant_noOrderLockedForever() public {
        uint256 snap = vm.snapshotState();
        vm.warp(block.timestamp + 2 days + 2 days + LONG_W + ARBITER_TIMEOUT + 10);
        for (uint256 i; i < handler.idCount(); i++) {
            uint256 id = handler.ids(i);
            PoPCheckout.State s = checkout.getOrder(id).state;
            if (s == PoPCheckout.State.Released || s == PoPCheckout.State.Refunded || s == PoPCheckout.State.Split) {
                continue;
            }
            checkout.finalize(id); // must not revert
            s = checkout.getOrder(id).state;
            assertTrue(s == PoPCheckout.State.Released || s == PoPCheckout.State.Refunded, "still open");
        }
        assertEq(checkout.totalLocked(), 0);
        vm.revertToState(snap);
    }
}
