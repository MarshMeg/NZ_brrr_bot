import {
  BANKNOTE_DENOMINATION,
  GameEntities,
  MONEY_S_SIZE,
  PRINTING_SPEED,
} from './constants';
import { Gamer } from '../entities/gamer.schema';
import { InvalidEntityNameError } from './errors/invalid-entity-name.error';
import Decimal from 'decimal.js';
import { LogicError } from './errors/logic.error';

export function calculateReward(
  userData: Gamer,
  newSnapshotTime: number,
  boost?: number,
): { newBalance: Decimal; newPaperAmount: Decimal } {
  const maxBalance = new Decimal(
    MONEY_S_SIZE[userData.moneyStorageLvl],
  ).toDecimalPlaces(2);
  const printSpeed = new Decimal(
    PRINTING_SPEED[userData.printingSpeedLvl],
  ).toDecimalPlaces(2);
  const denomination = new Decimal(
    BANKNOTE_DENOMINATION[userData.banknoteLvl],
  ).toDecimalPlaces(2);

  const userBalance = new Decimal(userData.balance).toDecimalPlaces(2);
  const paperAmount = new Decimal(userData.paperAmount).toDecimalPlaces(2);

  if (userBalance.gte(maxBalance)) {
    return {
      newBalance: userBalance,
      newPaperAmount: paperAmount,
    };
  }

  const secondsPassed = Math.floor(
    (newSnapshotTime - userData.snapshotTime.getTime()) / 1000,
  );
  const secondsTillFullBalance = Decimal.div(
    maxBalance.sub(userBalance),
    denomination.mul(printSpeed),
  ).ceil();
  const secondsTillEmptyPaperStore = paperAmount.div(printSpeed).ceil();

  const miningSeconds = Decimal.min(
    ...[secondsTillFullBalance, secondsTillEmptyPaperStore, secondsPassed],
  );

  let profit = printSpeed.mul(denomination).mul(miningSeconds);
  if (boost) {
    profit = new Decimal(profit).add(profit.mul(boost).div(100));
  }

  const provisionedBalance = userBalance.add(profit);

  const newBalance = provisionedBalance.lt(maxBalance)
    ? provisionedBalance.toDecimalPlaces(2)
    : maxBalance.toDecimalPlaces(2);

  const newPaperAmount = paperAmount.gt(miningSeconds.mul(printSpeed))
    ? paperAmount.minus(miningSeconds.mul(printSpeed)).toDecimalPlaces(2)
    : new Decimal(0);

  if (new Decimal(newBalance).isNaN()) {
    console.log('Something wrong with calculations', {
      maxBalance,
      printSpeed,
      denomination,
      newBalance,
    });
    throw new LogicError('Something wrong with calculations');
  }

  return {
    newBalance,
    newPaperAmount,
  };
}

export function calculateDailyReward(userData: Gamer): Decimal {
  const printSpeed = new Decimal(
    PRINTING_SPEED[userData.printingSpeedLvl],
  ).toDecimalPlaces(2);
  const denomination = new Decimal(
    BANKNOTE_DENOMINATION[userData.banknoteLvl],
  ).toDecimalPlaces(2);

  const reward = new Decimal(printSpeed).mul(denomination).mul(3600);

  if (reward.isNaN()) {
    console.log('Something wrong with calculations', {
      printSpeed,
      denomination,
      reward,
    });
    throw new LogicError('Something wrong with calculations');
  }

  return reward;
}

export function getGamerLvlFieldByEntity(entity: GameEntities) {
  if (entity === GameEntities.moneyStorage) {
    return 'moneyStorageLvl';
  } else if (entity === GameEntities.paperStorage) {
    return 'paperStorageLvl';
  } else if (entity === GameEntities.printingSpeed) {
    return 'printingSpeedLvl';
  } else if (entity === GameEntities.banknoteDenomination) {
    return 'banknoteLvl';
  } else {
    throw new InvalidEntityNameError(`Invalid entity name passed: ${entity}`);
  }
}
