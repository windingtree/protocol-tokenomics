import type { Chain } from './chain';
import { BigNumber } from 'ethers';
import { generateAccounts } from './utils/wallet';

export interface BridgedToken {
  address: string;
  chainId: string;
}

export class Bridge {
  chains: Map<string, Chain>;
  wallets: Record<string, string>; // chainId => account
  pairsDirect: Map<string, Map<string, string>>; // chainId => tokenAddressFrom => tokenAddressTo
  pairsReverse: Map<string, Map<string, string>>; // chainId => tokenAddressTo => tokenAddressFrom

  constructor(_chains: Chain[]) {
    this.chains = new Map(_chains.map((c) => [c.id, c]));
    this.wallets = generateAccounts(this.chains.size).reduce(
      (a, v, i) => ({
        ...a,
        [_chains[i].id]: v,
      }),
      {},
    );
    this.pairsDirect = new Map();
    this.pairsReverse = new Map();
  }

  getChain(chainId: string): Chain {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain #${chainId} is not registered on the bridge`);
    }
    return chain;
  }

  registerPair(from: BridgedToken, to: BridgedToken): void {
    const pairsDirect = (this.pairsDirect.get(from.chainId) || new Map()).set(from.address, to.address);
    this.pairsDirect.set(from.chainId, pairsDirect);
    const pairsReverse = (this.pairsReverse.get(to.chainId) || new Map()).set(to.address, from.address);
    this.pairsReverse.set(from.chainId, pairsReverse);
  }

  validatedPair(address: string, srcChainId: string, destChainId: string): { srcChain: Chain; destChain: Chain } {
    const srcChain = this.getChain(srcChainId);
    const destChain = this.getChain(destChainId);
    // Check if token paired
    const pairs = this.pairsDirect.get(srcChainId);
    if (!pairs || !pairs.get(address)) {
      throw new Error(`Token #${address} from chain #${srcChainId} is not paired`);
    }
    const destTokenAddress = pairs.get(address);
    if (!destTokenAddress) {
      throw new Error(`Invalid token #${address} pair on from chain #${srcChainId}`);
    }
    return { srcChain, destChain };
  }

  async enter(
    sender: string,
    address: string,
    amount: BigNumber,
    srcChainId: string,
    destChainId: string,
  ): Promise<void> {
    const { srcChain, destChain } = this.validatedPair(address, srcChainId, destChainId);
    // Lock incoming tokens on bridge
    const lockTx = srcChain.sendTransaction({
      from: sender,
      value: BigNumber.from(0),
      data: {
        address,
        function: 'transfer',
        arguments: [sender, this.wallets[srcChainId], amount],
      },
    });
    await srcChain.mempool.wait(lockTx);
    // Mint on L3
    const mintTx = destChain.sendTransaction({
      from: sender,
      value: BigNumber.from(0),
      data: {
        address,
        function: 'mint',
        arguments: [sender, amount],
      },
    });
    await destChain.mempool.wait(mintTx);
  }

  async exit(
    sender: string,
    address: string,
    amount: BigNumber,
    srcChainId: string,
    destChainId: string,
  ): Promise<void> {
    const { srcChain, destChain } = this.validatedPair(address, srcChainId, destChainId);
    // Burn on L3
    const burnTx = srcChain.sendTransaction({
      from: sender,
      value: BigNumber.from(0),
      data: {
        address,
        function: 'burn',
        arguments: [sender, amount],
      },
    });
    await srcChain.mempool.wait(burnTx);
    // Unlock tokens in Mainnet
    const unlockTx = destChain.sendTransaction({
      from: sender,
      value: BigNumber.from(0),
      data: {
        address,
        function: 'transfer',
        arguments: [this.wallets[srcChainId], sender, amount],
      },
    });
    await destChain.mempool.wait(unlockTx);
  }
}
