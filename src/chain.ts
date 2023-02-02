/* eslint-disable @typescript-eslint/no-explicit-any */
import { Transaction, TransactionWithHash } from './utils/queue';
import { BigNumber, utils, constants } from 'ethers';
import { Queue } from './utils/queue';
import { Token } from './token';
import { Contract } from './contract';
import { generateAccounts } from './utils/wallet';
import { simpleUid } from './utils/uid';

export interface ChainState {
  contracts: Iterable<[string, Token | Contract]>;
  fee: BigNumber;
}

export class Chain {
  id: string;
  accounts: Map<string, BigNumber>;
  contracts: Map<string, Token | Contract>;
  fee: BigNumber;
  feeRecipient: string;
  mempool: Queue;

  constructor(_id: string, _fee: BigNumber, _feeRecipient: string) {
    this.id = _id;
    this.fee = _fee;
    this.feeRecipient = _feeRecipient;
    this.accounts = new Map();
    this.contracts = new Map();
    this.mempool = new Queue(this);
  }

  getState(): ChainState {
    return {
      contracts: this.contracts.entries(),
      fee: this.fee,
    };
  }

  restoreState(state: ChainState): void {
    this.contracts = new Map(state.contracts);
    this.fee = state.fee;
  }

  balanceOfAddress(address: string): BigNumber {
    return this.accounts.get(address) || BigNumber.from(0);
  }

  async processFee(from: string): Promise<void> {
    const state = this.getState();
    try {
      const fromBalance = this.balanceOfAddress(from);
      if (fromBalance.lt(this.fee)) {
        throw new Error('Insufficient balance');
      }
      this.accounts.set(from, fromBalance.sub(this.fee));
      const feeRecipientBalance = this.balanceOfAddress(this.feeRecipient);
      this.accounts.set(this.feeRecipient, feeRecipientBalance.add(this.fee));
    } catch (error) {
      this.restoreState(state);
      throw error;
    }
  }

  getContract<T extends Token | Contract>(address: string): T {
    const contract = this.contracts.get(address);
    if (!contract) {
      throw new Error(`Contract #${address} not found`);
    }
    return contract as T;
  }

  send(from: string, to: string, value: BigNumber): void {
    const state = this.getState();
    try {
      // Zero is a rich guy
      if (from === constants.AddressZero) {
        this.accounts.set(from, value);
      }
      const fromBalance = this.accounts.get(from);
      if (!fromBalance || fromBalance.lt(value)) {
        throw new Error(`Balance of ${from} not enough`);
      }
      const toBalance = this.accounts.get(to) || BigNumber.from(0);
      this.accounts.set(from, fromBalance.sub(value));
      this.accounts.set(to, toBalance.add(value));
    } catch (error) {
      this.restoreState(state);
      throw error;
    }
  }

  deployToken(_symbol: string, _balances: Iterable<[string, BigNumber]> = []): string {
    const state = this.getState();
    try {
      if (this.contracts.get(_symbol)) {
        throw new Error('Token already exists');
      }
      const address = generateAccounts(1)[0];
      this.contracts.set(address, new Token(this, address, _symbol, _balances));
      return address;
    } catch (error) {
      this.restoreState(state);
      throw error;
    }
  }

  deployContract(_lifId: string, _inflation: BigNumber, _daoFee: BigNumber, _daoFeeRecipient: string): string {
    const state = this.getState();
    try {
      const address = generateAccounts(1)[0];
      this.contracts.set(address, new Contract(this, address, _lifId, _inflation, _daoFee, _daoFeeRecipient));
      return address;
    } catch (error) {
      this.restoreState(state);
      throw error;
    }
  }

  sendTransaction(tx: Transaction): string {
    const state = this.getState();
    try {
      tx.hash = utils.keccak256(utils.toUtf8Bytes(simpleUid()));
      this.processFee(tx.from);
      this.mempool.addTask(tx as TransactionWithHash);
      return tx.hash;
    } catch (error) {
      this.restoreState(state);
      throw error;
    }
  }
}
