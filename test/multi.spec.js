const assert = require('assert')
const Sharding = require('../lib')
const sharding = new Sharding({
  '127.0.0.1:7000': { vnodes: 50 },
  '127.0.0.1:7001': { vnodes: 50 },
  '127.0.0.1:7002': { vnodes: 50 },
  '127.0.0.1:7003': { vnodes: 50 }
})

// 注意：不支持链式的操作，因为每次 multi 操作可能会按当前的 key 去异步获取一个 server
const test_exec = async () => {
  const multi = sharding.getMulti()
  await multi.set('a', 'foo') // => 7002
  await multi.set('b', 'bar') // => 7000
  await multi.get('a')
  await multi.get('b')
  return multi.execAsync()
}

test_exec().then(replies => {
  assert.ok(replies[0] === '127.0.0.1:7002', '结果不一致')
  assert.ok(replies[1] === '127.0.0.1:7000', '结果不一致')
  assert.ok(replies[2] === 'foo', '结果不一致')
  assert.ok(replies[3] === 'bar', '结果不一致')
  process.exit(0)
})
