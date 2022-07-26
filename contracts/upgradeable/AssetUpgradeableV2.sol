// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import {LedgerLike, WrappedErc20Like} from '../interfaces/Common.sol';
import {ExitSelfable} from '../ExitSelfable.sol';
import {AssetUpgradeableV1} from './AssetUpgradeableV1.sol';

contract AssetUpgradeableV2 is AssetUpgradeableV1, ExitSelfable {
  constructor(
    address _ledger,
    address _asset,
    uint256 _wrapped
  ) AssetUpgradeableV1(_ledger, _asset, _wrapped) {}

  function postUpgrade() public onlyUpgrader {}

  uint256[50] private __gap;
}
