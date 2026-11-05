// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Base} from "./Base.t.sol";
import {SellerRegistry} from "../src/SellerRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract SellerRegistryTest is Base {
    function test_Register_active() public view {
        assertTrue(registry.isActive(seller));
        (bytes32 h, uint8 tier, bool reg) = registry.sellers(seller);
        assertEq(h, HANDLE);
        assertEq(tier, 1);
        assertTrue(reg);
    }

    function test_Register_badSigner_reverts() public {
        address s = makeAddr("s2");
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 digest = registry.registrationDigest(s, keccak256("x"), 1, 7, deadline);
        (uint8 v, bytes32 r, bytes32 ss) = vm.sign(0xBAD, digest);
        vm.expectRevert(SellerRegistry.BadSignature.selector);
        registry.registerSeller(s, keccak256("x"), 1, 7, deadline, abi.encodePacked(r, ss, v));
    }

    function test_Register_replay_reverts() public {
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 digest = registry.registrationDigest(seller, HANDLE, 1, 5, deadline);
        (uint8 v, bytes32 r, bytes32 ss) = vm.sign(attestorPk, digest);
        bytes memory sig = abi.encodePacked(r, ss, v);
        registry.registerSeller(seller, HANDLE, 1, 5, deadline, sig);
        vm.expectRevert(SellerRegistry.AlreadyUsed.selector);
        registry.registerSeller(seller, HANDLE, 1, 5, deadline, sig);
    }

    function test_Register_handleTaken_reverts() public {
        address other = makeAddr("fakeMeera");
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 digest = registry.registrationDigest(other, HANDLE, 1, 9, deadline);
        (uint8 v, bytes32 r, bytes32 ss) = vm.sign(attestorPk, digest);
        vm.expectRevert(SellerRegistry.HandleTaken.selector);
        registry.registerSeller(other, HANDLE, 1, 9, deadline, abi.encodePacked(r, ss, v));
    }

    function test_Ban_isPermanent_walletAndHandle() public {
        vm.prank(arbiter);
        registry.ban(seller);
        assertFalse(registry.isActive(seller));

        // Same wallet cannot re-register.
        uint64 deadline = uint64(block.timestamp + 1 hours);
        bytes32 d1 = registry.registrationDigest(seller, HANDLE, 2, 2, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attestorPk, d1);
        vm.expectRevert(SellerRegistry.Banned.selector);
        registry.registerSeller(seller, HANDLE, 2, 2, deadline, abi.encodePacked(r, s, v));

        // New wallet cannot take the banned handle.
        address fresh = makeAddr("fresh");
        bytes32 d2 = registry.registrationDigest(fresh, HANDLE, 1, 3, deadline);
        (v, r, s) = vm.sign(attestorPk, d2);
        vm.expectRevert(SellerRegistry.Banned.selector);
        registry.registerSeller(fresh, HANDLE, 1, 3, deadline, abi.encodePacked(r, s, v));
    }

    function test_Ban_nonArbiter_reverts() public {
        bytes32 role = registry.ARBITER_ROLE();
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, role)
        );
        registry.ban(seller);
    }
}
