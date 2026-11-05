// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice EIP-712 domain constants. The product name must match `APP_NAME` in packages/shared/src/config.ts.
/// Change both together, and only before the first testnet deploy.
library PoPConfig {
    string internal constant DOMAIN_NAME = "PoP";
    string internal constant DOMAIN_VERSION = "1";
}
