import { TaskCapsule, ParallelQueue } from 'async-task-manager'

import getConnection from '../../framework/web3'
import { TxRecordModel } from '../../core/schemas'
import { STATUS } from '../../core/enums'

let executable = true

export default async function (job, done) {
  if (!executable) {
    console.info('尚有未完成交易状态同步任务...')
    done()
  }
  console.log('开始同步交易状态')
  executable = false

  let conn

  try {
    conn = getConnection()
  } catch (ex) {
    console.error(ex.message)
    executable = true
    done()
    return
  }

  let currBlockNumber = await conn.eth.getBlockNumber()
  // 60 个区块高度前的区块内的交易视作已确认
  let blockHeightLimitation = currBlockNumber - 30
  let sendingTxs = await TxRecordModel.find({ status: STATUS.sending }).catch((ex) => {
    console.error(`交易状态同步失败 ${ex}`)
    executable = true
    done()
  })
  if (sendingTxs.length > 0) {
    // 创建任务队列
    let queue = new ParallelQueue({
      limit: 50,
      toleration: 0,
    })

    sendingTxs.forEach((transaction) => {
      queue.add(new TaskCapsule(() => new Promise(async (resolve, reject) => {
        let { txid } = transaction
        if (txid) {
          let conn = getConnection()
          let txInfo = await conn.eth.getTransaction(txid).catch(() => false)
          if (txInfo && txInfo.blockNumber && txInfo.blockNumber < blockHeightLimitation) {
            // 确认成功
            transaction.status = STATUS.success
            transaction.confirmTime = new Date()
            transaction.save().then(resolve).catch(reject)
          } else if (transaction.sendTime <= Date.now() - (2 * 60 * 60 * 1000)) {
            // 2 小时后仍未被确认 视作失败
            transaction.status = STATUS.error
            transaction.exceptionMsg = '交易已广播，但在接下来的 2 个小时内未被确认，请手动确认'
            transaction.save().then(resolve).catch(reject)
          } else {
            // 尚未确认
            resolve()
          }
        } else {
          // 交易失败 没有 txid 却被置为 sending
          transaction.status = STATUS.error
          transaction.exceptionMsg = '缺失 transaction hash 却被标记为 sending'
          transaction.save().then(resolve).catch(reject)
        }
      })))
    })

    // 消费任务队列
    await queue
      .consume()
      .then(async () => {
        console.log('交易状态同步完毕')
        executable = true
        done()
      })
      .catch((ex) => {
        console.error(`交易状态同步失败 ${ex}`)
        executable = true
        done()
      })
  } else {
    console.log('没有需要同步的交易状态')
    executable = true
    done()
  }
}
