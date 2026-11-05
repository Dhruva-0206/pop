// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PoPCheckout, ISellerRegistry} from "../src/PoPCheckout.sol";
import {SellerRegistry} from "../src/SellerRegistry.sol";

/// @notice Deploys SellerRegistry + PoPCheckout against the token in USDT_ADDRESS (the specified Whitechain USDT).
/// Reads role keys from pop/.env only to derive ADDRESSES. Demo windows: 30 s trusted / 120 s default, 3 orders to trust, 300 s arbiter timeout.
/// Run from contracts/ in Git Bash:
///   source ../.env && forge script script/Deploy.s.sol --rpc-url $WHITECHAIN_RPC_URL --private-key $DEPLOYER_PK --broadcast \
///     --verify --verifier blockscout --verifier-url https://explorer.testnet.whitechain.io/api/
contract Deploy is Script {
    function run() external returns (SellerRegistry registry, PoPCheckout checkout) {
        address usdt = vm.envAddress("USDT_ADDRESS");
        address attestor = vm.addr(vm.envUint("ATTESTOR_PK"));
        address courier = vm.addr(vm.envUint("COURIER_PK"));
        address arbiter = vm.addr(vm.envUint("ARBITER_PK"));
        address admin = vm.addr(vm.envUint("DEPLOYER_PK"));
        address treasury = vm.envOr("TREASURY_ADDRESS", admin);
        uint16 feeBps = uint16(vm.envOr("FEE_BPS", uint256(100)));
        uint32 shortW = uint32(vm.envOr("SHORT_WINDOW", uint256(30)));
        uint32 longW = uint32(vm.envOr("LONG_WINDOW", uint256(120)));
        uint32 trustedMin = uint32(vm.envOr("TRUSTED_MIN", uint256(3)));
        uint32 arbiterTimeout = uint32(vm.envOr("ARBITER_TIMEOUT", uint256(300))); // production: 14 days

        require(usdt.code.length > 0, "USDT_ADDRESS has no code on this chain");

        vm.startBroadcast();
        registry = new SellerRegistry(admin, attestor, arbiter);
        checkout = new PoPCheckout(
            IERC20(usdt),
            ISellerRegistry(address(registry)),
            admin,
            courier,
            arbiter,
            treasury,
            feeBps,
            shortW,
            longW,
            trustedMin,
            arbiterTimeout
        );
        vm.stopBroadcast();

        console2.log("chainId", block.chainid);
        console2.log("SellerRegistry", address(registry));
        console2.log("PoPCheckout", address(checkout));
        console2.log("token", address(checkout.token()));
    }
}
