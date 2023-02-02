import { Msg } from './utils/queue';
import { BigNumber } from 'ethers';
import { Chain } from './chain';

export interface TokenState {
  symbol: string;
  totalSupply: BigNumber;
  balances: Iterable<[string, BigNumber]>;
}

export class Token {
  chain: Chain;
  address: string;
  symbol: string;
  totalSupply: BigNumber;
  balances: Map<string, BigNumber>;

  constructor(
    _chain: Chain,
    _address: string,
    _symbol: string,
    _balances: Iterable<[string, BigNumber]> = [],
  ) {
    this.chain = _chain;
    this.address = _address;
    this.symbol = _symbol;
    this.balances = new Map<string, BigNumber>(_balances);
    this.totalSupply = Array.from(_balances).reduce((a, v) => a.add(v[1]), BigNumber.from(0));
  }

  getState(): TokenState {
    return {
      symbol: this.symbol,
      totalSupply: this.totalSupply,
      balances: this.balances.entries(),
    };
  }

  restoreState(state: TokenState): void {
    this.symbol = state.symbol;
    this.totalSupply = state.totalSupply;
    this.balances = new Map(state.balances);
  }

  balanceOf(address: string): BigNumber {
    return this.balances.get(address) || BigNumber.from(0);
  }

  mint(_msg: Msg, to: string, amount: BigNumber): void {
    const balance = this.balances.get(to) || BigNumber.from(0);
    this.balances.set(to, balance.add(amount));
    this.totalSupply = this.totalSupply.add(amount);
  }

  burn(_msg: Msg, from: string, amount: BigNumber): void {
    const state = this.getState();
    try {
      const balanceFrom = this.balances.get(from) || BigNumber.from(0);
      if (balanceFrom.lt(amount)) {
        throw new Error(
          `Token: Balance of ${from}: ${balanceFrom.toString()} not enough to burn ${amount.toString()}`,
        );
      }
      this.balances.set(from, balanceFrom.sub(amount));
      this.totalSupply = this.totalSupply.sub(amount);
    } catch (error) {
      this.restoreState(state);
      throw error;
    }
  }

  transfer(_msg: Msg, from: string, to: string, amount: BigNumber): void {
    const state = this.getState();
    try {
      const balanceFrom = this.balances.get(from) || BigNumber.from(0);
      const balanceTo = this.balances.get(to) || BigNumber.from(0);
      if (balanceFrom.lt(amount)) {
        throw new Error(
          `Token: Balance of ${from}: ${balanceFrom.toString()} not enough to transfer ${amount.toString()}`,
        );
      }
      this.balances.set(from, balanceFrom.sub(amount));
      this.balances.set(to, balanceTo.add(amount));
    } catch (error) {
      this.restoreState(state);
      throw error;
    }
  }
}
