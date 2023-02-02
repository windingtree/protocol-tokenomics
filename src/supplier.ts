import { BigNumber } from 'ethers';
import { Chain } from './chain';
import { Contract } from './contract';
import { simpleUid } from './utils/uid';
import { generateAccounts } from './utils/wallet';
import { Logger } from './utils/logger';

const logger = Logger('Supplier');

export interface Offer {
  id: string;
  supplier: string;
  token: string;
  value: BigNumber;
}

export class Supplier {
  id: string;
  chain: Chain;
  account: string;
  tokens: string[];
  minValue: BigNumber;
  maxValue: BigNumber;
  contract: Contract;

  constructor(
    _chain: Chain,
    _tokens: string[],
    _minValue: BigNumber,
    _maxValue: BigNumber,
    _contract: string,
  ) {
    this.id = simpleUid();
    this.chain = _chain;
    const [account] = generateAccounts(1);
    this.account = account;
    this.tokens = _tokens;
    if (_minValue.gte(_maxValue)) {
      throw new Error('Max offer value must be greater than Min value');
    }
    this.minValue = _minValue;
    this.maxValue = _maxValue;
    this.contract = this.chain.getContract<Contract>(_contract);
  }

  private getRandomToken(): string {
    const token = this.tokens[Math.floor(Math.random() * this.tokens.length)];
    if (!token) {
      throw new Error('Unable to get token');
    }
    return token;
  }

  private getRandomValue(): BigNumber {
    const dif = this.maxValue.sub(this.minValue);
    const difLength = dif.toString().length;
    let multiplier = '';
    while (multiplier.length < difLength) {
      multiplier += Math.random().toString().split('.')[1];
    }
    multiplier = multiplier.slice(0, difLength);
    const divisor = '1' + '0'.repeat(difLength);
    return this.minValue.add(
      BigNumber.from(dif).mul(BigNumber.from(multiplier)).div(BigNumber.from(divisor)),
    );
  }

  order(offerId: string): void {
    // Check own balance
    const balance = this.chain.balanceOfAddress(this.account);
    if (balance.lt(this.chain.fee)) {
      return;
    }
    // Set claim tx
    this.chain.sendTransaction({
      from: this.account,
      value: BigNumber.from(0),
      data: {
        address: this.contract.address,
        function: 'claim',
        arguments: [offerId],
      },
    });
    logger.debug(`Claim Tx sent by the supplier: ${this.account}`);
  }

  request(): Offer {
    const offerId = simpleUid();
    // Wait for payment
    this.contract.once(`deal#${offerId}`, () => this.order(offerId));
    logger.debug(`Offer ${offerId} created by the supplier: ${this.account}`);
    return {
      id: offerId,
      supplier: this.id,
      token: this.getRandomToken(),
      value: this.getRandomValue(),
    };
  }
}
