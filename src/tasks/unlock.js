import { connect } from '../framework/web3'

import { unlockAccount } from '../utils/basic'

import {
  getSubContract,
} from '../utils/token'

import {
  gas,
  gasPrice,
  teamAddr01,
  teamAddr02,
  teamAddr03,
  teamAddr04,
  teamAddr05,
  teamAddr06,
  deployOwnerAddr,
  deployOwnerSecret,
} from '../config/const'

export default async (index) => {
  let unlockAddr = ''

  switch (+index) {
    case 1:
      unlockAddr = teamAddr01
      break
    case 2:
      unlockAddr = teamAddr02
      break
    case 3:
      unlockAddr = teamAddr03
      break
    case 4:
      unlockAddr = teamAddr04
      break
    case 5:
      unlockAddr = teamAddr05
      break
    case 6:
      unlockAddr = teamAddr06
      break
  }

  // 获取锁定合约实例
  let lockContractInstance = await getSubContract(connect)

  await unlockAccount(connect, deployOwnerAddr, deployOwnerSecret)
  console.log(`unlock ${unlockAddr}`)

  // 解锁锁定的代币
  let unlockResult = await lockContractInstance
    .methods
    .unlock(unlockAddr)
    .send({
      from: deployOwnerAddr,
      gas,
      gasPrice,
    })
    .catch((err) => {
      throw new Error(err.message)
    })

  console.log(unlockResult)
  process.exit(0)
}