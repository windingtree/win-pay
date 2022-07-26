// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.13;

import {Asset} from '../Asset.sol';
import {LedgerLike, WrappedErc20Like} from '../interfaces/Common.sol';
import {Upgradeable} from './Upgradeable.sol';

contract AssetUpgradeableV1 is Upgradeable, Asset {
  constructor(
    address _ledger,
    address _asset,
    uint256 _wrapped
  ) Asset(_ledger, _asset, _wrapped) {}

  function postUpgrade(
    address _ledger,
    address _asset,
    uint256 _wrapped
  ) public onlyUpgrader {
    auth[msg.sender] = 1;
    live = 1;
    ledger = LedgerLike(_ledger);
    wrapped = _wrapped;
    asset = WrappedErc20Like(_asset);
    emit Rely(msg.sender);
  }

  uint256[50] private __gap;
}
