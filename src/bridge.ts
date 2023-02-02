import { Chain } from './chain';
import { BigNumber, constants } from 'ethers';
import { generateAccounts } from './utils/wallet';

export interface BridgedToken {
  address: string;
  chainId: string;
}

export class Bridge {
  chains: Record<string, Chain>;
  chainsIndex: string[];
  wallet: string;
  pairs: Map<string, Map<string, string>>; // chainId => tokenAddressFrom => tokenAddressTo
  enterCreditValue: BigNumber;

  constructor(_chainSrc: Chain, _chainDest: Chain, _bridgeLif: BigNumber) {
    this.chains = {
      [_chainSrc.id]: _chainSrc,
      [_chainDest.id]: _chainDest,
    };
    this.chainsIndex = [_chainSrc.id, _chainDest.id];
    const accounts = generateAccounts(1);
    this.wallet = accounts[0];
    this.pairs = new Map();
    this.enterCreditValue = _bridgeLif;
  }

  registerPair(chainId: string, from: string, to: string): void {
    const pairs = this.pairs.get(chainId) || new Map();
    pairs.set(from, to);
    this.pairs.set(chainId, pairs);
  }

  getPairedToken(chainId: string, token: string): string {
    const pairs = this.pairs.get(chainId);
    if (pairs) {
      const pair = pairs.get(token);
      if (pair) {
        return pair;
      }
    }
    throw new Error(`Unable to find paired token for token ${token}`);
  }

  async enter(sender: string, tokenAddress: string, amount: BigNumber): Promise<void> {
    const mainnet = this.chains[this.chainsIndex[0]];
    const l3 = this.chains[this.chainsIndex[1]];
    const pairedToken = this.getPairedToken(mainnet.id, tokenAddress);
    // Lock incoming tokens on bridge
    const lockTx = mainnet.sendTransaction({
      from: sender,
      value: BigNumber.from(0),
      data: {
        address: tokenAddress,
        function: 'transfer',
        arguments: [sender, this.wallet, amount],
      },
    });
    await mainnet.mempool.wait(lockTx);
    // Mint on L3
    const mintTx = l3.sendTransaction({
      from: constants.AddressZero,
      value: BigNumber.from(0),
      data: {
        address: pairedToken,
        function: 'mint',
        arguments: [sender, amount],
      },
    });
    await l3.mempool.wait(mintTx);
    // Send to the sender a small amount of LIF on the L3
    const bridgeAccount = this.wallet;
    l3.send(bridgeAccount, sender, this.enterCreditValue);
  }

  async exit(sender: string, tokenAddress: string, amount: BigNumber): Promise<void> {
    const mainnet = this.chains[this.chainsIndex[0]];
    const l3 = this.chains[this.chainsIndex[1]];
    const pairedToken = this.getPairedToken(l3.id, tokenAddress);
    // Burn on L3
    const burnTx = l3.sendTransaction({
      from: sender,
      value: BigNumber.from(0),
      data: {
        address: tokenAddress,
        function: 'burn',
        arguments: [sender, amount],
      },
    });
    await l3.mempool.wait(burnTx);
    // Unlock tokens in Mainnet
    const unlockTx = mainnet.sendTransaction({
      from: sender,
      value: BigNumber.from(0),
      data: {
        address: pairedToken,
        function: 'transfer',
        arguments: [this.wallet, sender, amount],
      },
    });
    await mainnet.mempool.wait(unlockTx);
  }
}
