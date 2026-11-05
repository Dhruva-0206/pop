// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Base} from "./Base.t.sol";
import {PoPCheckout} from "../src/PoPCheckout.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract PoPCheckoutTest is Base {
    // ------------------------------------------------------------ happy paths

    function test_HappyPath_codeAtDoor_release_withdraw() public {
        uint256 id = _payAndShip();
        assertEq(usdt.balanceOf(address(checkout)), PRICE);

        vm.prank(courier);
        checkout.confirmDelivery(id, CODE);
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Delivered));

        vm.warp(block.timestamp + LONG_W + 1);
        vm.prank(stranger); // anyone can finalize
        checkout.finalize(id);
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Released));

        uint256 fee = (PRICE * FEE_BPS) / 10_000;
        assertEq(checkout.credit(seller), PRICE - fee);
        assertEq(checkout.credit(treasury), fee);
        assertEq(checkout.completed(seller), 1);

        vm.prank(seller);
        checkout.withdraw();
        assertEq(usdt.balanceOf(seller), PRICE - fee);
        _assertSolvent();
    }

    function test_ConfirmReceived_byBuyer_release() public {
        uint256 id = _payAndShip();
        vm.prank(buyer);
        checkout.confirmReceived(id);
        vm.warp(block.timestamp + LONG_W + 1);
        checkout.finalize(id);
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Released));
    }

    // ------------------------------------------------------------ delivery code

    function test_WrongCode_reverts() public {
        uint256 id = _payAndShip();
        vm.prank(courier);
        vm.expectRevert(PoPCheckout.BadCode.selector);
        checkout.confirmDelivery(id, "apple banana cherry dolphin eagle WRONG");
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Shipped));
    }

    function test_CodeFromAnotherOrder_reverts() public {
        uint256 a = _payAndShip();
        // Order B uses a different code.
        PoPCheckout.Offer memory o = _offer();
        bytes memory sig = _sign(o, sellerPk);
        vm.prank(buyer);
        uint256 b = checkout.pay(o, sig, _codeHash("zebra yak xray walrus vulture urchin"));
        vm.prank(seller);
        checkout.markShipped(b, bytes32(0));

        checkout.confirmDelivery(a, CODE);
        vm.expectRevert(PoPCheckout.BadCode.selector);
        checkout.confirmDelivery(b, CODE); // replaying A's (now public) code fails on B
    }

    function test_ConfirmReceived_nonBuyer_reverts() public {
        uint256 id = _payAndShip();
        vm.prank(seller);
        vm.expectRevert(PoPCheckout.NotBuyer.selector);
        checkout.confirmReceived(id);
    }

    // ------------------------------------------------------------ deadline refunds

    function test_LateShip_refund_byAnyone() public {
        uint256 id = _pay();
        vm.warp(block.timestamp + SHIP_WITHIN + 1);
        vm.prank(stranger);
        checkout.finalize(id);
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Refunded));
        assertEq(checkout.credit(buyer), PRICE);

        uint256 before = usdt.balanceOf(buyer);
        vm.prank(stranger);
        checkout.withdrawFor(buyer); // a keeper can complete the refund; money only goes to the buyer
        assertEq(usdt.balanceOf(buyer), before + PRICE);
        _assertSolvent();
    }

    function test_LateShip_sellerCannotShipAfterDeadline() public {
        uint256 id = _pay();
        vm.warp(block.timestamp + SHIP_WITHIN + 1);
        vm.prank(seller);
        vm.expectRevert(PoPCheckout.TooLate.selector);
        checkout.markShipped(id, bytes32(0));
    }

    function test_LateDelivery_refund() public {
        uint256 id = _payAndShip();
        vm.warp(block.timestamp + DELIVER_WITHIN + 1);
        checkout.finalize(id);
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Refunded));
        assertEq(checkout.credit(buyer), PRICE);
        assertEq(checkout.credit(seller), 0);
        _assertSolvent();
    }

    function test_Finalize_beforeDeadline_reverts() public {
        uint256 id = _pay();
        vm.expectRevert(PoPCheckout.TooEarly.selector);
        checkout.finalize(id);
        vm.prank(seller);
        checkout.markShipped(id, bytes32(0));
        vm.expectRevert(PoPCheckout.TooEarly.selector);
        checkout.finalize(id);
    }

    // ------------------------------------------------------------ courier can't move money

    function test_Courier_cannotRelease() public {
        uint256 id = _payAndShip();
        vm.startPrank(courier);
        vm.expectRevert(PoPCheckout.BadCode.selector);
        checkout.confirmDelivery(id, "guessing words");
        vm.expectRevert(PoPCheckout.TooEarly.selector);
        checkout.finalize(id);
        vm.expectRevert(PoPCheckout.NotBuyer.selector);
        checkout.confirmReceived(id);
        vm.expectRevert(PoPCheckout.NothingToWithdraw.selector);
        checkout.withdraw();
        vm.stopPrank();
        assertEq(checkout.credit(seller), 0);
        assertEq(checkout.credit(courier), 0);
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Shipped));
    }

    function test_Courier_handoverRefused_onlyDisputes() public {
        uint256 id = _payAndShip();
        vm.prank(courier);
        checkout.reportHandoverRefused(id);
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Disputed));
        assertEq(checkout.credit(seller), 0);
        assertEq(checkout.credit(buyer), 0);
        assertEq(checkout.totalLocked(), PRICE);
    }

    function test_Courier_cannotBlockLateDeliveryRefund() public {
        uint256 id = _payAndShip();
        vm.warp(block.timestamp + DELIVER_WITHIN + 1);
        vm.prank(courier);
        vm.expectRevert(PoPCheckout.TooLate.selector);
        checkout.reportHandoverRefused(id);
        checkout.finalize(id);
        assertEq(checkout.credit(buyer), PRICE);
    }

    function test_NonCourier_cannotReportRefused() public {
        uint256 id = _payAndShip();
        bytes32 role = checkout.COURIER_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, role)
        );
        checkout.reportHandoverRefused(id);
    }

    // ------------------------------------------------------------ disputes

    function test_NonArbiter_cannotResolve() public {
        uint256 id = _payAndShip();
        vm.prank(courier);
        checkout.reportHandoverRefused(id);
        bytes32 role = checkout.ARBITER_ROLE();
        address[3] memory who = [courier, seller, buyer];
        for (uint256 i; i < who.length; i++) {
            vm.prank(who[i]);
            vm.expectRevert(
                abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, who[i], role)
            );
            checkout.resolveDispute(id, 10_000, bytes32(0));
        }
    }

    function test_Arbiter_refund_countsLostDispute() public {
        uint256 id = _payAndShip();
        vm.prank(courier);
        checkout.reportHandoverRefused(id);
        vm.prank(arbiter);
        checkout.resolveDispute(id, 10_000, keccak256("decision"));
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Refunded));
        assertEq(checkout.credit(buyer), PRICE);
        assertEq(checkout.lostDisputes(seller), 1);
        _assertSolvent();
    }

    function test_Arbiter_split() public {
        uint256 id = _payAndShip();
        vm.prank(buyer);
        checkout.confirmReceived(id);
        vm.prank(buyer);
        checkout.openDispute(id, keccak256("photo"));
        vm.prank(arbiter);
        checkout.resolveDispute(id, 4_000, bytes32(0));
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Split));
        uint256 toBuyer = (PRICE * 4_000) / 10_000;
        uint256 gross = PRICE - toBuyer;
        uint256 fee = (gross * FEE_BPS) / 10_000;
        assertEq(checkout.credit(buyer), toBuyer);
        assertEq(checkout.credit(seller), gross - fee);
        assertEq(checkout.credit(treasury), fee);
        assertEq(checkout.lostDisputes(seller), 0);
        _assertSolvent();
    }

    function test_OpenDispute_afterWindow_reverts() public {
        uint256 id = _payAndShip();
        vm.prank(buyer);
        checkout.confirmReceived(id);
        vm.warp(block.timestamp + LONG_W + 1);
        vm.prank(buyer);
        vm.expectRevert(PoPCheckout.TooLate.selector);
        checkout.openDispute(id, bytes32(0));
    }

    function test_OpenDispute_nonBuyer_reverts() public {
        uint256 id = _payAndShip();
        vm.prank(buyer);
        checkout.confirmReceived(id);
        vm.prank(stranger);
        vm.expectRevert(PoPCheckout.NotBuyer.selector);
        checkout.openDispute(id, bytes32(0));
    }

    // ------------------------------------------------------------ offer integrity

    function test_TamperedOfferPrice_reverts() public {
        PoPCheckout.Offer memory o = _offer();
        bytes memory sig = _sign(o, sellerPk);
        o.price = 1; // buyer tries to pay less
        vm.prank(buyer);
        vm.expectRevert(PoPCheckout.BadSignature.selector);
        checkout.pay(o, sig, _codeHash(CODE));
    }

    function test_TamperedDeadline_reverts() public {
        PoPCheckout.Offer memory o = _offer();
        bytes memory sig = _sign(o, sellerPk);
        o.shipWithin = 365 days;
        vm.prank(buyer);
        vm.expectRevert(PoPCheckout.BadSignature.selector);
        checkout.pay(o, sig, _codeHash(CODE));
    }

    function test_ExpiredOffer_reverts() public {
        PoPCheckout.Offer memory o = _offer();
        bytes memory sig = _sign(o, sellerPk);
        vm.warp(o.validUntil + 1);
        vm.prank(buyer);
        vm.expectRevert(PoPCheckout.OfferExpired.selector);
        checkout.pay(o, sig, _codeHash(CODE));
    }

    function test_RevokedOffer_reverts() public {
        PoPCheckout.Offer memory o = _offer();
        bytes memory sig = _sign(o, sellerPk);
        vm.prank(seller);
        checkout.revokeOffersBelow(2);
        vm.prank(buyer);
        vm.expectRevert(PoPCheckout.OfferRevoked.selector);
        checkout.pay(o, sig, _codeHash(CODE));
    }

    function test_OverStock_reverts() public {
        PoPCheckout.Offer memory o = _offer();
        o.maxUnits = 1;
        bytes memory sig = _sign(o, sellerPk);
        vm.startPrank(buyer);
        checkout.pay(o, sig, _codeHash(CODE));
        vm.expectRevert(PoPCheckout.SoldOut.selector);
        checkout.pay(o, sig, _codeHash(CODE));
        vm.stopPrank();
    }

    function test_BannedSeller_cannotSell() public {
        vm.prank(arbiter);
        registry.ban(seller);
        PoPCheckout.Offer memory o = _offer();
        bytes memory sig = _sign(o, sellerPk);
        vm.prank(buyer);
        vm.expectRevert(PoPCheckout.SellerNotActive.selector);
        checkout.pay(o, sig, _codeHash(CODE));
    }

    // ------------------------------------------------------------ payouts

    function test_DoubleWithdraw_reverts() public {
        uint256 id = _pay();
        vm.warp(block.timestamp + SHIP_WITHIN + 1);
        checkout.finalize(id);
        vm.startPrank(buyer);
        checkout.withdraw();
        vm.expectRevert(PoPCheckout.NothingToWithdraw.selector);
        checkout.withdraw();
        vm.stopPrank();
        _assertSolvent();
    }

    function test_DoubleFinalize_reverts() public {
        uint256 id = _pay();
        vm.warp(block.timestamp + SHIP_WITHIN + 1);
        checkout.finalize(id);
        vm.expectRevert(PoPCheckout.BadState.selector);
        checkout.finalize(id);
    }

    // ------------------------------------------------------------ reputation-tiered window

    function test_TrustedSeller_getsShortWindow() public {
        assertEq(checkout.windowFor(seller), LONG_W);
        for (uint256 i; i < TRUSTED_MIN; i++) {
            uint256 id = _payAndShip();
            checkout.confirmDelivery(id, CODE);
            vm.warp(block.timestamp + LONG_W + 1);
            checkout.finalize(id);
        }
        assertEq(checkout.windowFor(seller), SHORT_W);
    }

    // ------------------------------------------------------------ fuzz

    function testFuzz_ResolveSplit_conservesFunds(uint16 bps) public {
        bps = uint16(bound(bps, 0, 10_000));
        uint256 id = _payAndShip();
        vm.prank(courier);
        checkout.reportHandoverRefused(id);
        vm.prank(arbiter);
        checkout.resolveDispute(id, bps, bytes32(0));
        assertEq(checkout.credit(buyer) + checkout.credit(seller) + checkout.credit(treasury), PRICE);
        assertEq(checkout.totalLocked(), 0);
        _assertSolvent();
    }
}
