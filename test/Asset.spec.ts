import { expect } from './chai-setup';
import { utils, constants, Wallet } from 'ethers';
import { setup, AccountWithContract } from './utils/fixture';
import { createPermitSignature } from '../src';

describe('Asset', () => {
  let alice: AccountWithContract;
  let deployer: AccountWithContract;
  let bob: AccountWithContract;
  const value = utils.parseEther('1');

  beforeEach('load fixture', async () => {
    ({ deployer, alice, bob } = await setup());
  });

  context('V1 behaviour', () => {
    context('Manageable behaviour', () => {
      it('#toggle should change live status', async () => {
        expect(await deployer.asset.live()).to.be.eq(1);
        await expect(deployer.asset.toggle()).to.emit(deployer.asset, 'Live').withArgs(0);
        expect(await deployer.asset.live()).to.be.eq(0);
        await deployer.asset.toggle();
        expect(await deployer.asset.live()).to.be.eq(1);
      });

      it('#rely should add party to the auth list', async () => {
        expect(await deployer.asset.auth(bob.address)).to.be.eq(0);
        await expect(deployer.asset.rely(bob.address)).to.emit(deployer.asset, 'Rely').withArgs(bob.address);
        expect(await deployer.asset.auth(bob.address)).to.be.eq(1);
      });

      it('#deny should remove party from the auth list', async () => {
        await deployer.asset.rely(bob.address);
        expect(await deployer.asset.auth(bob.address)).to.be.eq(1);
        await expect(deployer.asset.deny(bob.address)).to.emit(deployer.asset, 'Deny').withArgs(bob.address);
        expect(await deployer.asset.auth(bob.address)).to.be.eq(0);
      });
    });

    describe('#join(address,uint256)', () => {
      it('should throw if not live', async () => {
        await deployer.asset.toggle();
        await expect(deployer.asset['join(address,uint256)'](deployer.address, value)).to.be.revertedWith('NotLive()');
      });

      it('should throw if sender does not allowed tokens', async () => {
        await expect(deployer.asset['join(address,uint256)'](deployer.address, value)).to.be.revertedWith(
          'ERC20: insufficient allowance'
        );
      });

      it('should throw if sender does not have approved amount of tokens', async () => {
        await deployer.erc20.approve(deployer.asset.address, value);
        await expect(deployer.asset['join(address,uint256)'](deployer.address, value)).to.be.revertedWith(
          'ERC20: transfer amount exceeds balance'
        );
      });

      it('should throw if provided overflow value', async () => {
        await expect(deployer.asset['join(address,uint256)'](deployer.address, constants.MaxUint256)).to.be.revertedWith(
          'UintOverflow()'
        );
      });

      it('should join tokens', async () => {
        const balanceBefore = await alice.erc20.balanceOf(alice.asset.address);
        await alice.erc20.approve(alice.asset.address, value);
        expect(await alice.ledger.balances(alice.address, alice.erc20.address)).to.be.eq(0);
        await expect(alice.asset['join(address,uint256)'](alice.address, value))
          .to.emit(alice.asset, 'Join')
          .withArgs(alice.address, value);
        expect(await alice.ledger.balances(alice.address, alice.erc20.address)).to.be.eq(value);
        expect(await alice.erc20.balanceOf(alice.asset.address)).to.eq(balanceBefore.add(value));
      });
    });

    describe('#join(address,address,uint256)', () => {
      it('should throw if not live', async () => {
        await deployer.asset.toggle();
        await expect(
          deployer.asset['join(address,address,uint256)'](alice.address, alice.address, value)
        ).to.be.revertedWith('NotLive()');
      });

      it('should throw if src does not allowed tokens', async () => {
        await expect(
          deployer.asset['join(address,address,uint256)'](alice.address, alice.address, value)
        ).to.be.revertedWith('ERC20: insufficient allowance');
      });

      it('should throw if sender does not have approved amount of tokens', async () => {
        await deployer.erc20.approve(deployer.asset.address, value);
        await expect(
          deployer.asset['join(address,address,uint256)'](deployer.address, alice.address, value)
        ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
      });

      it('should join tokens', async () => {
        const balanceBefore = await alice.erc20.balanceOf(alice.asset.address);
        await alice.erc20.approve(alice.asset.address, value);
        expect(await alice.ledger.balances(alice.address, alice.erc20.address)).to.be.eq(0);
        await expect(deployer.asset['join(address,address,uint256)'](alice.address, alice.address, value))
          .to.emit(alice.asset, 'Join')
          .withArgs(alice.address, value);
        expect(await alice.ledger.balances(alice.address, alice.erc20.address)).to.be.eq(value);
        expect(await alice.erc20.balanceOf(alice.asset.address)).to.eq(balanceBefore.add(value));
      });
    });

    describe('#join(address,address,uint256,(address,uint256,uint8,bytes32,bytes32))', () => {
      it('should throw if not live', async () => {
        await deployer.asset.toggle();
        await expect(
          deployer.asset['join(address,address,uint256,(address,uint256,uint8,bytes32,bytes32))'](
            deployer.address,
            alice.address,
            value,
            {
              owner: constants.AddressZero,
              deadline: 0,
              v: 0,
              r: constants.HashZero,
              s: constants.HashZero
            }
          )
        ).to.be.revertedWith('NotLive()');
      });

      it('should join tokens', async () => {
        const balanceBefore = await alice.erc20.balanceOf(alice.asset.address);
        expect(await alice.ledger.balances(alice.address, alice.erc20.address)).to.be.eq(0);
        const deadline = (await alice.erc20.provider.getBlock('latest')).timestamp + 10000;

        const { v, r, s } = await createPermitSignature(
          alice.erc20.signer as Wallet,
          alice.erc20,
          alice.address,
          alice.asset.address,
          value,
          deadline
        );

        await expect(
          deployer.asset['join(address,address,uint256,(address,uint256,uint8,bytes32,bytes32))'](
            alice.address,
            alice.address,
            value,
            {
              owner: alice.address,
              deadline,
              v,
              r,
              s
            }
          )
        )
          .to.emit(alice.asset, 'Join')
          .withArgs(alice.address, value);
        expect(await alice.ledger.balances(alice.address, alice.erc20.address)).to.be.eq(value);
        expect(await alice.erc20.balanceOf(alice.asset.address)).to.eq(balanceBefore.add(value));
      });
    });

    describe('#joinWrapped(address,uint256)', () => {
      it('should throw if not live', async () => {
        await deployer.wrappedAsset.toggle();
        await expect(
          deployer.wrappedAsset.joinWrapped(deployer.address, value, {
            value: value
          })
        ).to.be.revertedWith('NotLive()');
      });

      it('should throw if called on non-wrapped asset', async () => {
        await expect(
          deployer.asset.joinWrapped(deployer.address, value, {
            value: value
          })
        ).to.be.revertedWith('NonWrappedAsset()');
      });

      it('should throw if no native value has been sent', async () => {
        await expect(deployer.wrappedAsset.joinWrapped(deployer.address, value)).to.be.revertedWith('InvalidValue()');
      });

      it('should wrap and join asset', async () => {
        const balanceBefore = await deployer.wrappedErc20.balanceOf(deployer.wrappedAsset.address);
        expect(await deployer.ledger.balances(deployer.address, deployer.wrappedErc20.address)).to.be.eq(0);
        await expect(
          deployer.wrappedAsset.joinWrapped(deployer.address, value, {
            value
          })
        )
          .to.emit(deployer.wrappedAsset, 'Join')
          .withArgs(deployer.address, value)
          .emit(deployer.wrappedErc20, 'Deposit')
          .withArgs(deployer.wrappedAsset.address, value);
        expect(await deployer.ledger.balances(deployer.address, deployer.wrappedErc20.address)).to.be.eq(value);
        expect(await deployer.wrappedErc20.balanceOf(deployer.wrappedAsset.address)).to.eq(balanceBefore.add(value));
      });
    });

    describe('#exit(address,uint256)', () => {
      it('should throw if not live', async () => {
        await deployer.asset.toggle();
        await expect(deployer.asset.exit(deployer.address, value)).to.be.revertedWith('NotLive()');
      });

      it('should throw if provided overflow value', async () => {
        await expect(deployer.asset.exit(deployer.address, constants.MaxUint256)).to.be.revertedWith('UintOverflow()');
      });

      it('should throw if balance is empty', async () => {
        await expect(deployer.asset.exit(deployer.address, value)).to.be.reverted;
      });

      it('should exit funds', async () => {
        await alice.erc20.approve(alice.asset.address, value);
        await alice.asset['join(address,uint256)'](alice.address, value);
        expect(await alice.ledger.balances(alice.address, alice.erc20.address)).to.be.eq(value);
        expect(await alice.erc20.balanceOf(alice.asset.address)).to.eq(value);
        const balanceBefore = await alice.erc20.balanceOf(alice.address);
        await expect(alice.asset.exit(alice.address, value)).to.emit(alice.asset, 'Exit').withArgs(alice.address, value);
        expect(await alice.ledger.balances(alice.address, alice.erc20.address)).to.be.eq(0);
        expect(await alice.erc20.balanceOf(alice.asset.address)).to.eq(0);
        expect(await alice.erc20.balanceOf(alice.address)).to.eq(balanceBefore.add(value));
      });
    });
  });

  context('V2 behaviour', () => {
    context('#exitSelf(address)', () => {
      it('should throw if called not by an deployer', async () => {
        await expect(alice.asset.exitSelf(alice.address)).to.be.revertedWith('NotAuthorized()');
      });

      it('should exit self funds', async () => {
        const assetBalance = await alice.erc20.balanceOf(deployer.asset.address);
        const aliceBalanceBefore = await alice.erc20.balanceOf(alice.address);
        await deployer.asset.exitSelf(alice.address);
        expect(await alice.erc20.balanceOf(deployer.asset.address)).to.be.eq(0);
        expect(await alice.erc20.balanceOf(alice.address)).to.be.eq(
          aliceBalanceBefore.add(assetBalance)
        );
      });
    });
  });

  context('V3 behaviour', () => {
    context('public getters', () => {
      it('should return correct ledger', async () => {
        expect(await alice.asset.ledger()).to.equal(deployer.ledger.address);
      });

      it('should return correct asset', async () => {
        expect(await alice.asset.asset()).to.equal(deployer.erc20.address);
      });
    });

    context('#set(bytes32,address)', () => {
      it('should throw if caller not authorized', async () => {
        await expect(
          alice.asset['set(bytes32,address)'](
            utils.formatBytes32String('ledger'),
            constants.AddressZero
          )).to.be.revertedWith('NotAuthorized()');
      });

      it('should throw if invalid what', async () => {
        await expect(
          deployer.asset['set(bytes32,address)'](
            utils.formatBytes32String('unknown'),
            constants.AddressZero
          )).to.be.revertedWith('InvalidWhat()');
      });

      it('should update ledger', async () => {
        await deployer.asset['set(bytes32,address)'](
          utils.formatBytes32String('ledger'),
          constants.AddressZero
        );
        expect(await deployer.asset.ledger())
          .to.equal(constants.AddressZero);
      });

      it('should update asset', async () => {
        await deployer.asset['set(bytes32,address)'](
          utils.formatBytes32String('asset'),
          constants.AddressZero
        );
        expect(await deployer.asset.asset())
          .to.equal(constants.AddressZero);
      });
    });

    context('#set(bytes32,uint256)', () => {
      it('should throw if caller not authorized', async () => {
        await expect(
          alice.asset['set(bytes32,uint256)'](
            utils.formatBytes32String('wrapped'),
            0
          )).to.be.revertedWith('NotAuthorized()');
      });

      it('should throw if invalid what', async () => {
        await expect(
          deployer.asset['set(bytes32,uint256)'](
            utils.formatBytes32String('unknown'),
            0
          )).to.be.revertedWith('InvalidWhat()');
      });

      it('should update wrapped flag', async () => {
        await deployer.asset['set(bytes32,uint256)'](
          utils.formatBytes32String('wrapped'),
          0
        );
        expect(await deployer.asset.wrapped())
          .to.equal(0);
      });
    });
  });
});
