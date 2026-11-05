// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {PoPCheckout, ISellerRegistry} from "../src/PoPCheckout.sol";
import {SellerRegistry} from "../src/SellerRegistry.sol";
import {MockUSDT} from "./mocks/MockUSDT.sol";

abstract contract Base is Test {
    MockUSDT usdt;
    SellerRegistry registry;
    PoPCheckout checkout;

    uint256 attestorPk = 0xA77E;
    uint256 sellerPk = 0x5E11;
    address attestor;
    address seller;
    address admin = makeAddr("admin");
    address courier = makeAddr("courier");
    address arbiter = makeAddr("arbiter");
    address treasury = makeAddr("treasury");
    address buyer = makeAddr("buyer");
    address stranger = makeAddr("stranger");

    uint256 constant PRICE = 1_000_000; // 1.00 USDT at 6 decimals
    uint16 constant FEE_BPS = 100; // 1%
    uint32 constant SHORT_W = 30;
    uint32 constant LONG_W = 120;
    uint32 constant TRUSTED_MIN = 3;
    uint32 constant ARBITER_TIMEOUT = 300;
    uint32 constant SHIP_WITHIN = 180;
    uint32 constant DELIVER_WITHIN = 300;
    bytes constant CODE = "apple banana cherry dolphin eagle falcon";
    bytes32 constant HANDLE = keccak256("meera.jewels");

    function setUp() public virtual {
        attestor = vm.addr(attestorPk);
        seller = vm.addr(sellerPk);
        usdt = new MockUSDT();
        registry = new SellerRegistry(admin, attestor, arbiter);
        checkout = new PoPCheckout(
            usdt,
            ISellerRegistry(address(registry)),
            admin,
            courier,
            arbiter,
            treasury,
            FEE_BPS,
            SHORT_W,
            LONG_W,
            TRUSTED_MIN,
            ARBITER_TIMEOUT
        );
        _register(seller, HANDLE, 1, 1);
        usdt.mint(buyer, 100 * PRICE);
        vm.prank(buyer);
        usdt.approve(address(checkout), type(uint256).max);
    }

    // ------------------------------------------------------------ helpers

    function _register(address s, bytes32 handle, uint8 tier, uint256 nonce) internal {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 digest = registry.registrationDigest(s, handle, tier, nonce, deadline);
        (uint8 v, bytes32 r, bytes32 ss) = vm.sign(attestorPk, digest);
        registry.registerSeller(s, handle, tier, nonce, deadline, abi.encodePacked(r, ss, v));
    }

    function _offer() internal view returns (PoPCheckout.Offer memory o) {
        o = PoPCheckout.Offer({
            seller: seller,
            listingId: keccak256("jhumka-01"),
            termsHash: keccak256("terms-v1"),
            externalRef: bytes32(0),
            price: PRICE,
            shipWithin: SHIP_WITHIN,
            deliverWithin: DELIVER_WITHIN,
            maxUnits: 10,
            validUntil: uint64(block.timestamp + 1 days),
            version: 1
        });
    }

    function _sign(PoPCheckout.Offer memory o, uint256 pk) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, checkout.offerDigest(o));
        return abi.encodePacked(r, s, v);
    }

    function _codeHash(bytes memory code) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(block.chainid, address(checkout), code));
    }

    function _pay() internal returns (uint256 id) {
        PoPCheckout.Offer memory o = _offer();
        bytes memory sig = _sign(o, sellerPk);
        vm.prank(buyer);
        id = checkout.pay(o, sig, _codeHash(CODE));
    }

    function _payAndShip() internal returns (uint256 id) {
        id = _pay();
        vm.prank(seller);
        checkout.markShipped(id, keccak256("TRACK123"));
    }

    function _state(uint256 id) internal view returns (PoPCheckout.State) {
        return checkout.getOrder(id).state;
    }

    /// Token held by the contract always covers open orders plus unpaid credit.
    function _assertSolvent() internal view {
        assertGe(usdt.balanceOf(address(checkout)), checkout.totalLocked() + checkout.totalCredit(), "insolvent");
    }
}
