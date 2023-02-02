// n-cycles

/**
Every cycle:

- Create some suppliers

- Select a number of buyers (accounts) on Mainnet
- Top up account with STABLE token

On every buyer:

- Move STABLE tokens though the bridge
- Randomly select a supplier and request an offer

Buyer: on offer

- Create a deal

On every supplier:

- Wait for an offer request

Supplier: on request:

- Create an offer
- Claim the deal

 */
