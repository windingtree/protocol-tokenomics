import { Msg } from './utils/queue';
import { EventEmitter } from 'events';
import { BigNumber } from 'ethers';
import { Chain } from './chain';
import { Token } from './token';
import { Offer } from './supplier';

export interface ContractState {
  deals: Iterable<[string, Deal]>;
}

export interface Request {
  id: string;
}

export interface Deal {
  id: string;
  buyer: string;
  supplier: string;
  token: Offer['token'];
  value: Offer['value'];
  status: boolean;
}

export class Contract extends EventEmitter {
  chain: Chain;
  address: string;
  lif: Token;
  inflation: BigNumber;
  daoFee: BigNumber;
  daoFeeRecipient: string;
  deals: Map<string, Deal>;

  constructor(
    _chain: Chain,
    _address: string,
    _lif: string,
    _inflation: BigNumber,
    _daoFee: BigNumber,
    _daoFeeRecipient: string,
  ) {
    super();
    this.chain = _chain;
    this.address = _address;
    this.inflation = _inflation;
    this.daoFee = _daoFee;
    this.daoFeeRecipient = _daoFeeRecipient;
    this.deals = new Map();
    this.lif = this.chain.getContract<Token>(_lif);
    if (!this.lif) {
      throw new Error(`LIF token not found on chain: ${this.chain.id}`);
    }
  }

  getState(): ContractState {
    return {
      deals: this.deals.entries(),
    };
  }

  restoreState(state: ContractState): void {
    this.deals = new Map(state.deals);
  }

  async deal(_msg: Msg, _buyer: string, _offer: Offer): Promise<void> {
    // @todo Check caller
    this.deals.set(_offer.id, {
      id: _offer.id,
      buyer: _buyer,
      supplier: _offer.supplier,
      token: _offer.token,
      value: _offer.value,
      status: false,
    });

    // Offer paid
    this.emit('deal', _offer.id);
    this.emit(`deal#${_offer.id}`);
  }

  async claim(msg: Msg, offerId: string): Promise<void> {
    const state = this.getState();
    try {
      const deal = this.deals.get(offerId);
      if (!deal) {
        throw new Error(`Offer #${offerId} not found`);
      }
      if (deal && deal.status) {
        throw new Error(`Offer #${offerId} already claimed`);
      }
      const token = this.chain.getContract<Token>(deal.token);
      token.transfer(msg, deal.buyer, deal.supplier, deal.value);

      // Offer is claimed
      this.emit('order', offerId);

      // LIF rewards
      const multiplier = BigNumber.from(1000);
      const reward = this.chain.fee.mul(this.inflation).div(deal.value).div(multiplier);
      const rewardDao = reward.mul(multiplier).div(this.daoFee).div(multiplier);
      const rewardBuyer = reward.sub(rewardDao);
      token.mint(msg, this.daoFeeRecipient, rewardDao);
      token.mint(msg, deal.buyer, rewardBuyer);
    } catch (error) {
      this.restoreState(state);
      throw error;
    }
  }
}
