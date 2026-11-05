// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Base} from "./Base.t.sol";
import {PoPCheckout} from "../src/PoPCheckout.sol";

contract ArbiterTimeoutTest is Base {
    function _disputed() internal returns (uint256 id) {
        id = _payAndShip();
        vm.prank(courier);
        checkout.reportHandoverRefused(id);
    }

    function test_ArbiterTimeout_refundsBuyer_byAnyone() public {
        uint256 id = _disputed();
        vm.warp(block.timestamp + ARBITER_TIMEOUT + 1);
        vm.expectEmit(true, false, false, true, address(checkout));
        emit PoPCheckout.OrderRefunded(id, PRICE, 4);
        vm.prank(stranger);
        checkout.finalize(id);
        assertEq(uint8(_state(id)), uint8(PoPCheckout.State.Refunded));
        assertEq(checkout.credit(buyer), PRICE);
        assertEq(checkout.credit(seller), 0);
        _assertSolvent();
    }

    function test_ArbiterTimeout_beforeTimeout_reverts() public {
        uint256 id = _disputed();
        vm.warp(block.timestamp + ARBITER_TIMEOUT);
        vm.expectRevert(PoPCheckout.TooEarly.selector);
        checkout.finalize(id);
    }

    function test_ArbiterTimeout_appliesToBuyerOpenedDispute() public {
        uint256 id = _payAndShip();
        vm.prank(buyer);
        checkout.confirmReceived(id);
        vm.prank(buyer);
        checkout.openDispute(id, keccak256("photo"));
        vm.warp(block.timestamp + ARBITER_TIMEOUT + 1);
        checkout.finalize(id);
        assertEq(checkout.credit(buyer), PRICE);
    }

    function test_Arbiter_cannotResolveAfterTimeout() public {
        uint256 id = _disputed();
        vm.warp(block.timestamp + ARBITER_TIMEOUT + 1);
        vm.prank(arbiter);
        vm.expectRevert(PoPCheckout.TooLate.selector);
        checkout.resolveDispute(id, 0, bytes32(0)); // can't race the refund with a release
    }

    function test_Arbiter_canResolveBeforeTimeout_thenNoTimeoutRefund() public {
        uint256 id = _disputed();
        vm.prank(arbiter);
        checkout.resolveDispute(id, 0, bytes32(0));
        vm.warp(block.timestamp + ARBITER_TIMEOUT + 1);
        vm.expectRevert(PoPCheckout.BadState.selector);
        checkout.finalize(id);
    }
}
