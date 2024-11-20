
## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## JSON API

```bash
# Should be called when user launches game for the first time ever (so only once per user)
1) POST http://localhost:3000/api/initialize
{
    "telegramId": "470141382"
}

# Get user information. If shouldUpdateBalance is true, then also will recalculate user balances
# shouldUpdateBalance = false by default
2) GET http://localhost:3000/api/user?telegramId=470141382&shouldUpdateBalance=true

# Update one of the entities by 1 level (also updates user balances before leveling up)
3) POST http://localhost:3000/api/level-up
{
    "telegramId": "470141382",
    "entity": "banknoteDenomination" // valid values: moneyStorage, paperStorage, printingSpeed, banknoteDenomination
}

# Allows to buy paper (also updates user balances before paper update)
4) POST http://localhost:3000/api/buy-paper
{
    "telegramId": "470141382",
    "paperPack": "base" // valid values: base, small, medium, large, huge
}

# Fills up users game balance (storage) from the bank (bot ref system). 
# - For example: if storage capacity is 100, user game balance is 60 and his bank balance is 200
# then after function call game balance will be 100 and bank balance 160
# - For example: if storage capacity is 100, user game balance is 60 and his bank balance is 12
# then after function call game balance will be 72 and bank balance 0
5) POST http://localhost:3000/api/transfer/bank-to-balance
{
    "telegramId": "470141382"
}

Response format - all responses have same format.
All endpoints return game profile data - 
{
    "status": true,
    "data": {
        "telegramId": "470141382",
        "snapshotTime": "2024-04-19T06:27:04.201Z",
        "balance": 100,
        "moneyStorageLvl": 1,
        "paperStorageLvl": 2,
        "printingSpeedLvl": 1,
        "banknoteLvl": 2,
        "paperAmount": 0
    }
}

Or error data: 
{
    "status": false,
    "error": "Not enough balance to lvl up 6/200"
}
```