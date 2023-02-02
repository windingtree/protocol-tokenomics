/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber } from 'ethers';
import { Chain } from 'src/chain';
import { Logger } from './logger';

const logger = Logger('Tx');

export interface Transaction {
  hash?: string;
  from: string;
  value: BigNumber;
  data: {
    address: string;
    function: string;
    arguments: any[];
  };
}

export interface TransactionWithHash extends Transaction {
  hash: string;
}

export interface Msg {
  sender: string;
  value: BigNumber;
}

export class Queue {
  chain: Chain;
  tasks: TransactionWithHash[] = [];
  pending: Map<string, Promise<void>>;
  busy = false;

  constructor(_chain: Chain) {
    this.chain = _chain;
    this.pending = new Map();
  }

  addTask(task: TransactionWithHash): void {
    this.tasks.push(task);
    if (!this.busy) {
      this.process().catch(logger.error);
    }
  }

  async process(): Promise<void> {
    if (!this.tasks.length) {
      this.busy = false;
      return;
    }
    const tx = this.tasks[0];

    try {
      this.busy = true;
      const msg: Msg = {
        sender: tx.from,
        value: tx.value,
      };
      const contract = this.chain.getContract(tx.data.address);
      const method = contract[tx.data.function];
      if (!method) {
        throw new Error(`"${tx.data.function}" function of contract #${tx.data.address} not found`);
      }
      const task = method.apply(contract, [msg, ...tx.data.arguments]);
      this.pending.set(tx.hash, task);
      await task;
      logger.debug(`#${tx.hash} done`);
      this.pending.delete(tx.hash);
    } catch (error) {
      logger.debug(`#${tx.hash} failed`);
      logger.error(error);
    }

    this.tasks.shift();
    this.busy = false;

    if (this.tasks.length) {
      await this.process();
    }
  }

  async wait(hash: string): Promise<void> {
    const task = this.pending.get(hash);
    if (!this.pending.get(hash)) {
      return Promise.resolve();
    }
    return task;
  }
}
