// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Base} from "./Base.t.sol";
import {PoPCheckout} from "../src/PoPCheckout.sol";

/// Arbiter force-refund of open orders for a banned seller, and the no-self-purchase rule.
contract ForceRefundAndSelfPurchaseTest is Base {
    function _ban() internal {
        vm.prank(arbiter);
        registry.ban(seller);
    }

    function _force(uint256 id) internal {
        vm.prank(arbiter);
        checkout.forceRefundBanned(id);
    }

    function _assertFullRefundToBuyer(uint256 id) internal view {
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Refunded));
        assertEq(checkout.credit(buyer), PRICE, "buyer credited in full");
        assertEq(checkout.credit(seller), 0, "seller gets nothing");
        assertEq(checkout.credit(treasury), 0, "no fee on a forced refund");
        assertEq(checkout.totalLocked(), 0);
        _assertSolvent();
    }

    // ------------------------------------------------------------ force refund: every open state

    function test_ForceRefund_funded() public {
        uint256 id = _pay();
        _ban();
        vm.expectEmit(true, false, false, true, address(checkout));
        emit PoPCheckout.OrderRefunded(id, PRICE, 5);
        _force(id);
        _assertFullRefundToBuyer(id);
    }

    /// Direct accounting delta: totalLocked falls and totalCredit rises by exactly the order amount, nothing else moves.
    function test_ForceRefund_accountingDelta_exact() public {
        uint256 id = _payAndShip();
        _ban();
        uint256 lockedBefore = checkout.totalLocked();
        uint256 creditBefore = checkout.totalCredit();
        uint256 balBefore = usdt.balanceOf(address(checkout));
        assertEq(lockedBefore, PRICE);
        assertEq(creditBefore, 0);
        _force(id);
        assertEq(lockedBefore - checkout.totalLocked(), PRICE, "locked down by exactly the amount");
        assertEq(checkout.totalCredit() - creditBefore, PRICE, "credit up by exactly the amount");
        assertEq(usdt.balanceOf(address(checkout)), balBefore, "no tokens leave the contract on a force refund");
    }

    function test_ForceRefund_shipped() public {
        uint256 id = _payAndShip();
        _ban();
        _force(id);
        _assertFullRefundToBuyer(id);
    }

    /// Team decision: Delivered orders are NOT force-refundable. The buyer confirmed receipt; the normal
    /// dispute window (openDispute / resolveDispute) is the remedy, and finalize pays the seller afterwards.
    function test_ForceRefund_delivered_reverts_andOrderSettlesNormally() public {
        uint256 id = _payAndShip();
        vm.prank(buyer);
        checkout.confirmReceived(id);
        _ban();
        vm.prank(arbiter);
        vm.expectRevert(PoPCheckout.BadState.selector);
        checkout.forceRefundBanned(id);
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Delivered));
        vm.warp(block.timestamp + LONG_W + 1);
        checkout.finalize(id);
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Released));
        assertGt(checkout.credit(seller), 0);
        _assertSolvent();
    }

    function test_ForceRefund_delivered_buyerDisputeThenArbiter() public {
        uint256 id = _payAndShip();
        vm.prank(buyer);
        checkout.confirmReceived(id);
        _ban();
        vm.prank(buyer);
        checkout.openDispute(id, keccak256("photo")); // Disputed: now force-refundable
        _force(id);
        _assertFullRefundToBuyer(id);
    }

    function test_ForceRefund_disputed() public {
        uint256 id = _payAndShip();
        vm.prank(courier);
        checkout.reportHandoverRefused(id);
        _ban();
        _force(id);
        _assertFullRefundToBuyer(id);
    }

    function test_ForceRefund_buyerCanWithdraw() public {
        uint256 id = _pay();
        _ban();
        _force(id);
        uint256 before = usdt.balanceOf(buyer);
        vm.prank(buyer);
        checkout.withdraw();
        assertEq(usdt.balanceOf(buyer), before + PRICE);
        _assertSolvent();
    }

    // ------------------------------------------------------------ force refund: what it must NOT do

    function test_ForceRefund_sellerNotBanned_reverts() public {
        uint256 id = _pay();
        vm.prank(arbiter);
        vm.expectRevert(PoPCheckout.SellerNotBanned.selector);
        checkout.forceRefundBanned(id);
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Funded));
    }

    function test_ForceRefund_nonArbiter_reverts() public {
        uint256 id = _pay();
        _ban();
        vm.prank(stranger);
        vm.expectRevert();
        checkout.forceRefundBanned(id);
        vm.prank(courier);
        vm.expectRevert(); // the courier role cannot do it either
        checkout.forceRefundBanned(id);
        vm.prank(seller);
        vm.expectRevert();
        checkout.forceRefundBanned(id);
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Funded));
    }

    function test_ForceRefund_unknownOrder_reverts() public {
        _ban();
        vm.prank(arbiter);
        vm.expectRevert(PoPCheckout.BadState.selector);
        checkout.forceRefundBanned(999);
    }

    function test_ForceRefund_twice_reverts_oneTerminalState() public {
        uint256 id = _pay();
        _ban();
        _force(id);
        vm.prank(arbiter);
        vm.expectRevert(PoPCheckout.BadState.selector);
        checkout.forceRefundBanned(id);
        _assertFullRefundToBuyer(id); // unchanged, credited once
    }

    function test_ForceRefund_afterRelease_reverts_sellerKeepsPayout() public {
        uint256 id = _payAndShip();
        vm.prank(buyer);
        checkout.confirmReceived(id);
        vm.warp(block.timestamp + LONG_W + 1);
        checkout.finalize(id); // Released
        _ban();
        vm.prank(arbiter);
        vm.expectRevert(PoPCheckout.BadState.selector);
        checkout.forceRefundBanned(id);
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Released));
    }

    function test_ForceRefund_afterRefund_reverts() public {
        uint256 id = _pay();
        vm.warp(block.timestamp + SHIP_WITHIN + 1);
        checkout.finalize(id); // Refunded (late ship)
        _ban();
        vm.prank(arbiter);
        vm.expectRevert(PoPCheckout.BadState.selector);
        checkout.forceRefundBanned(id);
        assertEq(checkout.credit(buyer), PRICE, "credited once only");
    }

    function test_ForceRefund_afterResolve_reverts() public {
        uint256 id = _payAndShip();
        vm.prank(courier);
        checkout.reportHandoverRefused(id);
        vm.prank(arbiter);
        checkout.resolveDispute(id, 5_000, bytes32(0)); // Split
        _ban();
        vm.prank(arbiter);
        vm.expectRevert(PoPCheckout.BadState.selector);
        checkout.forceRefundBanned(id);
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Split));
    }

    function test_ForceRefund_onlyAffectsBannedSellersOrders() public {
        // second seller, not banned
        uint256 otherPk = 0xB0B;
        address other = vm.addr(otherPk);
        _register(other, keccak256("other.seller"), 1, 2);
        PoPCheckout.Offer memory o = _offer();
        o.seller = other;
        bytes memory sig = _sign(o, otherPk);
        vm.prank(buyer);
        uint256 otherId = checkout.pay(o, sig, _codeHash(CODE));
        uint256 id = _pay();
        _ban();
        _force(id);
        vm.prank(arbiter);
        vm.expectRevert(PoPCheckout.SellerNotBanned.selector);
        checkout.forceRefundBanned(otherId);
        assertEq(uint8(_state(otherId)), uint8(PoPCheckout.State.Funded));
    }

    function test_ForceRefund_bannedSellerCanStillNotBeReleasedLater() public {
        // After ban + force refund the order can't be finalized into a release.
        uint256 id = _payAndShip();
        _ban();
        _force(id);
        vm.warp(block.timestamp + LONG_W + 1);
        vm.expectRevert(PoPCheckout.BadState.selector);
        checkout.finalize(id);
        _assertSolvent();
    }

    // ------------------------------------------------------------ no self-purchase

    function test_Pay_sellerCannotBuyOwnOffer() public {
        usdt.mint(seller, 10 * PRICE);
        vm.prank(seller);
        usdt.approve(address(checkout), type(uint256).max);
        PoPCheckout.Offer memory o = _offer();
        bytes memory sig = _sign(o, sellerPk);
        vm.prank(seller);
        vm.expectRevert(PoPCheckout.SelfPurchase.selector);
        checkout.pay(o, sig, _codeHash(CODE));
        assertEq(checkout.nextOrderId(), 0);
        assertEq(usdt.balanceOf(address(checkout)), 0);
    }

    function test_Pay_otherBuyerStillWorks() public {
        uint256 id = _pay();
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Funded));
    }
}
